import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  KnowledgeChatSettingsController,
  KnowledgeSettingsController,
  KnowledgeWorkspaceController
} from '../../src/api/knowledge/knowledge-settings.controller';
import { KnowledgeFrontendSettingsService } from '../../src/domains/knowledge/services/knowledge-frontend-settings.service';

describe('KnowledgeSettingsController', () => {
  it('serves frontend knowledge settings projections from the unified backend', () => {
    const settings = new KnowledgeFrontendSettingsService();
    const workspaceController = new KnowledgeWorkspaceController(settings);
    const settingsController = new KnowledgeSettingsController(settings);
    const chatController = new KnowledgeChatSettingsController(settings);

    expect(workspaceController.listWorkspaceUsers({ keyword: 'wang' })).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: 'user_wang' })]
    });
    expect(settingsController.listModelProviders().items).toContainEqual(expect.objectContaining({ id: 'openai' }));
    expect(chatController.getAssistantConfig()).toMatchObject({
      modelProfileId: 'daily-balanced'
    });
  });

  it('rejects invalid settings mutations through the shared core schema', () => {
    const controller = new KnowledgeSettingsController(new KnowledgeFrontendSettingsService());

    expect(() => controller.createApiKey({ name: '', permissions: ['unknown'] })).toThrow(BadRequestException);
  });
});
