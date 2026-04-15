import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { FileMemoryRepository } from '@agent/memory';

describe('FileMemoryRepository', () => {
  it('search 会过滤 quarantined memory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'memory-repo-'));
    const filePath = join(dir, 'records.jsonl');
    await writeFile(
      filePath,
      [
        JSON.stringify({
          id: 'mem-safe',
          type: 'fact',
          summary: '支付成功率要优先看入金通道健康度',
          content: 'Payment success depends on channel health.',
          tags: ['payment'],
          createdAt: '2026-03-28T00:00:00.000Z'
        }),
        JSON.stringify({
          id: 'mem-bad',
          type: 'fact',
          summary: '错误经验',
          content: 'This bad memory should be isolated.',
          tags: ['payment'],
          quarantined: true,
          quarantineReason: 'conflicts_with_official_docs',
          createdAt: '2026-03-28T00:00:00.000Z'
        })
      ].join('\n'),
      'utf8'
    );

    const repository = new FileMemoryRepository(filePath);
    const results = await repository.search('payment', 10);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('mem-safe');
  });

  it('同步调用向量索引更新钩子', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'memory-repo-hook-'));
    const filePath = join(dir, 'records.jsonl');
    const repository = new FileMemoryRepository(filePath);
    const vectorIndexRepository = {
      upsertMemory: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined)
    };
    repository.setVectorIndexRepository(vectorIndexRepository as any);

    await repository.append({
      id: 'mem-hook',
      type: 'fact',
      summary: 'runtime architecture',
      content: 'vector sync',
      tags: ['runtime'],
      createdAt: '2026-03-28T00:00:00.000Z',
      status: 'active'
    });
    const invalidated = await repository.invalidate('mem-hook', 'stale');
    const restored = invalidated ? await repository.restore('mem-hook') : undefined;

    expect(restored?.id).toBe('mem-hook');
    expect(vectorIndexRepository.upsertMemory).toHaveBeenCalledTimes(2);
    expect(vectorIndexRepository.remove).toHaveBeenCalledTimes(1);
  });
});
