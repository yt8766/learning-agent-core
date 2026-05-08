import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '../src/contracts';
import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import { KnowledgeRagRetrievalResultSchema, RagRetrievalRuntime, type KnowledgePreRetrievalPlan } from '../src/rag';

function makePlan(overrides: Partial<KnowledgePreRetrievalPlan> = {}): KnowledgePreRetrievalPlan {
  return {
    id: 'plan-1',
    originalQuery: 'how does retrieval planning work',
    rewrittenQuery: 'retrieval runtime wrapper behavior',
    queryVariants: ['retrieval runtime wrapper behavior', 'runtime wrapper multi query'],
    selectedKnowledgeBaseIds: ['kb-runtime', 'kb-rag'],
    searchMode: 'hybrid',
    selectionReason: 'The user asks about RAG retrieval runtime behavior.',
    confidence: 0.9,
    fallbackPolicy: 'selected-only',
    routingDecisions: [],
    diagnostics: {
      planner: 'llm',
      consideredKnowledgeBaseCount: 2,
      rewriteApplied: true,
      fallbackApplied: false
    },
    ...overrides
  };
}

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  const chunkId = overrides.chunkId ?? 'chunk-1';
  const sourceId = overrides.sourceId ?? 'source-1';

  return {
    chunkId,
    documentId: overrides.documentId ?? 'doc-1',
    sourceId,
    knowledgeBaseId: overrides.knowledgeBaseId ?? 'kb-runtime',
    title: overrides.title ?? 'Runtime Guide',
    uri: overrides.uri ?? '/runtime.md',
    sourceType: overrides.sourceType ?? 'repo-docs',
    trustClass: overrides.trustClass ?? 'internal',
    content: overrides.content ?? 'retrieval runtime wrapper content',
    score: overrides.score ?? 0.9,
    citation: {
      sourceId,
      chunkId,
      title: overrides.title ?? 'Runtime Guide',
      uri: overrides.uri ?? '/runtime.md',
      sourceType: overrides.sourceType ?? 'repo-docs',
      trustClass: overrides.trustClass ?? 'internal'
    },
    ...overrides
  };
}

function makeSearchService(hitsByQuery: Record<string, RetrievalHit[]>): KnowledgeSearchService {
  return {
    search: vi.fn(async request => {
      const hits = hitsByQuery[request.query] ?? [];
      return {
        hits,
        total: hits.length
      };
    })
  };
}

function makeDiagnosticSearchService(input: {
  hits: RetrievalHit[];
  retrievalMode: 'hybrid' | 'keyword-only' | 'vector-only' | 'none';
}): KnowledgeSearchService {
  return {
    search: vi.fn(async () => ({
      hits: input.hits,
      total: input.hits.length,
      diagnostics: {
        retrievalMode: input.retrievalMode,
        enabledRetrievers: input.retrievalMode === 'keyword-only' ? ['keyword'] : ['vector'],
        failedRetrievers: [],
        fusionStrategy: 'rrf',
        prefilterApplied: false,
        candidateCount: input.hits.length
      }
    }))
  };
}

describe('RagRetrievalRuntime', () => {
  it('injects selected knowledge base ids into every search request filter', async () => {
    const searchService = makeSearchService({
      'retrieval runtime wrapper behavior': [makeHit({ chunkId: 'chunk-1', knowledgeBaseId: 'kb-runtime' })],
      'runtime wrapper multi query': [makeHit({ chunkId: 'chunk-2', knowledgeBaseId: 'kb-rag' })]
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    await runtime.retrieve(makePlan());

    expect(searchService.search).toHaveBeenCalledTimes(2);
    expect(vi.mocked(searchService.search).mock.calls.map(([request]) => request.filters?.knowledgeBaseIds)).toEqual([
      ['kb-runtime', 'kb-rag'],
      ['kb-runtime', 'kb-rag']
    ]);
  });

  it('executes plan query variants while keeping the rewritten query as the normalized main query', async () => {
    const searchService = makeSearchService({
      'retrieval runtime wrapper behavior': [makeHit({ chunkId: 'chunk-1' })],
      'runtime wrapper multi query': [makeHit({ chunkId: 'chunk-2' })]
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    const result = await runtime.retrieve(makePlan());

    expect(vi.mocked(searchService.search).mock.calls.map(([request]) => request.query)).toEqual([
      'retrieval runtime wrapper behavior',
      'runtime wrapper multi query'
    ]);
    expect(result.diagnostics?.normalizedQuery).toBe('retrieval runtime wrapper behavior');
    expect(result.diagnostics?.executedQueries).toEqual([
      'retrieval runtime wrapper behavior',
      'runtime wrapper multi query'
    ]);
    expect(result.diagnostics?.requestedSearchMode).toBe('hybrid');
    expect(result.diagnostics?.effectiveSearchMode).toBe('hybrid');
  });

  it('derives effective search mode from actual retriever diagnostics', async () => {
    const searchService = makeDiagnosticSearchService({
      hits: [makeHit({ chunkId: 'chunk-keyword' })],
      retrievalMode: 'keyword-only'
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    const result = await runtime.retrieve(makePlan({ queryVariants: ['retrieval runtime wrapper behavior'] }));

    expect(result.diagnostics?.requestedSearchMode).toBe('hybrid');
    expect(result.diagnostics?.effectiveSearchMode).toBe('keyword');
  });

  it('reports rewriteApplied from the plan and derives citations from returned hits', async () => {
    const firstHit = makeHit({ chunkId: 'chunk-1', title: 'First Guide' });
    const secondHit = makeHit({ chunkId: 'chunk-2', title: 'Second Guide' });
    const searchService = makeSearchService({
      'retrieval runtime wrapper behavior': [firstHit],
      'runtime wrapper multi query': [secondHit]
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    const result = await runtime.retrieve(makePlan());

    expect(result.diagnostics?.rewriteApplied).toBe(true);
    expect(result.citations).toEqual([firstHit.citation, secondHit.citation]);
    expect(result.total).toBe(2);
    expect(result.contextBundle).toContain('First Guide');
    expect(KnowledgeRagRetrievalResultSchema.parse(result)).toMatchObject({
      total: 2,
      citations: [{ chunkId: 'chunk-1' }, { chunkId: 'chunk-2' }]
    });
  });

  it('passes context budget into context assembly options', async () => {
    const seenBudgets: number[] = [];
    const runtime = new RagRetrievalRuntime({
      searchService: makeSearchService({
        'retrieval runtime wrapper behavior': [
          makeHit({ chunkId: 'budgeted', title: 'Budgeted', content: 'content '.repeat(200), score: 0.95 })
        ]
      }),
      pipeline: {
        contextAssembler: {
          async assemble(_hits, _request, options) {
            seenBudgets.push(options?.budget?.maxContextTokens ?? 0);
            return {
              contextBundle: 'assembled',
              diagnostics: {
                strategy: 'budget-probe',
                budgetTokens: options?.budget?.maxContextTokens,
                estimatedTokens: 1,
                selectedHitIds: ['budgeted'],
                droppedHitIds: [],
                truncatedHitIds: [],
                orderingStrategy: 'ranked'
              }
            };
          }
        }
      }
    });

    await runtime.retrieve(
      makePlan({
        queryVariants: ['retrieval runtime wrapper behavior'],
        strategyHints: { topK: 1, contextBudgetTokens: 1234 }
      })
    );

    expect(seenBudgets).toEqual([1234]);
  });

  it('does not add an empty knowledgeBaseIds scoped filter when no knowledge bases are selected', async () => {
    const searchService = makeSearchService({
      'how does retrieval planning work': [makeHit({ chunkId: 'chunk-1' })]
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    await runtime.retrieve(
      makePlan({
        rewrittenQuery: undefined,
        queryVariants: [],
        selectedKnowledgeBaseIds: [],
        diagnostics: {
          planner: 'deterministic',
          consideredKnowledgeBaseCount: 0,
          rewriteApplied: false,
          fallbackApplied: true,
          fallbackReason: 'No selected knowledge bases.'
        }
      })
    );

    const searchRequest = vi.mocked(searchService.search).mock.calls[0]?.[0];
    expect(searchRequest).toEqual(expect.objectContaining({ query: 'how does retrieval planning work' }));
    expect(searchRequest).not.toHaveProperty('filters');
  });

  it('falls back from blank rewritten queries and deduplicates scoped knowledge base ids', async () => {
    const searchService = makeSearchService({
      'how does retrieval planning work': [makeHit({ chunkId: 'chunk-1' })]
    });
    const runtime = new RagRetrievalRuntime({ searchService });

    await runtime.retrieve(
      makePlan({
        rewrittenQuery: '   ',
        queryVariants: [' ', 'how does retrieval planning work', 'how does retrieval planning work'],
        selectedKnowledgeBaseIds: ['kb-runtime', ' ', 'kb-runtime', 'kb-rag']
      })
    );

    expect(vi.mocked(searchService.search).mock.calls.map(([request]) => request.query)).toEqual([
      'how does retrieval planning work'
    ]);
    expect(vi.mocked(searchService.search).mock.calls[0]?.[0].filters?.knowledgeBaseIds).toEqual([
      'kb-runtime',
      'kb-rag'
    ]);
  });
});
