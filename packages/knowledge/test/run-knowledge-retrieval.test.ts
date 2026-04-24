import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit, RetrievalRequest } from '@agent/core';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import type { QueryNormalizer } from '../src/runtime/stages/query-normalizer';
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

function makeSearchService(hits: RetrievalHit[] | Record<string, RetrievalHit[]>): KnowledgeSearchService {
  return {
    search: vi.fn(async request => {
      const matchedHits = Array.isArray(hits) ? hits : (hits[request.query] ?? []);
      return {
        hits: matchedHits,
        total: matchedHits.length
      };
    })
  };
}

function makeNormalizedRequest(
  request: RetrievalRequest,
  overrides: Partial<NormalizedRetrievalRequest> = {}
): NormalizedRetrievalRequest {
  const normalizedQuery = overrides.normalizedQuery ?? request.query.trim();
  const queryVariants = overrides.queryVariants ?? [normalizedQuery];

  return {
    ...request,
    originalQuery: overrides.originalQuery ?? request.query,
    normalizedQuery,
    topK: overrides.topK ?? request.limit ?? 5,
    rewriteApplied: overrides.rewriteApplied ?? queryVariants.length > 1,
    rewriteReason: overrides.rewriteReason,
    queryVariants,
    ...overrides
  };
}

function makeSingleVariantNormalizer(): QueryNormalizer {
  return {
    normalize: async request =>
      makeNormalizedRequest(request, {
        normalizedQuery: request.query.trim(),
        queryVariants: [request.query.trim()],
        rewriteApplied: false,
        rewriteReason: undefined
      })
  };
}

function makeVariantNormalizer(queryVariants: string[], rewriteReason = 'expanded query variants'): QueryNormalizer {
  return {
    normalize: async request =>
      makeNormalizedRequest(request, {
        normalizedQuery: queryVariants[0] ?? request.query.trim(),
        queryVariants,
        rewriteApplied: queryVariants.length > 1,
        rewriteReason: queryVariants.length > 1 ? rewriteReason : undefined
      })
  };
}

const baseRequest: RetrievalRequest = { query: 'retrieval pipeline' };

describe('runKnowledgeRetrieval', () => {
  it('returns processed hits and total', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.hits).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hits[0]?.chunkId).toBe('chunk-1');
  });

  it('normalizes the query before searching', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');

    await runKnowledgeRetrieval({
      request: { query: '  spaced query  ' },
      searchService,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'spaced query' }));
  });

  it('applies post-processing to filter low-score hits', async () => {
    const hits = [makeHit({ score: 0.9 }), makeHit({ chunkId: 'chunk-2', score: 0 })];
    const searchService = makeSearchService(hits);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.score).toBe(0.9);
  });

  it('assembles context bundle when assembleContext is true', async () => {
    const searchService = makeSearchService([makeHit({ title: 'Guide', content: 'relevant text' })]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      assembleContext: true,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.contextBundle).toContain('Guide');
    expect(result.contextBundle).toContain('relevant text');
  });

  it('omits contextBundle when assembleContext is false (default)', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.contextBundle).toBeUndefined();
  });

  it('includes rewrite metadata and query execution diagnostics when includeDiagnostics is true', async () => {
    const searchService = makeSearchService([makeHit()]);

    const result = await runKnowledgeRetrieval({
      request: { query: '  retrieval pipeline  ' },
      searchService,
      includeDiagnostics: true,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.originalQuery).toBe('  retrieval pipeline  ');
    expect(result.diagnostics?.normalizedQuery).toBe('retrieval pipeline');
    expect(result.diagnostics?.rewriteApplied).toBe(false);
    expect(result.diagnostics?.rewriteReason).toBeUndefined();
    expect(result.diagnostics?.queryVariants).toEqual(['retrieval pipeline']);
    expect(result.diagnostics?.executedQueries).toEqual(['retrieval pipeline']);
    expect(result.diagnostics?.postHitCount).toBe(1);
    expect(result.diagnostics?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fans out across query variants and merges duplicate chunk hits by chunkId', async () => {
    const searchService = makeSearchService({
      'knowledge retrieval': [
        makeHit({
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          title: 'Primary Guide',
          content: 'primary content',
          score: 0.55
        }),
        makeHit({
          chunkId: 'chunk-2',
          documentId: 'doc-2',
          title: 'Primary Context',
          content: 'context from primary pass',
          score: 0.4
        })
      ],
      'retrieval knowledge': [
        makeHit({
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          title: 'Rewritten Guide',
          content: 'better score from rewritten pass',
          score: 0.9
        }),
        makeHit({
          chunkId: 'chunk-3',
          documentId: 'doc-3',
          title: 'Alternate Context',
          content: 'context from secondary pass',
          score: 0.7
        })
      ]
    });
    const spy = vi.spyOn(searchService, 'search');

    const result = await runKnowledgeRetrieval({
      request: { query: '  knowledge retrieval  ' },
      searchService,
      assembleContext: true,
      includeDiagnostics: true,
      pipeline: {
        queryNormalizer: makeVariantNormalizer(['knowledge retrieval', 'retrieval knowledge'])
      }
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map(([request]) => request.query)).toEqual(['knowledge retrieval', 'retrieval knowledge']);
    expect(result.hits).toHaveLength(3);
    expect(new Set(result.hits.map(hit => hit.chunkId)).size).toBe(result.hits.length);
    expect(result.hits.find(hit => hit.chunkId === 'chunk-1')?.score).toBe(0.9);
    expect(result.total).toBe(3);
    expect(result.contextBundle).toEqual(expect.any(String));
    expect(result.diagnostics?.originalQuery).toBe('  knowledge retrieval  ');
    expect(result.diagnostics?.rewriteApplied).toBe(true);
    expect(result.diagnostics?.rewriteReason).toBe('expanded query variants');
    expect(result.diagnostics?.queryVariants).toEqual(['knowledge retrieval', 'retrieval knowledge']);
    expect(result.diagnostics?.executedQueries).toEqual(['knowledge retrieval', 'retrieval knowledge']);
  });

  it('respects custom queryNormalizer', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');
    const customNormalizer: QueryNormalizer = {
      normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> =>
        makeNormalizedRequest(req, {
          normalizedQuery: 'custom-normalized',
          queryVariants: ['custom-normalized'],
          rewriteApplied: false
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
      process: async (processedHits: RetrievalHit[]): Promise<RetrievalHit[]> => processedHits.slice(0, 1)
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        postProcessor: customPostProcessor
      }
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
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        contextAssembler: customAssembler
      }
    });

    expect(result.contextBundle).toBe('custom context bundle');
  });
});
