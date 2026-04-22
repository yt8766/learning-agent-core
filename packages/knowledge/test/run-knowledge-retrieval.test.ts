import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit, RetrievalRequest } from '@agent/core';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import type { NormalizedRetrievalRequest } from '../src/runtime/types/retrieval-runtime.types';
import { runKnowledgeRetrieval } from '../src/runtime/pipeline/run-knowledge-retrieval';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Test Source',
    uri: '/test.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: 'test content about retrieval',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Test Source',
      uri: '/test.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

function makeSearchService(hits: RetrievalHit[]): KnowledgeSearchService {
  return {
    search: vi.fn().mockResolvedValue({ hits, total: hits.length })
  };
}

const baseRequest: RetrievalRequest = { query: 'retrieval pipeline' };

describe('runKnowledgeRetrieval', () => {
  it('returns processed hits and total', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({ request: baseRequest, searchService });

    expect(result.hits).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hits[0]?.chunkId).toBe('chunk-1');
  });

  it('normalizes the query before searching', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');

    await runKnowledgeRetrieval({ request: { query: '  spaced query  ' }, searchService });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'spaced query' }));
  });

  it('applies post-processing to filter low-score hits', async () => {
    const hits = [makeHit({ score: 0.9 }), makeHit({ chunkId: 'chunk-2', score: 0 })];
    const searchService = makeSearchService(hits);

    const result = await runKnowledgeRetrieval({ request: baseRequest, searchService });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.score).toBe(0.9);
  });

  it('assembles context bundle when assembleContext is true', async () => {
    const searchService = makeSearchService([makeHit({ title: 'Guide', content: 'relevant text' })]);

    const result = await runKnowledgeRetrieval({ request: baseRequest, searchService, assembleContext: true });

    expect(result.contextBundle).toContain('Guide');
    expect(result.contextBundle).toContain('relevant text');
  });

  it('omits contextBundle when assembleContext is false (default)', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({ request: baseRequest, searchService });

    expect(result.contextBundle).toBeUndefined();
  });

  it('includes diagnostics when includeDiagnostics is true', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      includeDiagnostics: true
    });

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.normalizedQuery).toBe('retrieval pipeline');
    expect(result.diagnostics?.postHitCount).toBe(1);
    expect(result.diagnostics?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('respects custom queryNormalizer', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');
    const customNormalizer = {
      normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => ({
        ...req,
        normalizedQuery: 'custom-normalized',
        topK: 3
      })
    };

    await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: { queryNormalizer: customNormalizer }
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'custom-normalized' }));
  });

  it('respects custom postProcessor', async () => {
    const hits = [makeHit({ score: 0.5 }), makeHit({ chunkId: 'chunk-2', score: 0.3 })];
    const searchService = makeSearchService(hits);
    const customPostProcessor = {
      process: async (h: RetrievalHit[]): Promise<RetrievalHit[]> => h.slice(0, 1)
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: { postProcessor: customPostProcessor }
    });

    expect(result.hits).toHaveLength(1);
  });

  it('respects custom contextAssembler', async () => {
    const searchService = makeSearchService([makeHit()]);
    const customAssembler = {
      assemble: async (): Promise<string> => 'custom context bundle'
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      assembleContext: true,
      pipeline: { contextAssembler: customAssembler }
    });

    expect(result.contextBundle).toBe('custom context bundle');
  });
});
