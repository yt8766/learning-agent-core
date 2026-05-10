import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '../src/contracts';
import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import {
  runKnowledgeRag,
  type KnowledgeAnswerProvider,
  type KnowledgeAnswerProviderInput,
  type KnowledgeBaseRoutingCandidate,
  type KnowledgeRagPolicy,
  type KnowledgeStructuredPlannerProvider
} from '../src/rag';
import { createInMemoryKnowledgeRagObserver, exportKnowledgeRagTrace } from '../src/observability';

const policy: KnowledgeRagPolicy = {
  maxSelectedKnowledgeBases: 2,
  minPlannerConfidence: 0.65,
  defaultSearchMode: 'hybrid',
  fallbackWhenPlannerFails: 'search-all-accessible',
  fallbackWhenLowConfidence: 'expand-to-top-n',
  maxQueryVariants: 3,
  retrievalTopK: 5,
  contextBudgetTokens: 3000,
  requireGroundedCitations: true,
  noAnswer: {
    minHitCount: 1,
    allowAnswerWithoutCitation: false,
    responseStyle: 'explicit-insufficient-evidence'
  }
};

const accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[] = [
  {
    id: 'kb_runtime',
    name: 'Runtime',
    description: 'Runtime and graph docs',
    tags: ['runtime'],
    documentCount: 4,
    recentDocumentTitles: []
  },
  {
    id: 'kb_rag',
    name: 'RAG',
    description: 'RAG docs',
    tags: ['rag'],
    documentCount: 3,
    recentDocumentTitles: []
  }
];

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  const chunkId = overrides.chunkId ?? 'chunk-1';
  const sourceId = overrides.sourceId ?? 'source-1';

  return {
    chunkId,
    documentId: overrides.documentId ?? 'doc-1',
    sourceId,
    knowledgeBaseId: overrides.knowledgeBaseId ?? 'kb_runtime',
    title: overrides.title ?? 'Runtime Guide',
    uri: overrides.uri ?? '/runtime.md',
    sourceType: overrides.sourceType ?? 'repo-docs',
    trustClass: overrides.trustClass ?? 'internal',
    content: overrides.content ?? 'RAG answers cite retrieved runtime evidence.',
    score: overrides.score ?? 0.91,
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

function makePlannerProvider(
  plan: Awaited<ReturnType<KnowledgeStructuredPlannerProvider['plan']>>,
  order?: string[]
): KnowledgeStructuredPlannerProvider {
  return {
    plan: vi.fn(async () => {
      order?.push('planner');
      return plan;
    })
  };
}

function makeSearchService(hits: RetrievalHit[], order?: string[]): KnowledgeSearchService {
  return {
    search: vi.fn(async () => {
      order?.push('retrieval');
      return {
        hits,
        total: hits.length
      };
    })
  };
}

function makeAnswerProvider(
  generate: KnowledgeAnswerProvider['generate'],
  order?: string[]
): KnowledgeAnswerProvider & { inputs: KnowledgeAnswerProviderInput[] } {
  const inputs: KnowledgeAnswerProviderInput[] = [];

  return {
    inputs,
    generate: vi.fn(async input => {
      order?.push('answer');
      inputs.push(input);
      return generate(input);
    })
  };
}

describe('runKnowledgeRag', () => {
  it('runs planner, retrieval, and answer in order with an injectable run id', async () => {
    const order: string[] = [];
    const hit = makeHit();
    const plannerProvider = makePlannerProvider(
      {
        rewrittenQuery: 'runtime rag citations',
        queryVariants: ['runtime rag citations'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Runtime docs are relevant.',
        confidence: 0.9
      },
      order
    );
    const searchService = makeSearchService([hit], order);
    const answerProvider = makeAnswerProvider(
      async input => ({ text: 'Use grounded citations.', citations: input.citations }),
      order
    );

    const result = await runKnowledgeRag({
      query: 'How should RAG cite runtime docs?',
      accessibleKnowledgeBases,
      policy,
      plannerProvider,
      searchService,
      answerProvider,
      idFactory: () => 'run-test-id'
    });

    expect(order).toEqual(['planner', 'retrieval', 'answer']);
    expect(result.runId).toBe('run-test-id');
    expect(result.answer).toMatchObject({
      text: 'Use grounded citations.',
      noAnswer: false,
      citations: [hit.citation]
    });
    expect(result.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.plannerDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.retrievalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.answerDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('records planner, retrieval, and generation in one runtime trace when an observer is provided', async () => {
    const observer = createInMemoryKnowledgeRagObserver();
    const hit = makeHit({ chunkId: 'rag-trace-hit', score: 0.95 });

    await runKnowledgeRag({
      query: 'How does traced RAG work?',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: makePlannerProvider({
        rewrittenQuery: 'traced rag runtime',
        queryVariants: ['traced rag runtime'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Runtime docs are relevant.',
        confidence: 0.91
      }),
      searchService: makeSearchService([hit]),
      answerProvider: makeAnswerProvider(async input => ({
        text: 'Trace the RAG runtime.',
        citations: input.citations
      })),
      observer,
      traceId: 'trace-rag-runtime',
      idFactory: () => 'rag-run-id'
    });

    const trace = exportKnowledgeRagTrace(observer, 'trace-rag-runtime');

    expect(trace).toMatchObject({
      traceId: 'trace-rag-runtime',
      runId: 'rag-run-id',
      operation: 'rag.run',
      status: 'succeeded',
      query: {
        text: 'How does traced RAG work?',
        normalizedText: 'traced rag runtime',
        variants: ['traced rag runtime']
      },
      generation: {
        answerId: 'rag-run-id',
        answerText: 'Trace the RAG runtime.',
        citedChunkIds: ['rag-trace-hit'],
        groundedCitationRate: 1
      }
    });
    expect(trace.events.map(event => event.name)).toEqual(
      expect.arrayContaining([
        'runtime.query.receive',
        'runtime.query.preprocess',
        'runtime.retrieval.start',
        'runtime.retrieval.complete',
        'runtime.post_retrieval.select',
        'runtime.context_assembly.complete',
        'runtime.generation.complete'
      ])
    );
    expect(trace.retrieval?.hits[0]?.chunkId).toBe('rag-trace-hit');
    expect(trace.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'runtime.duration_ms', unit: 'ms', stage: 'generation' }),
        expect.objectContaining({ name: 'runtime.planner_duration_ms', unit: 'ms', stage: 'pre-retrieval' }),
        expect.objectContaining({ name: 'retrieval.duration_ms', unit: 'ms', stage: 'retrieval' }),
        expect.objectContaining({ name: 'generation.duration_ms', unit: 'ms', stage: 'generation' }),
        expect.objectContaining({ name: 'retrieval.hit_count', value: 1, unit: 'count', stage: 'retrieval' }),
        expect.objectContaining({ name: 'retrieval.selected_count', value: 1, unit: 'count', stage: 'post-retrieval' }),
        expect.objectContaining({
          name: 'generation.grounded_citation_rate',
          value: 1,
          unit: 'ratio',
          stage: 'generation'
        })
      ])
    );
  });

  it('keeps the RAG run result even when observer hooks fail', async () => {
    const failingObserver = {
      startTrace: vi.fn(() => {
        throw new Error('observer start failed');
      }),
      recordEvent: vi.fn(() => {
        throw new Error('observer event failed');
      }),
      finishTrace: vi.fn(() => {
        throw new Error('observer finish failed');
      }),
      exportTrace: vi.fn(() => {
        throw new Error('observer export failed');
      }),
      listTraces: vi.fn(() => [])
    };

    const result = await runKnowledgeRag({
      query: 'How should observer failures behave?',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: makePlannerProvider({
        rewrittenQuery: 'observer failure isolation',
        queryVariants: ['observer failure isolation'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Runtime docs are relevant.',
        confidence: 0.91
      }),
      searchService: makeSearchService([makeHit({ chunkId: 'observer-isolated-hit' })]),
      answerProvider: makeAnswerProvider(async input => ({
        text: 'Observer failures do not fail RAG.',
        citations: input.citations
      })),
      observer: failingObserver,
      traceId: 'trace-observer-isolation',
      idFactory: () => 'observer-isolation-run'
    });

    expect(result.runId).toBe('observer-isolation-run');
    expect(result.answer.noAnswer).toBe(false);
  });

  it('keeps observer metrics bounded when answer citations contain duplicates or extra citations', async () => {
    const observer = createInMemoryKnowledgeRagObserver();
    const hit = makeHit({ chunkId: 'bounded-rate-hit', sourceId: 'bounded-rate-source' });
    const extraCitation = {
      sourceId: 'extra-source',
      chunkId: 'extra-chunk',
      title: 'Extra',
      uri: '/extra.md',
      sourceType: 'repo-docs' as const,
      trustClass: 'internal' as const
    };

    await runKnowledgeRag({
      query: 'How should traced citation rates stay bounded?',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: makePlannerProvider({
        rewrittenQuery: 'bounded citation rate',
        queryVariants: ['bounded citation rate'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Runtime docs are relevant.',
        confidence: 0.91
      }),
      searchService: makeSearchService([hit]),
      answerProvider: makeAnswerProvider(async input => ({
        text: 'Trace metrics stay bounded.',
        citations: [input.citations[0]!, input.citations[0]!, extraCitation]
      })),
      observer,
      traceId: 'trace-bounded-rate',
      idFactory: () => 'bounded-rate-run'
    });

    const trace = exportKnowledgeRagTrace(observer, 'trace-bounded-rate');

    expect(trace.generation?.groundedCitationRate).toBe(1);
    expect(trace.generation?.citedChunkIds).toEqual(['bounded-rate-hit']);
  });

  it('passes conversation context through to the planner provider', async () => {
    let plannerInput: Parameters<KnowledgeStructuredPlannerProvider['plan']>[0] | undefined;
    const plannerProvider: KnowledgeStructuredPlannerProvider = {
      plan: vi.fn(async input => {
        plannerInput = input;
        return {
          queryVariants: ['interrupt resume'],
          selectedKnowledgeBaseIds: ['kb_runtime'],
          searchMode: 'hybrid' as const,
          selectionReason: 'Conversation mentions interrupts.',
          confidence: 0.88
        };
      })
    };

    await runKnowledgeRag({
      query: '继续刚才的问题',
      conversation: {
        summary: '用户在问 runtime interrupt',
        recentMessages: [{ role: 'user', content: 'interrupt 怎么恢复' }]
      },
      accessibleKnowledgeBases,
      policy,
      plannerProvider,
      searchService: makeSearchService([makeHit()]),
      answerProvider: makeAnswerProvider(async input => ({
        text: 'Answer with citations.',
        citations: input.citations
      })),
      idFactory: () => 'conversation-run'
    });

    expect(plannerInput?.conversation).toEqual({
      summary: '用户在问 runtime interrupt',
      recentMessages: [{ role: 'user', content: 'interrupt 怎么恢复' }]
    });
  });

  it('returns no-answer without calling answerProvider when retrieval has no evidence', async () => {
    const answerProvider = makeAnswerProvider(async () => ({ text: 'should not be called' }));

    const result = await runKnowledgeRag({
      query: 'unknown topic',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: makePlannerProvider({
        queryVariants: ['unknown topic'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Try runtime docs.',
        confidence: 0.8
      }),
      searchService: makeSearchService([]),
      answerProvider,
      idFactory: () => 'no-answer-run'
    });

    expect(answerProvider.generate).not.toHaveBeenCalled();
    expect(result.answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: {
        noAnswerReason: 'no_hits'
      }
    });
  });

  it('propagates answer provider failures instead of converting them to no-answer', async () => {
    await expect(
      runKnowledgeRag({
        query: 'runtime docs',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider({
          queryVariants: ['runtime docs'],
          selectedKnowledgeBaseIds: ['kb_runtime'],
          searchMode: 'hybrid',
          selectionReason: 'Runtime docs are relevant.',
          confidence: 0.8
        }),
        searchService: makeSearchService([makeHit()]),
        answerProvider: makeAnswerProvider(async () => {
          throw new Error('answer provider unavailable');
        }),
        idFactory: () => 'answer-error-run'
      })
    ).rejects.toThrow('answer provider unavailable');
  });

  it('uses planner fallback without crashing when provider throws or violates its contract', async () => {
    const throwingPlannerProvider: KnowledgeStructuredPlannerProvider = {
      plan: vi.fn(async () => {
        throw new Error('planner unavailable');
      })
    };
    const invalidPlannerProvider: KnowledgeStructuredPlannerProvider = {
      plan: vi.fn(async () => ({ selectedKnowledgeBaseIds: ['kb_runtime'] }) as never)
    };

    const throwingResult = await runKnowledgeRag({
      query: 'runtime docs',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: throwingPlannerProvider,
      searchService: makeSearchService([makeHit()]),
      answerProvider: makeAnswerProvider(async input => ({ text: 'Fallback answer.', citations: input.citations })),
      idFactory: () => 'throwing-fallback'
    });
    const invalidResult = await runKnowledgeRag({
      query: 'runtime docs',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: invalidPlannerProvider,
      searchService: makeSearchService([makeHit()]),
      answerProvider: makeAnswerProvider(async input => ({
        text: 'Contract fallback answer.',
        citations: input.citations
      })),
      idFactory: () => 'invalid-fallback'
    });

    expect(throwingResult.plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'planner-error'
    });
    expect(invalidResult.plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'provider-contract-error'
    });
    expect(throwingResult.answer.noAnswer).toBe(false);
    expect(invalidResult.answer.noAnswer).toBe(false);
  });

  it('returns a grounded answer with real citations from retrieved hits', async () => {
    const hit = makeHit({
      chunkId: 'chunk-citation',
      sourceId: 'source-citation',
      knowledgeBaseId: 'kb_rag',
      title: 'Trustworthy RAG Contract',
      uri: '/docs/trustworthy-rag.md',
      content: 'Every answer must be grounded in retrieved citations.'
    });

    const result = await runKnowledgeRag({
      query: 'What makes an answer grounded?',
      accessibleKnowledgeBases,
      policy,
      plannerProvider: makePlannerProvider({
        rewrittenQuery: 'grounded RAG answer citations',
        queryVariants: ['grounded RAG answer citations'],
        selectedKnowledgeBaseIds: ['kb_rag'],
        searchMode: 'hybrid',
        selectionReason: 'RAG docs explain citation grounding.',
        confidence: 0.93
      }),
      searchService: makeSearchService([hit]),
      answerProvider: makeAnswerProvider(async input => ({
        text: `Grounded answers cite ${input.citations[0]?.title}.`,
        citations: input.citations
      })),
      idFactory: () => 'citation-run'
    });

    expect(result.answer).toMatchObject({
      text: 'Grounded answers cite Trustworthy RAG Contract.',
      noAnswer: false,
      citations: [hit.citation]
    });
    expect(result.retrieval.contextBundle).toContain('Every answer must be grounded');
  });

  it('wires policy context budget through planner and retrieval before answer generation', async () => {
    const seenBudgets: number[] = [];
    const answerProvider = makeAnswerProvider(async input => ({
      text: input.contextBundle,
      citations: input.citations
    }));

    const result = await runKnowledgeRag({
      query: 'How should policy budgets constrain context?',
      accessibleKnowledgeBases,
      policy: {
        ...policy,
        contextBudgetTokens: 876,
        retrievalTopK: 1
      },
      plannerProvider: makePlannerProvider({
        queryVariants: ['policy budget context'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'Runtime docs are relevant.',
        confidence: 0.9
      }),
      searchService: makeSearchService([makeHit({ content: 'Budget-aware context assembly.' })]),
      answerProvider,
      pipeline: {
        contextAssembler: {
          async assemble(hits, _request, options) {
            seenBudgets.push(options?.budget?.maxContextTokens ?? 0);
            return {
              contextBundle: hits.map(hit => hit.content).join('\n'),
              diagnostics: {
                strategy: 'budget-probe',
                budgetTokens: options?.budget?.maxContextTokens,
                estimatedTokens: 5,
                selectedHitIds: hits.map(hit => hit.chunkId),
                droppedHitIds: [],
                truncatedHitIds: [],
                orderingStrategy: 'ranked'
              }
            };
          }
        }
      },
      idFactory: () => 'budget-run'
    });

    expect(result.plan.strategyHints).toMatchObject({ topK: 1, contextBudgetTokens: 876 });
    expect(seenBudgets).toEqual([876]);
    expect(answerProvider.inputs[0]?.contextBundle).toBe('Budget-aware context assembly.');
  });
});
