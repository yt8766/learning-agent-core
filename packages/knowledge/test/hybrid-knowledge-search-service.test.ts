// packages/knowledge/test/hybrid-knowledge-search-service.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';

function makeHit(chunkId: string, score: number): RetrievalHit {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: 'source-1',
    title: 'Test',
    uri: '/test.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: `content ${chunkId}`,
    score,
    citation: {
      sourceId: 'source-1',
      chunkId,
      title: 'Test',
      uri: '/test.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    }
  };
}

function makeService(hits: RetrievalHit[], failWith?: Error): KnowledgeSearchService {
  return {
    search: vi.fn(async () => {
      if (failWith) {
        throw failWith;
      }
      return { hits, total: hits.length };
    })
  };
}

describe('HybridKnowledgeSearchService', () => {
  it('calls both keyword and vector services in parallel', async () => {
    const keywordHits = [makeHit('k1', 0.9)];
    const vectorHits = [makeHit('v1', 0.8)];
    const keywordService = makeService(keywordHits);
    const vectorService = makeService(vectorHits);

    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);
    await hybrid.search({ query: 'test', limit: 5 });

    expect(keywordService.search).toHaveBeenCalledOnce();
    expect(vectorService.search).toHaveBeenCalledOnce();
  });

  it('passes same request to both services', async () => {
    const keywordService = makeService([makeHit('k1', 0.9)]);
    const vectorService = makeService([makeHit('v1', 0.8)]);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    await hybrid.search({ query: 'my query', limit: 3, allowedSourceTypes: ['repo-docs'] });

    expect(keywordService.search).toHaveBeenCalledWith({
      query: 'my query',
      limit: 3,
      allowedSourceTypes: ['repo-docs']
    });
    expect(vectorService.search).toHaveBeenCalledWith({
      query: 'my query',
      limit: 3,
      allowedSourceTypes: ['repo-docs']
    });
  });

  it('merges results with RRF and assigns new scores', async () => {
    const keywordHits = [makeHit('shared', 0.9), makeHit('k-only', 0.7)];
    const vectorHits = [makeHit('shared', 0.85), makeHit('v-only', 0.6)];
    const hybrid = new HybridKnowledgeSearchService(makeService(keywordHits), makeService(vectorHits));

    const result = await hybrid.search({ query: 'test', limit: 10 });

    expect(result.hits).toHaveLength(3); // shared, k-only, v-only
    const shared = result.hits.find(h => h.chunkId === 'shared')!;
    const kOnly = result.hits.find(h => h.chunkId === 'k-only')!;
    const vOnly = result.hits.find(h => h.chunkId === 'v-only')!;
    // shared 出现在两路，RRF 分数应高于单路
    expect(shared.score).toBeGreaterThan(kOnly.score);
    expect(shared.score).toBeGreaterThan(vOnly.score);
  });

  it('truncates to limit after RRF fusion', async () => {
    const keywordHits = [makeHit('k1', 0.9), makeHit('k2', 0.8), makeHit('k3', 0.7)];
    const vectorHits = [makeHit('v1', 0.9), makeHit('v2', 0.8), makeHit('v3', 0.7)];
    const hybrid = new HybridKnowledgeSearchService(makeService(keywordHits), makeService(vectorHits));

    const result = await hybrid.search({ query: 'test', limit: 2 });
    expect(result.hits).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('falls back to vector-only when keyword service fails', async () => {
    const vectorHits = [makeHit('v1', 0.9), makeHit('v2', 0.8)];
    const keywordService = makeService([], new Error('keyword failed'));
    const vectorService = makeService(vectorHits);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(2);
    expect(result.hits[0]!.chunkId).toBe('v1');
    expect(result.hits[1]!.chunkId).toBe('v2');
  });

  it('falls back to keyword-only when vector service fails', async () => {
    const keywordHits = [makeHit('k1', 0.9), makeHit('k2', 0.8)];
    const keywordService = makeService(keywordHits);
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(2);
    expect(result.hits.map(h => h.chunkId)).toEqual(['k1', 'k2']);
  });

  it('returns empty result when both services fail', async () => {
    const keywordService = makeService([], new Error('keyword failed'));
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects custom rrfK config', async () => {
    // 当 k=1 时，rank=1 的 RRF score = 1/(1+1) = 0.5；k=60 时 ≈ 0.0164
    const keywordHits = [makeHit('chunk', 0.9)];
    const hybridLowK = new HybridKnowledgeSearchService(makeService(keywordHits), makeService([]), { rrfK: 1 });
    const hybridHighK = new HybridKnowledgeSearchService(makeService(keywordHits), makeService([]), { rrfK: 1000 });

    const resultLowK = await hybridLowK.search({ query: 'test', limit: 5 });
    const resultHighK = await hybridHighK.search({ query: 'test', limit: 5 });

    expect(resultLowK.hits[0]!.score).toBeGreaterThan(resultHighK.hits[0]!.score);
  });
});
