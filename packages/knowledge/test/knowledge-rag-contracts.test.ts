import { describe, expect, it } from 'vitest';

import {
  KnowledgeBaseRoutingCandidateSchema,
  KnowledgePreRetrievalPlanSchema,
  KnowledgeRagPolicySchema,
  KnowledgeRagResultSchema,
  KnowledgeRagRunAnswerSchema,
  KnowledgeRagRunDiagnosticsSchema,
  KnowledgeRagStreamEventSchema
} from '../src';

describe('Knowledge RAG SDK contracts', () => {
  it('parses a planner policy and routing candidate', () => {
    expect(
      KnowledgeRagPolicySchema.parse({
        maxSelectedKnowledgeBases: 3,
        minPlannerConfidence: 0.65,
        defaultSearchMode: 'hybrid',
        fallbackWhenPlannerFails: 'search-all-accessible',
        fallbackWhenLowConfidence: 'expand-to-top-n',
        maxQueryVariants: 4,
        retrievalTopK: 8,
        contextBudgetTokens: 6000,
        requireGroundedCitations: true,
        noAnswer: {
          minHitCount: 1,
          allowAnswerWithoutCitation: false,
          responseStyle: 'explicit-insufficient-evidence'
        }
      })
    ).toMatchObject({ defaultSearchMode: 'hybrid' });

    expect(
      KnowledgeBaseRoutingCandidateSchema.parse({
        id: 'kb_rag',
        name: 'RAG Runtime',
        description: 'query rewrite and pre-retrieval routing',
        tags: ['rag'],
        documentCount: 2,
        recentDocumentTitles: ['Knowledge RAG SDK Runtime Architecture'],
        domainSummary: 'RAG planner, retrieval runtime, answer runtime',
        updatedAt: '2026-05-03T00:00:00.000Z'
      })
    ).toMatchObject({ id: 'kb_rag' });
  });

  it('parses a final result and stream completion event', () => {
    const plan = KnowledgePreRetrievalPlanSchema.parse({
      id: 'plan_1',
      originalQuery: '检索前有什么',
      rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
      queryVariants: ['RAG 检索前阶段', 'pre-retrieval planner'],
      selectedKnowledgeBaseIds: ['kb_rag'],
      searchMode: 'hybrid',
      selectionReason: '用户询问检索前阶段',
      confidence: 0.86,
      fallbackPolicy: 'expand-to-top-n',
      routingDecisions: [
        {
          knowledgeBaseId: 'kb_rag',
          selected: true,
          source: 'llm',
          reason: 'contains pre-retrieval planning'
        }
      ],
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: 1,
        rewriteApplied: true,
        fallbackApplied: false
      }
    });

    const result = KnowledgeRagResultSchema.parse({
      runId: 'rag_1',
      plan,
      retrieval: {
        hits: [],
        total: 0,
        citations: [],
        diagnostics: {
          runId: 'retrieval_1',
          startedAt: '2026-05-03T00:00:00.000Z',
          durationMs: 1,
          originalQuery: '检索前有什么',
          normalizedQuery: 'RAG 检索前阶段包括哪些能力',
          rewriteApplied: true,
          queryVariants: ['RAG 检索前阶段'],
          executedQueries: ['RAG 检索前阶段'],
          preHitCount: 0,
          postHitCount: 0,
          contextAssembled: false
        }
      },
      answer: {
        text: '未在当前知识库中找到足够依据。',
        noAnswer: true,
        citations: [],
        diagnostics: {
          durationMs: 1,
          groundedCitationCount: 0,
          noAnswerReason: 'no_hits'
        }
      },
      diagnostics: {
        durationMs: 3,
        plannerDurationMs: 1,
        retrievalDurationMs: 1,
        answerDurationMs: 1
      }
    });

    expect(KnowledgeRagStreamEventSchema.parse({ type: 'rag.completed', runId: 'rag_1', result })).toEqual({
      type: 'rag.completed',
      runId: 'rag_1',
      result
    });
  });

  it('parses mature RAG diagnostics with executed retrieval queries', () => {
    const resultProjection = {
      runId: 'rag_run_1',
      plan: {
        id: 'plan_1',
        originalQuery: '检索前技术名词',
        rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
        queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
        selectedKnowledgeBaseIds: ['kb_core'],
        searchMode: 'hybrid',
        selectionReason: 'Selected SDK knowledge base',
        confidence: 0.86,
        fallbackPolicy: 'search-all-accessible',
        routingDecisions: [{ knowledgeBaseId: 'kb_core', selected: true, source: 'llm', reason: 'SDK terms matched' }],
        diagnostics: {
          planner: 'llm',
          consideredKnowledgeBaseCount: 1,
          rewriteApplied: true,
          fallbackApplied: false,
          durationMs: 12
        }
      },
      retrieval: {
        hits: [],
        citations: [],
        diagnostics: {
          normalizedQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
          queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
          executedQueries: [
            { query: 'PreRetrievalPlanner query rewrite', mode: 'vector', hitCount: 2 },
            { query: '检索前规划 查询改写 查询变体', mode: 'keyword', hitCount: 1, fallbackReason: 'vector-no-hit' }
          ],
          effectiveSearchMode: 'hybrid',
          vectorHitCount: 2,
          keywordHitCount: 1,
          finalHitCount: 3
        }
      },
      answer: {
        text: '依据不足。',
        citations: [],
        diagnostics: {
          provider: 'openai-compatible',
          model: 'knowledge-answer',
          durationMs: 30
        }
      },
      diagnostics: {
        durationMs: 50
      }
    };

    const parsed = KnowledgeRagResultSchema.parse(resultProjection);
    const retrievalCompleted = KnowledgeRagStreamEventSchema.parse({
      type: 'retrieval.completed',
      runId: 'rag_run_1',
      retrieval: resultProjection.retrieval
    });
    const ragCompleted = KnowledgeRagStreamEventSchema.parse({
      type: 'rag.completed',
      runId: 'rag_run_1',
      result: resultProjection
    });

    expect(parsed.retrieval.diagnostics?.executedQueries).toHaveLength(2);
    expect(parsed.retrieval.diagnostics?.effectiveSearchMode).toBe('hybrid');
    expect(retrievalCompleted).toMatchObject({
      retrieval: {
        diagnostics: {
          executedQueries: parsed.retrieval.diagnostics?.executedQueries,
          finalHitCount: 3
        }
      }
    });
    expect(ragCompleted).toMatchObject({
      result: {
        retrieval: {
          diagnostics: {
            executedQueries: parsed.retrieval.diagnostics?.executedQueries,
            finalHitCount: 3
          }
        },
        answer: {
          diagnostics: {
            provider: 'openai-compatible',
            model: 'knowledge-answer'
          }
        }
      }
    });
  });

  it('rejects empty mature retrieval diagnostics instead of materializing default arrays', () => {
    expect(
      KnowledgeRagResultSchema.safeParse({
        runId: 'rag_empty_diagnostics',
        plan: {
          id: 'plan_1',
          originalQuery: '检索前技术名词',
          rewrittenQuery: 'PreRetrievalPlanner query rewrite',
          queryVariants: ['PreRetrievalPlanner query rewrite'],
          selectedKnowledgeBaseIds: ['kb_core'],
          searchMode: 'hybrid',
          selectionReason: 'Selected SDK knowledge base',
          confidence: 0.86,
          fallbackPolicy: 'search-all-accessible',
          routingDecisions: [],
          diagnostics: {
            planner: 'llm',
            consideredKnowledgeBaseCount: 1,
            rewriteApplied: true,
            fallbackApplied: false
          }
        },
        retrieval: {
          hits: [],
          citations: [],
          diagnostics: {}
        },
        answer: {
          text: '依据不足。',
          citations: []
        },
        diagnostics: {
          durationMs: 50
        }
      }).success
    ).toBe(false);
  });

  it('keeps effective search mode on executed retrieval semantics only', () => {
    const runtimeDiagnostics = {
      runId: 'retrieval_1',
      startedAt: '2026-05-03T00:00:00.000Z',
      durationMs: 1,
      originalQuery: '检索前有什么',
      normalizedQuery: 'RAG 检索前阶段包括哪些能力',
      rewriteApplied: true,
      queryVariants: ['RAG 检索前阶段'],
      executedQueries: ['RAG 检索前阶段'],
      preHitCount: 0,
      postHitCount: 0,
      contextAssembled: false
    };

    expect(
      KnowledgeRagStreamEventSchema.safeParse({
        type: 'retrieval.completed',
        runId: 'rag_1',
        retrieval: {
          hits: [],
          total: 0,
          citations: [],
          diagnostics: {
            ...runtimeDiagnostics,
            effectiveSearchMode: 'vector-only'
          }
        }
      }).success
    ).toBe(false);

    expect(
      KnowledgeRagStreamEventSchema.safeParse({
        type: 'retrieval.completed',
        runId: 'rag_1',
        retrieval: {
          hits: [],
          total: 0,
          citations: [],
          diagnostics: {
            ...runtimeDiagnostics,
            requestedSearchMode: 'vector-only',
            effectiveSearchMode: 'vector'
          }
        }
      }).success
    ).toBe(true);
  });

  it('rejects empty or unknown-only answer diagnostics while accepting known answer fields', () => {
    const baseAnswer = {
      text: '依据不足。',
      citations: []
    };

    expect(KnowledgeRagRunAnswerSchema.safeParse({ ...baseAnswer, diagnostics: {} }).success).toBe(false);
    expect(KnowledgeRagRunAnswerSchema.safeParse({ ...baseAnswer, diagnostics: { typo: 'x' } }).success).toBe(false);
    expect(
      KnowledgeRagRunAnswerSchema.safeParse({
        ...baseAnswer,
        diagnostics: {
          provider: 'openai-compatible',
          model: 'knowledge-answer',
          durationMs: 30
        }
      }).success
    ).toBe(true);
  });

  it('validates mature effective search mode against observed retrieval hits', () => {
    expect(
      KnowledgeRagStreamEventSchema.safeParse({
        type: 'retrieval.completed',
        runId: 'rag_1',
        retrieval: {
          hits: [],
          citations: [],
          diagnostics: {
            executedQueries: [{ query: 'fallback query', mode: 'keyword', hitCount: 1 }],
            effectiveSearchMode: 'vector'
          }
        }
      }).success
    ).toBe(false);

    const validDiagnostics = [
      {
        executedQueries: [{ query: 'vector query', mode: 'vector', hitCount: 1 }],
        effectiveSearchMode: 'vector'
      },
      {
        executedQueries: [{ query: 'keyword query', mode: 'keyword', hitCount: 1 }],
        effectiveSearchMode: 'keyword'
      },
      {
        executedQueries: [{ query: 'substring fallback', mode: 'substring', hitCount: 1 }],
        effectiveSearchMode: 'fallback-keyword'
      },
      {
        vectorHitCount: 1,
        keywordHitCount: 1,
        effectiveSearchMode: 'hybrid'
      },
      {
        finalHitCount: 0,
        effectiveSearchMode: 'none'
      }
    ];

    expect(
      validDiagnostics.map(
        diagnostics =>
          KnowledgeRagStreamEventSchema.safeParse({
            type: 'retrieval.completed',
            runId: 'rag_1',
            retrieval: {
              hits: [],
              citations: [],
              diagnostics
            }
          }).success
      )
    ).toEqual([true, true, true, true, true]);
  });

  it('parses every required RAG stream event variant and rejects unrequested event names', () => {
    const plan = KnowledgePreRetrievalPlanSchema.parse({
      id: 'plan_1',
      originalQuery: '检索前有什么',
      rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
      queryVariants: ['RAG 检索前阶段', 'pre-retrieval planner'],
      selectedKnowledgeBaseIds: ['kb_rag'],
      searchMode: 'hybrid',
      selectionReason: '用户询问检索前阶段',
      confidence: 0.86,
      fallbackPolicy: 'expand-to-top-n',
      routingDecisions: [
        {
          knowledgeBaseId: 'kb_rag',
          selected: true,
          source: 'llm',
          reason: 'contains pre-retrieval planning'
        }
      ],
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: 1,
        rewriteApplied: true,
        fallbackApplied: false
      }
    });

    const retrieval = {
      hits: [],
      total: 0,
      citations: [],
      diagnostics: {
        runId: 'retrieval_1',
        startedAt: '2026-05-03T00:00:00.000Z',
        durationMs: 1,
        originalQuery: '检索前有什么',
        normalizedQuery: 'RAG 检索前阶段包括哪些能力',
        rewriteApplied: true,
        queryVariants: ['RAG 检索前阶段'],
        executedQueries: ['RAG 检索前阶段'],
        preHitCount: 0,
        postHitCount: 0,
        contextAssembled: false
      }
    };

    const answer = {
      text: '未在当前知识库中找到足够依据。',
      noAnswer: true,
      citations: [],
      diagnostics: {
        durationMs: 1,
        groundedCitationCount: 0,
        noAnswerReason: 'no_hits'
      }
    };

    const result = KnowledgeRagResultSchema.parse({
      runId: 'rag_1',
      plan,
      retrieval,
      answer,
      diagnostics: {
        durationMs: 3,
        plannerDurationMs: 1,
        retrievalDurationMs: 1,
        answerDurationMs: 1
      }
    });

    const events = [
      { type: 'rag.started', runId: 'rag_1' },
      { type: 'planner.started', runId: 'rag_1' },
      { type: 'planner.completed', runId: 'rag_1', plan },
      { type: 'retrieval.started', runId: 'rag_1', plan },
      { type: 'retrieval.completed', runId: 'rag_1', retrieval },
      { type: 'answer.started', runId: 'rag_1' },
      { type: 'answer.delta', runId: 'rag_1', delta: '未在当前知识库中找到足够依据。' },
      { type: 'answer.completed', runId: 'rag_1', answer },
      { type: 'rag.completed', runId: 'rag_1', result },
      {
        type: 'rag.error',
        runId: 'rag_1',
        error: {
          code: 'retrieval_failed',
          message: 'retrieval provider failed',
          retryable: true
        }
      }
    ];

    expect(events.map(event => KnowledgeRagStreamEventSchema.parse(event).type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'answer.delta',
      'answer.completed',
      'rag.completed',
      'rag.error'
    ]);

    expect(KnowledgeRagStreamEventSchema.safeParse({ type: 'rag.stage.started', runId: 'rag_1' }).success).toBe(false);
    expect(KnowledgeRagStreamEventSchema.safeParse({ type: 'rag.failed', runId: 'rag_1' }).success).toBe(false);
  });

  it('exports run-scoped answer and diagnostics schemas without relying on legacy root names', () => {
    expect(
      KnowledgeRagRunAnswerSchema.parse({
        text: '未在当前知识库中找到足够依据。',
        noAnswer: true,
        citations: [],
        diagnostics: {
          durationMs: 1,
          groundedCitationCount: 0,
          noAnswerReason: 'no_hits'
        }
      })
    ).toMatchObject({ noAnswer: true });

    expect(
      KnowledgeRagRunDiagnosticsSchema.parse({
        durationMs: 3,
        plannerDurationMs: 1,
        retrievalDurationMs: 1,
        answerDurationMs: 1
      })
    ).toMatchObject({ durationMs: 3 });
  });

  it('rejects non JSON-safe context expansion diagnostics in RAG retrieval diagnostics', () => {
    const plan = KnowledgePreRetrievalPlanSchema.parse({
      id: 'plan_1',
      originalQuery: '检索前有什么',
      rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
      queryVariants: ['RAG 检索前阶段'],
      selectedKnowledgeBaseIds: ['kb_rag'],
      searchMode: 'hybrid',
      selectionReason: '用户询问检索前阶段',
      confidence: 0.86,
      fallbackPolicy: 'expand-to-top-n',
      routingDecisions: [],
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: 1,
        rewriteApplied: true,
        fallbackApplied: false
      }
    });

    const baseResult = {
      runId: 'rag_1',
      plan,
      retrieval: {
        hits: [],
        total: 0,
        citations: [],
        diagnostics: {
          runId: 'retrieval_1',
          startedAt: '2026-05-03T00:00:00.000Z',
          durationMs: 1,
          originalQuery: '检索前有什么',
          normalizedQuery: 'RAG 检索前阶段包括哪些能力',
          rewriteApplied: true,
          queryVariants: ['RAG 检索前阶段'],
          executedQueries: ['RAG 检索前阶段'],
          preHitCount: 0,
          postHitCount: 0,
          contextAssembled: false
        }
      },
      answer: {
        text: '未在当前知识库中找到足够依据。',
        noAnswer: true,
        citations: []
      },
      diagnostics: {
        durationMs: 3
      }
    };

    expect(
      KnowledgeRagResultSchema.safeParse({
        ...baseResult,
        retrieval: {
          ...baseResult.retrieval,
          diagnostics: {
            ...baseResult.retrieval.diagnostics,
            contextExpansion: {
              enabled: true,
              seedCount: 1,
              candidateCount: 1,
              addedCount: 0,
              dedupedCount: 0,
              droppedByFilterCount: 0,
              unsafe: () => 'not json'
            }
          }
        }
      }).success
    ).toBe(false);

    expect(
      KnowledgeRagResultSchema.safeParse({
        ...baseResult,
        retrieval: {
          ...baseResult.retrieval,
          diagnostics: {
            ...baseResult.retrieval.diagnostics,
            contextExpansion: {
              enabled: true,
              seedCount: 1,
              candidateCount: 1,
              addedCount: 0,
              dedupedCount: 0,
              droppedByFilterCount: 0,
              maxExpandedHits: Symbol('not-json')
            }
          }
        }
      }).success
    ).toBe(false);
  });
});
