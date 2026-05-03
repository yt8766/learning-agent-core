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
});
