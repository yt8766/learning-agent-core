import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { KnowledgeSettingsController } from '../../src/api/knowledge/knowledge-settings.controller';
import { KnowledgeFrontendSettingsService } from '../../src/domains/knowledge/services/knowledge-frontend-settings.service';

describe('KnowledgeSettingsController', () => {
  it('serves frontend knowledge settings projections from the unified backend', () => {
    const controller = new KnowledgeSettingsController(new KnowledgeFrontendSettingsService());

    expect(controller.listWorkspaceUsers({ keyword: 'wang' })).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: 'user_wang' })]
    });
    expect(controller.listModelProviders().items).toContainEqual(expect.objectContaining({ id: 'openai' }));
    expect(controller.getAssistantConfig()).toMatchObject({
      modelProfileId: 'daily-balanced'
    });
  });

  it('rejects invalid settings mutations through the shared core schema', () => {
    const controller = new KnowledgeSettingsController(new KnowledgeFrontendSettingsService());

    expect(() => controller.createApiKey({ name: '', permissions: ['unknown'] })).toThrow(BadRequestException);
  });
});
