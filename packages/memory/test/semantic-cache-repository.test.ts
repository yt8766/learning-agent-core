import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FileSemanticCacheRepository,
  InMemorySemanticCacheRepository,
  SemanticCacheRecordSchema,
  type SemanticCacheRepository
} from '@agent/memory';

const createCacheRecord = (overrides: Partial<Parameters<SemanticCacheRepository['set']>[0]> = {}) => ({
  id: 'cache-1',
  key: 'prompt:fingerprint',
  role: 'assistant',
  modelId: 'gpt-5-codex',
  responseText: 'Use the explicit repository contract.',
  promptFingerprint: 'fingerprint-1',
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
  hitCount: 0,
  ...overrides
});

describe('semantic cache repository contract', () => {
  it('exposes a schema-first record contract', () => {
    const record = SemanticCacheRecordSchema.parse(createCacheRecord());

    expect(record.key).toBe('prompt:fingerprint');
    expect(() =>
      SemanticCacheRecordSchema.parse({
        ...createCacheRecord(),
        hitCount: -1
      })
    ).toThrow();
  });

  it('provides an ephemeral in-memory implementation without filesystem configuration', async () => {
    const repository = new InMemorySemanticCacheRepository();

    await repository.set(createCacheRecord());
    const firstHit = await repository.get('prompt:fingerprint');
    const secondHit = await repository.get('prompt:fingerprint');

    expect(firstHit?.hitCount).toBe(1);
    expect(secondHit?.hitCount).toBe(2);
    expect(await repository.get('missing')).toBeUndefined();
  });

  it('ignores malformed or schema-invalid file records instead of returning them as cache hits', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'semantic-cache-repo-'));
    const filePath = join(dir, 'semantic-cache.json');
    await writeFile(
      filePath,
      JSON.stringify(
        [
          {
            key: 'invalid:missing-required-fields',
            responseText: 'This should not be treated as a cache record.'
          },
          createCacheRecord({ id: 'cache-valid', key: 'valid:key' })
        ],
        null,
        2
      ),
      'utf8'
    );

    const repository = new FileSemanticCacheRepository(filePath);

    await expect(repository.get('invalid:missing-required-fields')).resolves.toBeUndefined();
    await expect(repository.get('valid:key')).resolves.toMatchObject({
      id: 'cache-valid',
      hitCount: 1
    });
  });
});
