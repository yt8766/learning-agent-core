import type { KnowledgeRagPolicy } from '@agent/knowledge';
import { describe, expect, it, vi } from 'vitest';

import type { RagModelProfile } from '../../src/domains/knowledge/domain/knowledge-document.types';
import {
  createKnowledgeRagPlannerProvider,
  extractPlannerJson
} from '../../src/domains/knowledge/rag/knowledge-rag-planner.provider';

describe('KnowledgeRagPlannerProvider', () => {
  it('uses the chat provider to produce schema-validated planner output', async () => {
    const chatProvider = {
      generate: vi.fn(async () => ({
        text: JSON.stringify({
          rewrittenQuery: 'query rewrite',
          queryVariants: ['query rewrite', '查询改写'],
          selectedKnowledgeBaseIds: ['kb_core'],
          searchMode: 'hybrid',
          selectionReason: 'matched SDK terms',
          confidence: 0.86
        })
      }))
    };
    const provider = createKnowledgeRagPlannerProvider({
      chatProvider,
      modelProfile: makeProfile({ plannerModelId: 'planner-model' })
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

  it('extracts planner JSON from fenced and text-wrapped model output', () => {
    expect(extractPlannerJson('```json\n{"selectedKnowledgeBaseIds":["kb_core"],"confidence":0.9}\n```')).toEqual({
      selectedKnowledgeBaseIds: ['kb_core'],
      confidence: 0.9
    });
    expect(
      extractPlannerJson('Planner result:\n{"selectedKnowledgeBaseIds":["kb_ops"],"confidence":0.8}\nDone.')
    ).toEqual({
      selectedKnowledgeBaseIds: ['kb_ops'],
      confidence: 0.8
    });
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
