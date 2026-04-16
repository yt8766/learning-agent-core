import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { FileUserProfileRepository } from '@agent/memory';

describe('FileUserProfileRepository', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('patch preserves createdAt while applying the latest updatedAt and patch fields', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'user-profile-repository-'));
    const repository = new FileUserProfileRepository(join(tempDir, 'profiles.json'));

    const created = await repository.patch('user-1', {
      communicationStyle: 'concise',
      updatedAt: '2026-04-16T00:00:00.000Z'
    });
    const updated = await repository.patch('user-1', {
      doNotDo: ['auto-commit'],
      privacyFlags: ['mask-secrets'],
      updatedAt: '2026-04-16T01:00:00.000Z'
    });

    expect(created.createdAt).toBe('2026-04-16T00:00:00.000Z');
    expect(updated.createdAt).toBe('2026-04-16T00:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-04-16T01:00:00.000Z');
    expect(updated.communicationStyle).toBe('concise');
    expect(updated.doNotDo).toEqual(['auto-commit']);
    expect(updated.privacyFlags).toEqual(['mask-secrets']);
  });
});
