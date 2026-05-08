import type { SkillManifestRecord, SkillSourceRecord } from '@agent/core';

export type SkillSourceRepositoryRecord = Partial<
  Omit<SkillSourceRecord, 'enabled' | 'healthState' | 'healthReason' | 'profilePolicy'>
> &
  Pick<SkillSourceRecord, 'id'>;

export interface SkillSourceRepository {
  list(): Promise<SkillSourceRepositoryRecord[]>;
}

export interface SkillSourceRemoteCachePayload {
  syncedAt: string;
  manifests: SkillManifestRecord[];
}

export interface SkillSourceRemoteCacheWriteResult {
  cacheFilePath?: string;
}

export interface SkillSourceRemoteCacheRepository {
  write(sourceId: string, payload: SkillSourceRemoteCachePayload): Promise<SkillSourceRemoteCacheWriteResult>;
  read(sourceId: string): Promise<SkillSourceRemoteCachePayload | undefined>;
}

function cloneRemoteCachePayload(payload: SkillSourceRemoteCachePayload): SkillSourceRemoteCachePayload {
  return {
    syncedAt: payload.syncedAt,
    manifests: payload.manifests.map(manifest => ({
      ...manifest,
      requiredCapabilities: [...manifest.requiredCapabilities],
      metadata: manifest.metadata ? { ...manifest.metadata } : undefined
    }))
  };
}

function cloneSource(source: SkillSourceRepositoryRecord): SkillSourceRepositoryRecord {
  return {
    ...source,
    allowedProfiles: source.allowedProfiles ? [...source.allowedProfiles] : undefined
  };
}

export class InMemorySkillSourceRepository implements SkillSourceRepository {
  private readonly sources = new Map<string, SkillSourceRepositoryRecord>();

  constructor(sources: SkillSourceRepositoryRecord[] = []) {
    for (const source of sources) {
      this.sources.set(source.id, cloneSource(source));
    }
  }

  async list(): Promise<SkillSourceRepositoryRecord[]> {
    return Array.from(this.sources.values()).map(cloneSource);
  }
}

export class InMemorySkillSourceRemoteCacheRepository implements SkillSourceRemoteCacheRepository {
  private readonly sources = new Map<string, SkillSourceRemoteCachePayload>();

  constructor(sources: Record<string, SkillSourceRemoteCachePayload> = {}) {
    for (const [sourceId, payload] of Object.entries(sources)) {
      this.sources.set(sourceId, cloneRemoteCachePayload(payload));
    }
  }

  async write(sourceId: string, payload: SkillSourceRemoteCachePayload): Promise<SkillSourceRemoteCacheWriteResult> {
    this.sources.set(sourceId, cloneRemoteCachePayload(payload));
    return { cacheFilePath: `memory://remote-source-cache/${sourceId}` };
  }

  async read(sourceId: string): Promise<SkillSourceRemoteCachePayload | undefined> {
    const payload = this.sources.get(sourceId);
    return payload ? cloneRemoteCachePayload(payload) : undefined;
  }
}
