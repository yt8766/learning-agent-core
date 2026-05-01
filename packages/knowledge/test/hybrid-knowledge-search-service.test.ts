// packages/knowledge/test/hybrid-knowledge-search-service.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import type { KeywordRetriever, VectorRetriever } from '../src/retrieval/hybrid-retrieval-engine';
import { HybridRetrievalEngine } from '../src/retrieval/hybrid-retrieval-engine';
import { DefaultKnowledgeSearchService } from '../src/retrieval/knowledge-search-service';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';
import type { VectorSearchProvider } from '../src/retrieval/vector-search-provider';
import { VectorKnowledgeSearchService } from '../src/retrieval/vector-knowledge-search-service';
import { HybridRetrievalDiagnosticsSchema } from '../src/runtime/types/retrieval-runtime.types';

function makeHit(chunkId: string, score: number, metadata?: RetrievalHit['metadata']): RetrievalHit {
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
    metadata,
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
  it('parses hybrid diagnostics with the stable schema', () => {
    expect(
      HybridRetrievalDiagnosticsSchema.parse({
        retrievalMode: 'hybrid',
        enabledRetrievers: ['keyword', 'vector'],
        failedRetrievers: [],
        fusionStrategy: 'rrf',
        prefilterApplied: true,
        candidateCount: 2
      })
    ).toEqual({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      prefilterApplied: true,
      candidateCount: 2
    });
  });

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

  it('accepts retriever interfaces while preserving hybrid diagnostics and pre-fusion filtering', async () => {
    const keywordRetriever: KeywordRetriever = {
      id: 'keyword',
      retrieve: vi.fn(async () => ({
        hits: [makeHit('allowed', 0.9, { status: 'active' }), makeHit('blocked', 0.99, { status: 'inactive' })],
        total: 2
      }))
    };
    const vectorRetriever: VectorRetriever = {
      id: 'vector',
      retrieve: vi.fn(async () => ({
        hits: [makeHit('vector-allowed', 0.8, { status: 'active' })],
        total: 1
      }))
    };
    const engine = new HybridRetrievalEngine([keywordRetriever, vectorRetriever]);

    const result = await engine.retrieve({ query: '报销', filters: { statuses: ['active'] }, limit: 10 });

    expect(keywordRetriever.retrieve).toHaveBeenCalledWith({
      query: '报销',
      filters: { statuses: ['active'] },
      limit: 10
    });
    expect(vectorRetriever.retrieve).toHaveBeenCalledOnce();
    expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed', 'vector-allowed']);
    expect(result.diagnostics).toEqual({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      prefilterApplied: true,
      candidateCount: 2
    });
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

  it('defensively filters hits before RRF fusion', async () => {
    const allowedHit = makeHit('allowed', 0.9, { status: 'active' });
    const blockedHit = makeHit('blocked', 0.99, { status: 'inactive' });
    const keywordService = makeService([allowedHit, blockedHit]);
    const vectorService = makeService([blockedHit]);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: '报销', filters: { statuses: ['active'] }, limit: 10 });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
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

  it('records hybrid diagnostics when both retrievers succeed', async () => {
    const keywordHits = [makeHit('shared', 0.9), makeHit('keyword-only', 0.7)];
    const vectorHits = [makeHit('shared', 0.85), makeHit('vector-only', 0.6)];
    const hybrid = new HybridKnowledgeSearchService(makeService(keywordHits), makeService(vectorHits));

    const result = await hybrid.search({ query: 'test', limit: 10, allowedSourceTypes: ['repo-docs'] });

    expect(result.diagnostics).toEqual({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      prefilterApplied: true,
      candidateCount: 4
    });
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

  it('records hybrid diagnostics when one retriever fails', async () => {
    const keywordHits = [makeHit('k1', 0.9), makeHit('k2', 0.8)];
    const keywordService = makeService(keywordHits);
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });

    expect(result.diagnostics).toEqual({
      retrievalMode: 'keyword-only',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: ['vector'],
      fusionStrategy: 'rrf',
      prefilterApplied: false,
      candidateCount: 2
    });
  });

  it('records vector provider failures as keyword-only hybrid fallback', async () => {
    const source = {
      id: 'source-1',
      sourceType: 'repo-docs' as const,
      uri: '/test.md',
      title: 'Test Source',
      trustClass: 'internal' as const,
      updatedAt: '2026-04-30T00:00:00.000Z'
    };
    const chunk = {
      id: 'chunk-1',
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'hybrid retrieval keyword fallback',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z'
    };
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: async () => {
        throw new Error('vector backend unavailable');
      }
    };
    const keywordService = new DefaultKnowledgeSearchService(sourceRepo, chunkRepo);
    const vectorService = new VectorKnowledgeSearchService(vectorProvider, chunkRepo, sourceRepo);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'hybrid retrieval', limit: 5 });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk-1']);
    expect(result.diagnostics).toEqual({
      retrievalMode: 'keyword-only',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: ['vector'],
      fusionStrategy: 'rrf',
      prefilterApplied: false,
      candidateCount: 1
    });
  });

  it('returns empty result when both services fail', async () => {
    const keywordService = makeService([], new Error('keyword failed'));
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.diagnostics).toEqual({
      retrievalMode: 'none',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: ['keyword', 'vector'],
      fusionStrategy: 'rrf',
      prefilterApplied: false,
      candidateCount: 0
    });
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
