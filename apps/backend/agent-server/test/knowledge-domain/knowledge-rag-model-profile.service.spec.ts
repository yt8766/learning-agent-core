import { describe, expect, it } from 'vitest';

import { KnowledgeRagModelProfileService } from '../../src/domains/knowledge/services/knowledge-rag-model-profile.service';

describe('KnowledgeRagModelProfileService', () => {
  it('lists summaries and resolves the first enabled profile by default', () => {
    const service = new KnowledgeRagModelProfileService({
      profiles: [
        createProfile({ id: 'coding-pro', enabled: true }),
        createProfile({ id: 'daily-balanced', enabled: true })
      ]
    });

    expect(service.listSummaries()).toEqual([
      {
        id: 'coding-pro',
        label: 'coding-pro label',
        description: 'coding-pro description',
        useCase: 'coding',
        enabled: true
      },
      {
        id: 'daily-balanced',
        label: 'daily-balanced label',
        description: 'daily-balanced description',
        useCase: 'coding',
        enabled: true
      }
    ]);
    expect(service.resolveEnabled()).toMatchObject({ id: 'coding-pro' });
  });

  it('rejects disabled or unknown profiles', () => {
    const service = new KnowledgeRagModelProfileService({
      profiles: [createProfile({ id: 'disabled', enabled: false })]
    });

    expect(() => service.resolveEnabled('disabled')).toThrow('rag_model_profile_disabled');
    expect(() => service.resolveEnabled('missing')).toThrow('rag_model_profile_not_found');
  });
});

function createProfile(input: { id: string; enabled: boolean }) {
  return {
    id: input.id,
    label: `${input.id} label`,
    description: `${input.id} description`,
    useCase: 'coding' as const,
    plannerModelId: `${input.id}-planner`,
    answerModelId: `${input.id}-answer`,
    embeddingModelId: `${input.id}-embedding`,
    enabled: input.enabled
  };
}
