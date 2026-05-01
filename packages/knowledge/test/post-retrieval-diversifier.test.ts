import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalDiversifier } from '../src/runtime/defaults/default-post-retrieval-diversifier';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

const request = {
  query: '病假超过 3 天需要注意什么',
  normalizedQuery: '病假超过 3 天需要注意什么',
  topK: 3
};

describe('DefaultPostRetrievalDiversifier', () => {
  it('limits overrepresented sources while filling from other sources', async () => {
    const diversifier = new DefaultPostRetrievalDiversifier({ maxPerSource: 2, maxPerParent: 2 });

    const result = await diversifier.diversify(
      [
        makeHit({ chunkId: 'a1', sourceId: 'source-a', score: 0.95 }),
        makeHit({ chunkId: 'a2', sourceId: 'source-a', score: 0.94 }),
        makeHit({ chunkId: 'a3', sourceId: 'source-a', score: 0.93 }),
        makeHit({ chunkId: 'b1', sourceId: 'source-b', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['a1', 'a2', 'b1']);
    expect(result.diagnostics.afterCount).toBe(3);
    expect(result.diagnostics.maxPerSource).toBe(2);
  });

  it('limits duplicate parent hits and preserves order for selected hits', async () => {
    const diversifier = new DefaultPostRetrievalDiversifier({ maxPerSource: 3, maxPerParent: 1 });

    const result = await diversifier.diversify(
      [
        makeHit({ chunkId: 'p1-high', sourceId: 'source-a', score: 0.95, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'p1-low', sourceId: 'source-b', score: 0.9, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'p2', sourceId: 'source-b', score: 0.85, metadata: { parentId: 'parent-2' } })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['p1-high', 'p2']);
    expect(result.diagnostics.beforeCount).toBe(3);
    expect(result.diagnostics.afterCount).toBe(2);
  });
});
