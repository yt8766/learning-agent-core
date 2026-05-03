import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeRagPolicy } from '@agent/knowledge';

import { createKnowledgeRagPlannerProvider } from '../../src/knowledge/rag/knowledge-rag-planner.provider';
import type { RagModelProfile } from '../../src/knowledge/domain/knowledge-document.types';

describe('Knowledge RAG planner provider', () => {
  it('uses the chat provider to produce structured planner output', async () => {
    const chatProvider = {
      generate: vi.fn(async () => ({
        text: JSON.stringify({
          rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
          queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
          selectedKnowledgeBaseIds: ['kb_core'],
          searchMode: 'hybrid',
          selectionReason: 'SDK terms matched',
          confidence: 0.86
        }),
        model: 'planner-model',
        providerId: 'test'
      }))
    };

    const provider = createKnowledgeRagPlannerProvider({
      chatProvider,
      modelProfile: makeProfile({ plannerModelId: 'planner-model' }),
      preferredKnowledgeBaseIds: []
    });

    await expect(
      provider.plan({
        query: '检索前技术名词',
        accessibleKnowledgeBases: [
          {
            id: 'kb_core',
            name: 'Knowledge SDK',
            tags: [],
            documentCount: 1,
            recentDocumentTitles: ['Knowledge SDK']
          }
        ],
        policy: makeRagPolicy(),
        metadata: {}
      })
    ).resolves.toMatchObject({
      rewrittenQuery: 'PreRetrievalPlanner query rewrite pre-retrieval routing query variants',
      queryVariants: ['PreRetrievalPlanner query rewrite', '检索前规划 查询改写 查询变体'],
      selectedKnowledgeBaseIds: ['kb_core'],
      confidence: 0.86
    });

    expect(chatProvider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'planner-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('检索前技术名词') })
        ])
      })
    );
  });
});

function makeProfile(overrides: Partial<RagModelProfile> = {}): RagModelProfile {
  return {
    id: 'coding-pro',
    label: 'Coding Pro',
    description: 'Planner test profile',
    useCase: 'coding',
    plannerModelId: 'planner-model',
    answerModelId: 'answer-model',
    embeddingModelId: 'embedding-model',
    enabled: true,
    ...overrides
  };
}

function makeRagPolicy(overrides: Partial<KnowledgeRagPolicy> = {}): KnowledgeRagPolicy {
  return {
    maxSelectedKnowledgeBases: 5,
    minPlannerConfidence: 0.5,
    defaultSearchMode: 'hybrid',
    fallbackWhenPlannerFails: 'search-all-accessible',
    fallbackWhenLowConfidence: 'search-all-accessible',
    maxQueryVariants: 3,
    retrievalTopK: 5,
    contextBudgetTokens: 4000,
    requireGroundedCitations: true,
    noAnswer: {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence'
    },
    ...overrides
  };
}
