import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import { RuntimeProfile } from '@agent/config';
import { type SkillManifestRecord, type SkillSourceRecord } from '@agent/core';
import type { SkillSourceRemoteCacheRepository } from '@agent/skill';

import { RuntimeSkillSourceRemoteCacheRepository } from './runtime-skill-storage.repository';

interface SyncContext {
  workspaceRoot: string;
  profile: RuntimeProfile;
  skillSourcesRoot?: string;
  remoteCacheRepository?: SkillSourceRemoteCacheRepository;
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

function toLocalPath(candidate: string, workspaceRoot: string): string {
  if (isAbsolute(candidate)) {
    return candidate;
  }
  return resolve(workspaceRoot, candidate);
}

export class SkillSourceSyncService {
  private readonly remoteCacheRepository: SkillSourceRemoteCacheRepository;

  constructor(private readonly context: SyncContext) {
    this.remoteCacheRepository =
      context.remoteCacheRepository ??
      new RuntimeSkillSourceRemoteCacheRepository(
        context.skillSourcesRoot ??
          resolve(context.workspaceRoot, 'profile-storage', context.profile, 'skills', 'remote-sources')
      );
  }

  async syncSource(source: SkillSourceRecord): Promise<SkillSourceSyncResult> {
    if (source.discoveryMode === 'local-dir') {
      return {
        sourceId: source.id,
        status: 'skipped',
        manifestCount: 0
      };
    }

    const syncedAt = new Date().toISOString();

    try {
      const manifests = await this.fetchRemoteManifests(source);
      const normalized = manifests.map(manifest => ({
        ...manifest,
        sourceId: manifest.sourceId || source.id
      }));
      const cacheWriteResult = await this.remoteCacheRepository.write(source.id, { syncedAt, manifests: normalized });
      return {
        sourceId: source.id,
        status: 'synced',
        syncedAt,
        cacheFilePath: cacheWriteResult.cacheFilePath,
        manifestCount: normalized.length
      };
    } catch (error) {
      return {
        sourceId: source.id,
        status: 'failed',
        syncedAt,
        manifestCount: 0,
        error: error instanceof Error ? error.message : 'skill_source_sync_failed'
      };
    }
  }

  async readCachedManifests(source: SkillSourceRecord): Promise<SkillManifestRecord[]> {
    const payload = await this.remoteCacheRepository.read(source.id);
    return Array.isArray(payload?.manifests) ? payload.manifests : [];
  }

  async readCachedSyncState(
    source: SkillSourceRecord
  ): Promise<Pick<SkillSourceRecord, 'lastSyncedAt' | 'healthState' | 'healthReason'>> {
    try {
      const payload = await this.remoteCacheRepository.read(source.id);
      if (!payload) {
        throw new Error('skill_source_cache_missing');
      }
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
