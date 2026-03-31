import { describe, expect, it } from 'vitest';

import { MemoryCrossCheckService } from '../../src/memory/memory-cross-check.service';

describe('MemoryCrossCheckService', () => {
  it('quarantines unsupported strong claims without source markers', async () => {
    const service = new MemoryCrossCheckService();

    const result = await service.validate({
      id: 'mem-1',
      type: 'fact',
      summary: '这个方案必须 100% 使用单一渠道',
      content: '绝对不能调整。',
      tags: ['payment'],
      createdAt: '2026-03-28T00:00:00.000Z'
    });

    expect(result).toEqual(
      expect.objectContaining({
        shouldQuarantine: true,
        category: 'unsupported_claim',
        evidenceRefs: ['official-rule:unsupported-claim-check']
      })
    );
  });

  it('quarantines content that conflicts with local official rule patterns', async () => {
    const service = new MemoryCrossCheckService();

    const result = await service.validate({
      id: 'mem-2',
      type: 'fact',
      summary: '最新规定可以直接参考 example.com 演示网址',
      content: '这是最新版本。',
      tags: ['ops'],
      createdAt: '2026-03-28T00:00:00.000Z'
    });

    expect(result).toEqual(
      expect.objectContaining({
        shouldQuarantine: true,
        category: 'conflicts_with_official_docs',
        evidenceRefs: ['official-rule:official-docs-no-demo-urls']
      })
    );
  });
});
