import { describe, expect, it } from 'vitest';

import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';

describe('InMemoryVectorSearchProvider', () => {
  it('returns empty array when no chunks registered', async () => {
    const provider = new InMemoryVectorSearchProvider();
    const result = await provider.searchSimilar('anything', 5);
    expect(result).toEqual([]);
  });

  it('returns results in descending score order', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('chunk-a', 'retrieval augmented generation RAG pipeline');
    provider.register('chunk-b', 'typescript javascript programming language');
    provider.register('chunk-c', 'retrieval search query ranking relevance');

    const result = await provider.searchSimilar('retrieval pipeline', 5);
    for (let i = 1; i < result.length; i++) {
      const prevScore = result[i - 1]?.score;
      const currScore = result[i]?.score;
      if (prevScore !== undefined && currScore !== undefined) {
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
      }
    }
  });

  it('respects topK limit', async () => {
    const provider = new InMemoryVectorSearchProvider();
    for (let i = 0; i < 10; i++) {
      provider.register(`chunk-${i}`, `content about retrieval for item ${i}`);
    }
    const result = await provider.searchSimilar('retrieval', 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('places semantically similar chunk before unrelated chunk', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('relevant', 'knowledge retrieval search pipeline query');
    provider.register('unrelated', 'banana apple fruit orange mango');

    const result = await provider.searchSimilar('retrieval knowledge search', 5);
    const relevantIdx = result.findIndex(h => h.chunkId === 'relevant');
    const unrelatedIdx = result.findIndex(h => h.chunkId === 'unrelated');
    // relevant 必须排在 unrelated 前面（或 unrelated 因相似度为 0 不出现）
    expect(relevantIdx).not.toBe(-1);
    if (unrelatedIdx !== -1) {
      expect(relevantIdx).toBeLessThan(unrelatedIdx);
    }
  });

  it('scores are in range [0, 1]', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('chunk-1', 'some content for testing score range');
    const result = await provider.searchSimilar('some content', 5);
    for (const hit of result) {
      expect(hit.score).toBeGreaterThanOrEqual(0);
      expect(hit.score).toBeLessThanOrEqual(1);
    }
  });

  it('filters out zero-score results', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('matching', 'knowledge base retrieval');
    provider.register('no-match', 'xyzabc123 completely different tokens');

    const result = await provider.searchSimilar('knowledge retrieval', 5);
    for (const hit of result) {
      expect(hit.score).toBeGreaterThan(0);
    }
  });
});
