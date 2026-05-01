import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit, RetrievalRequest } from '@agent/knowledge';
import type { HybridRetrievalDiagnostics } from '../src/runtime/types/retrieval-runtime.types';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import type { RetrievalRerankProvider } from '../src/runtime/stages/post-retrieval-ranker';
import type { ContextExpander } from '../src/runtime/stages/context-expander';
import type { QueryNormalizer } from '../src/runtime/stages/query-normalizer';
import type { NormalizedRetrievalRequest } from '../src/runtime/types/retrieval-runtime.types';
import { runKnowledgeRetrieval } from '../src/runtime/pipeline/run-knowledge-retrieval';
import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import { DefaultKnowledgeSearchService } from '../src/retrieval/knowledge-search-service';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';
import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';
import { VectorKnowledgeSearchService } from '../src/retrieval/vector-knowledge-search-service';

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

  it('injects a stable safety scanner into the default post-retrieval filter', async () => {
    const searchService = makeSearchService([
      makeHit({
        chunkId: 'secret',
        content: 'apiKey=hidden-value',
        citation: {
          sourceId: 'source-1',
          chunkId: 'secret',
          title: 'Test Source',
          uri: '/test.md',
          sourceType: 'repo-docs',
          trustClass: 'internal',
          quote: 'apiKey=hidden-value'
        },
        score: 0.9
      })
    ]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      includeDiagnostics: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        safetyScanner: {
          scan: async () => ({
            action: 'mask',
            maskedContent: 'apiKey=[REDACTED]'
          })
        }
      }
    });

    expect(result.hits[0]?.content).toBe('apiKey=[REDACTED]');
    expect(result.hits[0]?.citation.quote).toBe('apiKey=[REDACTED]');
    expect(result.diagnostics?.postRetrieval?.filtering.droppedCount).toBe(0);
    expect(JSON.stringify(result.diagnostics?.postRetrieval?.filtering)).not.toContain('hidden-value');
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

  it('defensively filters search hits before merging and records filtering diagnostics', async () => {
    const searchService = makeSearchService([
      makeHit({
        chunkId: 'chunk-active',
        documentId: 'doc-active',
        metadata: { status: 'active' }
      }),
      makeHit({
        chunkId: 'chunk-inactive',
        documentId: 'doc-inactive',
        metadata: { status: 'inactive' }
      })
    ]);

    const result = await runKnowledgeRetrieval({
      request: { ...baseRequest, filters: { statuses: ['active'] } },
      searchService,
      includeDiagnostics: true,
      pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.chunkId).toBe('chunk-active');
    expect(result.diagnostics?.filtering).toEqual({
      enabled: true,
      stages: [
        {
          stage: 'pre-merge-defensive',
          beforeCount: 2,
          afterCount: 1,
          droppedCount: 1
        }
      ]
    });
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

  it('runs contextExpander after postProcessor and before contextAssembler', async () => {
    const seed = makeHit({ chunkId: 'seed', content: 'seed content', score: 0.9 });
    const discarded = makeHit({ chunkId: 'discarded', content: 'discarded content', score: 0.8 });
    const neighbor = makeHit({ chunkId: 'neighbor', content: 'neighbor content', score: 0.9 });
    const searchService = makeSearchService([seed, discarded]);
    const postProcessor = {
      process: vi.fn(async (hits: RetrievalHit[]): Promise<RetrievalHit[]> => hits.slice(0, 1))
    };
    const contextExpander: ContextExpander = {
      expand: vi.fn(async hits => ({
        hits: [...hits, neighbor],
        diagnostics: {
          enabled: true,
          seedCount: hits.length,
          candidateCount: 1,
          addedCount: 1,
          dedupedCount: 0,
          droppedByFilterCount: 0
        }
      }))
    };
    const contextAssembler = {
      assemble: vi.fn(async (hits: RetrievalHit[]): Promise<string> => hits.map(hit => hit.chunkId).join('|'))
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      assembleContext: true,
      includeDiagnostics: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        postProcessor,
        contextExpander,
        contextAssembler
      }
    });

    expect(postProcessor.process).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ chunkId: 'seed' }),
        expect.objectContaining({ chunkId: 'discarded' })
      ]),
      expect.any(Object)
    );
    expect(contextExpander.expand).toHaveBeenCalledWith(
      [expect.objectContaining({ chunkId: 'seed' })],
      expect.any(Object),
      expect.any(Object)
    );
    expect(contextAssembler.assemble).toHaveBeenCalledWith(
      [expect.objectContaining({ chunkId: 'seed' }), expect.objectContaining({ chunkId: 'neighbor' })],
      expect.any(Object)
    );
    expect(result.contextBundle).toBe('seed|neighbor');
    expect(result.diagnostics?.contextExpansion).toEqual({
      enabled: true,
      seedCount: 1,
      candidateCount: 1,
      addedCount: 1,
      dedupedCount: 0,
      droppedByFilterCount: 0
    });
  });

  it('runs post-retrieval stages after merge and before legacy postProcessor and contextExpander', async () => {
    const order: string[] = [];
    const seed = makeHit({ chunkId: 'seed', score: 0.9 });
    const discarded = makeHit({ chunkId: 'discarded', score: 0.8 });
    const searchService = makeSearchService([seed, discarded]);
    const postRetrievalFilter = {
      filter: vi.fn(async (hits: RetrievalHit[]) => {
        order.push('filter');
        return {
          hits: hits.filter(hit => hit.chunkId !== 'discarded'),
          diagnostics: {
            enabled: true,
            beforeCount: hits.length,
            afterCount: 1,
            droppedCount: 1,
            reasons: { 'low-context-value': 1 }
          }
        };
      })
    };
    const postRetrievalRanker = {
      rank: vi.fn(async (hits: RetrievalHit[]) => {
        order.push('rank');
        return {
          hits,
          diagnostics: {
            enabled: true,
            strategy: 'deterministic-signals' as const,
            scoredCount: hits.length,
            signals: ['retrieval-score' as const]
          }
        };
      })
    };
    const postRetrievalDiversifier = {
      diversify: vi.fn(async (hits: RetrievalHit[]) => {
        order.push('diversify');
        return {
          hits,
          diagnostics: {
            enabled: true,
            strategy: 'source-parent-section-coverage' as const,
            beforeCount: hits.length,
            afterCount: hits.length,
            maxPerSource: 2,
            maxPerParent: 1
          }
        };
      })
    };
    const postProcessor = {
      process: vi.fn(async (hits: RetrievalHit[]) => {
        order.push('postProcessor');
        return hits;
      })
    };
    const contextExpander: ContextExpander = {
      expand: vi.fn(async hits => {
        order.push('contextExpander');
        return {
          hits,
          diagnostics: {
            enabled: true,
            seedCount: hits.length,
            candidateCount: 0,
            addedCount: 0,
            dedupedCount: 0,
            droppedByFilterCount: 0
          }
        };
      })
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      assembleContext: true,
      includeDiagnostics: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        postRetrievalFilter,
        postRetrievalRanker,
        postRetrievalDiversifier,
        postProcessor,
        contextExpander,
        contextAssembler: { assemble: async (hits: RetrievalHit[]) => hits.map(hit => hit.chunkId).join('|') }
      }
    });

    expect(order).toEqual(['filter', 'rank', 'diversify', 'postProcessor', 'contextExpander']);
    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed']);
    expect(result.contextBundle).toBe('seed');
    expect(result.diagnostics?.postRetrieval?.filtering.droppedCount).toBe(1);
  });

  it('passes pipeline rerankProvider into the default post-retrieval ranker', async () => {
    const rerankProvider: RetrievalRerankProvider = {
      rerank: vi.fn(async ({ query, hits }: { query: string; hits: RetrievalHit[] }) => {
        expect(query).toBe('retrieval pipeline');
        expect(hits.map((hit: RetrievalHit) => hit.chunkId)).toEqual(['deterministic-first', 'semantic-first']);
        return [
          { chunkId: 'semantic-first', alignmentScore: 0.98 },
          { chunkId: 'deterministic-first', alignmentScore: 0.05 }
        ];
      })
    };
    const searchService = makeSearchService([
      makeHit({
        chunkId: 'deterministic-first',
        trustClass: 'internal',
        content: 'retrieval pipeline exact deterministic content',
        score: 0.92
      }),
      makeHit({
        chunkId: 'semantic-first',
        trustClass: 'community',
        content: 'semantic explanation of retrieval orchestration',
        score: 0.45
      })
    ]);

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      includeDiagnostics: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        rerankProvider
      }
    });

    expect(rerankProvider.rerank).toHaveBeenCalledTimes(1);
    expect(result.hits.map(hit => hit.chunkId)).toEqual(['semantic-first', 'deterministic-first']);
    expect(result.diagnostics?.postRetrieval?.ranking.strategy).toBe('deterministic-signals+semantic-rerank');
    expect(result.diagnostics?.postRetrieval?.ranking.signals).toEqual(
      expect.arrayContaining(['semantic-rerank', 'alignment'])
    );
  });

  it('keeps expanded hits out of result hits while including them in contextBundle', async () => {
    const seed = makeHit({ chunkId: 'seed', content: 'seed content' });
    const neighbor = makeHit({ chunkId: 'neighbor', content: 'neighbor context' });
    const searchService = makeSearchService([seed]);
    const contextExpander: ContextExpander = {
      expand: async hits => ({
        hits: [...hits, neighbor],
        diagnostics: {
          enabled: true,
          seedCount: hits.length,
          candidateCount: 1,
          addedCount: 1,
          dedupedCount: 0,
          droppedByFilterCount: 0
        }
      })
    };
    const contextAssembler = {
      assemble: async (hits: RetrievalHit[]): Promise<string> => hits.map(hit => hit.content).join('\n')
    };

    const result = await runKnowledgeRetrieval({
      request: baseRequest,
      searchService,
      assembleContext: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        contextExpander,
        contextAssembler
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed']);
    expect(result.total).toBe(1);
    expect(result.contextBundle).toContain('neighbor context');
  });

  it('passes resolved filters to contextExpander', async () => {
    const searchService = makeSearchService([makeHit({ metadata: { status: 'active' } })]);
    const contextExpander: ContextExpander = {
      expand: vi.fn(async hits => ({
        hits,
        diagnostics: {
          enabled: true,
          seedCount: hits.length,
          candidateCount: 0,
          addedCount: 0,
          dedupedCount: 0,
          droppedByFilterCount: 0
        }
      }))
    };

    await runKnowledgeRetrieval({
      request: { ...baseRequest, filters: { statuses: ['active'] } },
      searchService,
      assembleContext: true,
      pipeline: {
        queryNormalizer: makeSingleVariantNormalizer(),
        contextExpander,
        contextAssembler: {
          assemble: async (): Promise<string> => 'context'
        }
      }
    });

    expect(contextExpander.expand).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      expect.objectContaining({
        filters: expect.objectContaining({ statuses: ['active'], searchableOnly: true })
      })
    );
  });

  describe('normalizer chain (array config)', () => {
    it('executes normalizers in order when queryNormalizer is an array', async () => {
      const callOrder: string[] = [];

      const firstNormalizer: QueryNormalizer = {
        normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => {
          callOrder.push('first');
          return makeNormalizedRequest(req, {
            normalizedQuery: 'first-normalized',
            queryVariants: ['first-normalized']
          });
        }
      };

      const secondNormalizer: QueryNormalizer = {
        normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => {
          callOrder.push('second');
          // 第二步收到的 req 是 NormalizedRetrievalRequest，normalizedQuery 已由第一步填充
          const prev = (req as NormalizedRetrievalRequest).normalizedQuery ?? req.query;
          return makeNormalizedRequest(req, {
            normalizedQuery: `${prev}-then-second`,
            queryVariants: [`${prev}-then-second`]
          });
        }
      };

      const searchService = makeSearchService([]);
      const spy = vi.spyOn(searchService, 'search');

      await runKnowledgeRetrieval({
        request: { query: 'original' },
        searchService,
        pipeline: { queryNormalizer: [firstNormalizer, secondNormalizer] }
      });

      expect(callOrder).toEqual(['first', 'second']);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'first-normalized-then-second' }));
    });

    it('falls back to DefaultQueryNormalizer when queryNormalizer is an empty array', async () => {
      const searchService = makeSearchService([]);
      const spy = vi.spyOn(searchService, 'search');

      await runKnowledgeRetrieval({
        request: { query: '  some query  ' },
        searchService,
        pipeline: { queryNormalizer: [] }
      });

      // DefaultQueryNormalizer trims whitespace
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'some query' }));
    });

    it('uses single normalizer directly when array has one element', async () => {
      const searchService = makeSearchService([]);
      const spy = vi.spyOn(searchService, 'search');

      await runKnowledgeRetrieval({
        request: { query: 'test' },
        searchService,
        pipeline: { queryNormalizer: [makeSingleVariantNormalizer()] }
      });

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'test' }));
    });
  });
});

describe('runKnowledgeRetrieval with HybridKnowledgeSearchService', () => {
  function buildHybridRuntime() {
    const source = {
      id: 'src-1',
      sourceType: 'repo-docs' as const,
      uri: '/guide.md',
      title: 'Guide',
      trustClass: 'internal' as const,
      updatedAt: '2026-04-28T00:00:00.000Z'
    };
    const chunk = {
      id: 'chunk-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'retrieval augmented generation pipeline knowledge base',
      searchable: true,
      updatedAt: '2026-04-28T00:00:00.000Z'
    };
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);

    const vectorProvider = new InMemoryVectorSearchProvider();
    vectorProvider.register(chunk.id, chunk.content);

    const keywordService = new DefaultKnowledgeSearchService(sourceRepo, chunkRepo);
    const vectorService = new VectorKnowledgeSearchService(vectorProvider, chunkRepo, sourceRepo);
    const hybridService = new HybridKnowledgeSearchService(keywordService, vectorService);

    return { hybridService };
  }

  it('runs full pipeline with hybrid search and returns hits', async () => {
    const { hybridService } = buildHybridRuntime();

    const result = await runKnowledgeRetrieval({
      request: { query: 'retrieval pipeline', limit: 5 },
      searchService: hybridService
    });

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]?.chunkId).toBe('chunk-1');
  });

  it('pipeline diagnostics are populated when hybrid search is used', async () => {
    const { hybridService } = buildHybridRuntime();

    const result = await runKnowledgeRetrieval({
      request: { query: 'knowledge base', limit: 3 },
      searchService: hybridService,
      includeDiagnostics: true
    });

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.originalQuery).toBe('knowledge base');
    expect(result.diagnostics?.executedQueries).toEqual(expect.arrayContaining(['knowledge base']));
    expect(result.diagnostics?.hybrid).toEqual({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      prefilterApplied: false,
      candidateCount: 2
    });
  });

  it('does not report single-retriever diagnostics as hybrid mode', async () => {
    const vectorOnlyDiagnostics: HybridRetrievalDiagnostics = {
      retrievalMode: 'vector-only',
      enabledRetrievers: ['vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      prefilterApplied: false,
      candidateCount: 1
    };
    const searchService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [makeHit({ chunkId: 'vector-hit', score: 0.9 })],
        total: 1,
        diagnostics: vectorOnlyDiagnostics
      }))
    };

    const result = await runKnowledgeRetrieval({
      request: { query: 'semantic only', limit: 3 },
      searchService,
      includeDiagnostics: true
    });

    expect(result.diagnostics?.hybrid).toEqual(vectorOnlyDiagnostics);
  });
});
