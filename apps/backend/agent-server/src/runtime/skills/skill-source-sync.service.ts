import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { RuntimeProfile } from '@agent/config';
import { type SkillManifestRecord, type SkillSourceRecord } from '@agent/core';

interface SyncContext {
  workspaceRoot: string;
  profile: RuntimeProfile;
}

interface RemoteManifestIndexPayload {
  manifests?: SkillManifestRecord[];
  items?: SkillManifestRecord[];
}

export interface SkillSourceSyncResult {
  sourceId: string;
  status: 'synced' | 'skipped' | 'failed';
  syncedAt?: string;
  cacheFilePath?: string;
  manifestCount: number;
  error?: string;
}

function resolveCacheFilePath(workspaceRoot: string, sourceId: string): string {
  return resolve(workspaceRoot, 'data', 'skills', 'remote-sources', sourceId, 'index.json');
}

function toLocalPath(candidate: string, workspaceRoot: string): string {
  if (isAbsolute(candidate)) {
    return candidate;
  }
  return resolve(workspaceRoot, candidate);
}

export class SkillSourceSyncService {
  constructor(private readonly context: SyncContext) {}

  async syncSource(source: SkillSourceRecord): Promise<SkillSourceSyncResult> {
    if (source.discoveryMode === 'local-dir') {
      return {
        sourceId: source.id,
        status: 'skipped',
        manifestCount: 0
      };
    }

    const cacheFilePath = resolveCacheFilePath(this.context.workspaceRoot, source.id);
    const syncedAt = new Date().toISOString();

    try {
      const manifests = await this.fetchRemoteManifests(source);
      const normalized = manifests.map(manifest => ({
        ...manifest,
        sourceId: manifest.sourceId || source.id
      }));
      await mkdir(dirname(cacheFilePath), { recursive: true });
      await writeFile(cacheFilePath, JSON.stringify({ syncedAt, manifests: normalized }, null, 2));
      return {
        sourceId: source.id,
        status: 'synced',
        syncedAt,
        cacheFilePath,
        manifestCount: normalized.length
      };
    } catch (error) {
      return {
        sourceId: source.id,
        status: 'failed',
        syncedAt,
        cacheFilePath,
        manifestCount: 0,
        error: error instanceof Error ? error.message : 'skill_source_sync_failed'
      };
    }
  }

  async readCachedManifests(source: SkillSourceRecord): Promise<SkillManifestRecord[]> {
    const cacheFilePath = resolveCacheFilePath(this.context.workspaceRoot, source.id);
    try {
      const raw = await readFile(cacheFilePath, 'utf8');
      const payload = JSON.parse(raw) as { manifests?: SkillManifestRecord[] };
      return Array.isArray(payload.manifests) ? payload.manifests : [];
    } catch {
      return [];
    }
  }

  async readCachedSyncState(
    source: SkillSourceRecord
  ): Promise<Pick<SkillSourceRecord, 'lastSyncedAt' | 'healthState' | 'healthReason'>> {
    const cacheFilePath = resolveCacheFilePath(this.context.workspaceRoot, source.id);
    try {
      const raw = await readFile(cacheFilePath, 'utf8');
      const payload = JSON.parse(raw) as { syncedAt?: string; manifests?: SkillManifestRecord[] };
      return {
        lastSyncedAt: payload.syncedAt,
        healthState: 'healthy',
        healthReason: Array.isArray(payload.manifests)
          ? `已缓存 ${payload.manifests.length} 个远程 skill manifest。`
          : '远程 skill 索引已缓存。'
      };
    } catch {
      return {
        healthState: source.enabled ? 'unknown' : 'disabled',
        healthReason: source.enabled ? '尚未同步远程 skill 索引。' : source.healthReason
      };
    }
  }

  private async fetchRemoteManifests(source: SkillSourceRecord): Promise<SkillManifestRecord[]> {
    const target = source.indexUrl ?? source.baseUrl;
    if (!target) {
      throw new Error('missing_skill_source_index');
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
      const response = await fetch(target, {
        headers: this.buildAuthHeaders(source)
      });
      if (!response.ok) {
        throw new Error(`skill_source_http_${response.status}`);
      }
      const payload = (await response.json()) as RemoteManifestIndexPayload;
      return this.normalizeRemotePayload(payload, source.id);
    }

    const filePath = toLocalPath(target, this.context.workspaceRoot);
    const raw = await readFile(filePath, 'utf8');
    const payload = JSON.parse(raw) as RemoteManifestIndexPayload;
    return this.normalizeRemotePayload(payload, source.id);
  }

  private normalizeRemotePayload(payload: RemoteManifestIndexPayload, sourceId: string): SkillManifestRecord[] {
    const manifests = Array.isArray(payload.manifests)
      ? payload.manifests
      : Array.isArray(payload.items)
        ? payload.items
        : [];
    return manifests.map(manifest => ({
      ...manifest,
      sourceId: manifest.sourceId || sourceId,
      metadata: {
        ...(manifest.metadata ?? {}),
        syncedProfile: this.context.profile as RuntimeProfile
      }
    }));
  }

  private buildAuthHeaders(source: SkillSourceRecord): Record<string, string> {
    if (!source.authRef) {
      return {};
    }
    return {
      Authorization: `Bearer ${source.authRef}`
    };
  }
}
