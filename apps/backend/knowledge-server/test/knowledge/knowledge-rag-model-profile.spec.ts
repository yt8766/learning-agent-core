import { describe, expect, it } from 'vitest';

import { KnowledgeRagModelProfileService } from '../../src/knowledge/rag/knowledge-rag-model-profile.service';

describe('KnowledgeRagModelProfileService', () => {
  it('returns display-safe RAG model profile summaries', () => {
    const service = new KnowledgeRagModelProfileService({
      profiles: [
        {
          id: 'coding-pro',
          label: '用于编程',
          description: '更专业的回答与控制',
          useCase: 'coding',
          plannerModelId: 'planner-coding',
          answerModelId: 'answer-coding',
          embeddingModelId: 'embedding-default',
          enabled: true
        }
      ]
    });

    expect(service.listSummaries()).toEqual([
      {
        id: 'coding-pro',
        label: '用于编程',
        description: '更专业的回答与控制',
        useCase: 'coding',
        enabled: true
      }
    ]);
  });

  it('rejects disabled profiles when resolving for chat', () => {
    const service = new KnowledgeRagModelProfileService({
      profiles: [
        {
          id: 'daily-balanced',
          label: '适合日常工作',
          useCase: 'daily',
          plannerModelId: 'planner-daily',
          answerModelId: 'answer-daily',
          embeddingModelId: 'embedding-default',
          enabled: false
        }
      ]
    });

    expect(() => service.resolveEnabled('daily-balanced')).toThrow('rag_model_profile_disabled');
  });
});
