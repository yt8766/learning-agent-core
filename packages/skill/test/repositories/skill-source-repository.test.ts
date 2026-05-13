import { describe, expect, it } from 'vitest';

import {
  InMemorySkillSourceRepository,
  InMemorySkillSourceRemoteCacheRepository,
  type SkillSourceRemoteCachePayload
} from '../../src/repositories/skill-source.repository';

describe('InMemorySkillSourceRepository', () => {
  it('returns empty list by default', async () => {
    const repo = new InMemorySkillSourceRepository();
    expect(await repo.list()).toEqual([]);
  });

  it('returns cloned copies of the initial sources', async () => {
    const sources = [{ id: 'src-1', displayName: 'Source 1', allowedProfiles: ['platform' as const] }];
    const repo = new InMemorySkillSourceRepository(sources);

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('src-1');

    // Verify cloning - mutating the result should not affect the internal state
    result[0].id = 'mutated';
    const result2 = await repo.list();
    expect(result2[0].id).toBe('src-1');
  });

  it('clones allowedProfiles array to prevent external mutation', async () => {
    const profiles = ['platform' as const, 'company' as const];
    const sources = [{ id: 'src-1', allowedProfiles: profiles }];
    const repo = new InMemorySkillSourceRepository(sources);

    const result = await repo.list();
    expect(result[0].allowedProfiles).toEqual(['platform', 'company']);

    // Mutate the returned array
    result[0].allowedProfiles?.push('personal' as any);
    const result2 = await repo.list();
    expect(result2[0].allowedProfiles).toHaveLength(2);
  });

  it('handles sources without allowedProfiles', async () => {
    const sources = [{ id: 'src-1' }];
    const repo = new InMemorySkillSourceRepository(sources);

    const result = await repo.list();
    expect(result[0].allowedProfiles).toBeUndefined();
  });
});

describe('InMemorySkillSourceRemoteCacheRepository', () => {
  const payload: SkillSourceRemoteCachePayload = {
    syncedAt: '2026-01-01T00:00:00.000Z',
    manifests: [
      {
        id: 'manifest-1',
        name: 'Test Manifest',
        description: 'A test manifest',
        sourceId: 'src-1',
        requiredCapabilities: ['cap-1'],
        metadata: { version: '1.0' }
      } as any
    ]
  };

  it('returns undefined for unknown source', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository();
    expect(await repo.read('unknown')).toBeUndefined();
  });

  it('writes and reads a cache payload', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository();
    const result = await repo.write('src-1', payload);

    expect(result.cacheFilePath).toBe('memory://remote-source-cache/src-1');

    const read = await repo.read('src-1');
    expect(read?.syncedAt).toBe(payload.syncedAt);
    expect(read?.manifests).toHaveLength(1);
  });

  it('returns cloned copies to prevent external mutation', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository({ 'src-1': payload });

    const result = await repo.read('src-1');
    result!.syncedAt = 'mutated';

    const result2 = await repo.read('src-1');
    expect(result2?.syncedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('clones manifests and their requiredCapabilities arrays', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository({ 'src-1': payload });

    const result = await repo.read('src-1');
    result!.manifests[0].requiredCapabilities.push('cap-mutated');

    const result2 = await repo.read('src-1');
    expect(result2!.manifests[0].requiredCapabilities).toEqual(['cap-1']);
  });

  it('initializes from constructor data', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository({ 'src-1': payload });

    const result = await repo.read('src-1');
    expect(result).toBeDefined();
    expect(result?.manifests[0].id).toBe('manifest-1');
  });

  it('overwrites existing cache on write', async () => {
    const repo = new InMemorySkillSourceRemoteCacheRepository();
    await repo.write('src-1', payload);

    const newPayload: SkillSourceRemoteCachePayload = {
      syncedAt: '2026-06-01T00:00:00.000Z',
      manifests: []
    };
    await repo.write('src-1', newPayload);

    const result = await repo.read('src-1');
    expect(result?.syncedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(result?.manifests).toEqual([]);
  });
});
