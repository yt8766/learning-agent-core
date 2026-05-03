import { describe, expect, it } from 'vitest';

import type { KnowledgeBaseRoutingCandidate, KnowledgeRagPolicy, KnowledgeStructuredPlannerProvider } from '../src';
import {
  DefaultPreRetrievalPlanner,
  KnowledgePreRetrievalPlanSchema,
  KnowledgeStructuredPlannerProviderResultSchema
} from '../src';

const policy: KnowledgeRagPolicy = {
  maxSelectedKnowledgeBases: 2,
  minPlannerConfidence: 0.65,
  defaultSearchMode: 'hybrid',
  fallbackWhenPlannerFails: 'search-all-accessible',
  fallbackWhenLowConfidence: 'expand-to-top-n',
  maxQueryVariants: 3,
  retrievalTopK: 8,
  contextBudgetTokens: 6000,
  requireGroundedCitations: true,
  noAnswer: {
    minHitCount: 1,
    allowAnswerWithoutCitation: false,
    responseStyle: 'explicit-insufficient-evidence'
  }
};

const candidates: KnowledgeBaseRoutingCandidate[] = [
  {
    id: 'kb_runtime',
    name: 'Runtime',
    description: 'Runtime graph and interrupt docs',
    tags: ['runtime'],
    documentCount: 12,
    recentDocumentTitles: []
  },
  {
    id: 'kb_rag',
    name: 'RAG',
    description: 'RAG planner and retrieval docs',
    tags: ['rag'],
    documentCount: 7,
    recentDocumentTitles: []
  },
  {
    id: 'kb_admin',
    name: 'Admin',
    description: 'Admin console docs',
    tags: ['admin'],
    documentCount: 3,
    recentDocumentTitles: []
  }
];

function providerReturning(
  plan: Awaited<ReturnType<KnowledgeStructuredPlannerProvider['plan']>>
): KnowledgeStructuredPlannerProvider {
  return {
    async plan() {
      return plan;
    }
  };
}

describe('DefaultPreRetrievalPlanner', () => {
  it('passes conversation context to the LLM planner provider', async () => {
    let providerInput: Parameters<KnowledgeStructuredPlannerProvider['plan']>[0] | undefined;
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'conversation',
      provider: {
        async plan(input) {
          providerInput = input;
          return {
            queryVariants: ['runtime'],
            selectedKnowledgeBaseIds: ['kb_runtime'],
            searchMode: 'hybrid',
            selectionReason: 'conversation mentions runtime',
            confidence: 0.8
          };
        }
      }
    });

    await planner.plan({
      query: '继续刚才的问题',
      conversation: {
        summary: '用户在问 runtime interrupt',
        recentMessages: [{ role: 'user', content: 'interrupt 怎么恢复' }]
      },
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(providerInput).toMatchObject({
      conversation: {
        summary: '用户在问 runtime interrupt',
        recentMessages: [{ role: 'user', content: 'interrupt 怎么恢复' }]
      }
    });
  });

  it('uses a normal LLM plan when selected knowledge bases are accessible', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'normal',
      provider: providerReturning({
        rewrittenQuery: 'LangGraph interrupt resume semantics',
        queryVariants: ['LangGraph interrupt', 'resume semantics'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'vector-only',
        selectionReason: 'Runtime docs cover graph interrupts',
        confidence: 0.91,
        routingDecisions: [
          {
            knowledgeBaseId: 'kb_runtime',
            selected: true,
            source: 'llm',
            reason: 'mentions interrupts',
            confidence: 0.91
          }
        ]
      })
    });

    const plan = await planner.plan({
      query: 'interrupt 怎么恢复',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.id).toMatch(/^plan_\d+_normal$/);
    expect(KnowledgePreRetrievalPlanSchema.parse(plan)).toMatchObject({
      originalQuery: 'interrupt 怎么恢复',
      rewrittenQuery: 'LangGraph interrupt resume semantics',
      queryVariants: ['LangGraph interrupt', 'resume semantics'],
      selectedKnowledgeBaseIds: ['kb_runtime'],
      searchMode: 'vector-only',
      confidence: 0.91,
      diagnostics: {
        planner: 'llm',
        fallbackApplied: false,
        consideredKnowledgeBaseCount: 3
      }
    });
  });

  it('falls back when the LLM selects inaccessible knowledge bases', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'inaccessible',
      provider: providerReturning({
        queryVariants: ['rag planner'],
        selectedKnowledgeBaseIds: ['kb_secret'],
        searchMode: 'hybrid',
        selectionReason: 'secret match',
        confidence: 0.88
      })
    });

    const plan = await planner.plan({
      query: 'planner 怎么选知识库',
      accessibleKnowledgeBases: candidates.slice(0, 2),
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_runtime', 'kb_rag']);
    expect(plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'no-accessible-llm-selection',
      metadata: {
        providerConfidence: 0.88,
        providerSelectionReason: 'secret match',
        providerSelectedKnowledgeBaseIds: ['kb_secret'],
        invalidSelectedKnowledgeBaseIds: ['kb_secret']
      }
    });
    expect(plan.routingDecisions.map(decision => decision.knowledgeBaseId)).toEqual(['kb_runtime', 'kb_rag']);
    expect(plan.routingDecisions.every(decision => decision.source === 'fallback')).toBe(true);
  });

  it('falls back when the provider throws', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'throws',
      provider: {
        async plan() {
          throw new Error('provider unavailable');
        }
      }
    });

    const plan = await planner.plan({
      query: 'admin policy',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_runtime', 'kb_rag']);
    expect(plan.selectionReason).toContain('provider unavailable');
    expect(plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'planner-error'
    });
  });

  it('falls back when LLM confidence is below policy threshold', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'low-confidence',
      provider: providerReturning({
        queryVariants: ['runtime'],
        selectedKnowledgeBaseIds: ['kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'weak match',
        confidence: 0.2
      })
    });

    const plan = await planner.plan({
      query: 'runtime',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_runtime', 'kb_rag']);
    expect(plan.confidence).toBe(policy.minPlannerConfidence);
    expect(plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'low-confidence',
      metadata: {
        providerConfidence: 0.2,
        providerSelectionReason: 'weak match',
        providerSelectedKnowledgeBaseIds: ['kb_runtime']
      }
    });
  });

  it('deduplicates and caps query variants and selected ids', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'dedupe',
      provider: providerReturning({
        queryVariants: [' RAG ', 'RAG', '', 'runtime', 'admin', 'ignored'],
        selectedKnowledgeBaseIds: ['kb_rag', 'kb_rag', 'kb_runtime', 'kb_admin'],
        searchMode: 'keyword-only',
        selectionReason: 'multiple matches',
        confidence: 0.8
      })
    });

    const plan = await planner.plan({
      query: ' RAG ',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.queryVariants).toEqual(['RAG', 'runtime', 'admin']);
    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_rag', 'kb_runtime']);
    expect(plan.diagnostics.fallbackApplied).toBe(false);
  });

  it('returns an empty fallback selection when no knowledge bases are accessible', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'empty',
      provider: providerReturning({
        queryVariants: ['secret'],
        selectedKnowledgeBaseIds: ['kb_secret'],
        searchMode: 'hybrid',
        selectionReason: 'secret match',
        confidence: 0.9
      })
    });

    const plan = await planner.plan({
      query: 'secret',
      accessibleKnowledgeBases: [],
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual([]);
    expect(plan.routingDecisions).toEqual([]);
    expect(plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'no-accessible-llm-selection'
    });
  });

  it('deduplicates fallback selections and routing decisions', async () => {
    const runtimeCandidate = candidates[0];
    const ragCandidate = candidates[1];
    expect(runtimeCandidate).toBeDefined();
    expect(ragCandidate).toBeDefined();

    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'fallback-dedupe',
      provider: {
        async plan() {
          throw new Error('provider unavailable');
        }
      }
    });

    const plan = await planner.plan({
      query: 'runtime',
      accessibleKnowledgeBases: [runtimeCandidate!, { ...runtimeCandidate! }, ragCandidate!],
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_runtime', 'kb_rag']);
    expect(plan.routingDecisions.map(decision => decision.knowledgeBaseId)).toEqual(['kb_runtime', 'kb_rag']);
  });

  it('parses provider results before building the final plan', async () => {
    expect(() =>
      KnowledgeStructuredPlannerProviderResultSchema.parse({
        selectedKnowledgeBaseIds: ['kb_runtime'],
        selectionReason: 'bad confidence',
        confidence: 2
      })
    ).toThrow();

    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'contract-error',
      provider: {
        async plan() {
          return {
            selectedKnowledgeBaseIds: ['kb_runtime'],
            selectionReason: 'bad confidence',
            confidence: 2
          } as Awaited<ReturnType<KnowledgeStructuredPlannerProvider['plan']>>;
        }
      }
    });

    const plan = await planner.plan({
      query: 'runtime',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.diagnostics).toMatchObject({
      planner: 'fallback',
      fallbackApplied: true,
      fallbackReason: 'provider-contract-error'
    });
  });

  it('keeps routing decisions aligned with the final selected ids', async () => {
    const planner = new DefaultPreRetrievalPlanner({
      idFactory: () => 'routing',
      provider: providerReturning({
        queryVariants: ['routing'],
        selectedKnowledgeBaseIds: ['kb_rag', 'kb_runtime'],
        searchMode: 'hybrid',
        selectionReason: 'multiple matches',
        confidence: 0.8,
        routingDecisions: [
          {
            knowledgeBaseId: 'kb_admin',
            selected: true,
            source: 'llm',
            reason: 'stale decision'
          },
          {
            knowledgeBaseId: 'kb_rag',
            selected: false,
            source: 'llm',
            reason: 'planner selected rag'
          },
          {
            knowledgeBaseId: 'kb_secret',
            selected: true,
            source: 'llm',
            reason: 'inaccessible'
          }
        ]
      })
    });

    const plan = await planner.plan({
      query: 'routing',
      accessibleKnowledgeBases: candidates,
      policy
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_rag', 'kb_runtime']);
    expect(plan.routingDecisions).toEqual([
      {
        knowledgeBaseId: 'kb_admin',
        selected: false,
        source: 'llm',
        reason: 'stale decision'
      },
      {
        knowledgeBaseId: 'kb_rag',
        selected: true,
        source: 'llm',
        reason: 'planner selected rag'
      },
      {
        knowledgeBaseId: 'kb_runtime',
        selected: true,
        source: 'llm',
        reason: 'Selected by structured planner provider'
      }
    ]);
  });
});
