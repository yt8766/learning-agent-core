import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { FileMemoryRepository } from '../src/memory-repository';

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
});
