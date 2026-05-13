import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  KnowledgeChatSettingsController,
  KnowledgeSettingsController,
  KnowledgeWorkspaceController
} from '../../src/api/knowledge/knowledge-settings.controller';
import { KnowledgeFrontendSettingsService } from '../../src/domains/knowledge/services/knowledge-frontend-settings.service';
import type { KnowledgeRepository } from '../../src/domains/knowledge/repositories/knowledge.repository';

function createSettingsService() {
  return new KnowledgeFrontendSettingsService(
    {
      listUsers: vi.fn().mockResolvedValue({
        users: [
          {
            id: 'user_alice',
            username: 'alice@example.com',
            displayName: 'Alice',
            roles: ['admin'],
            status: 'enabled'
          }
        ]
      })
    } as never,
    {
      listBasesForUser: vi.fn().mockResolvedValue([]),
      listChatConversationsForUser: vi.fn().mockResolvedValue({ items: [], total: 0 })
    } as Partial<KnowledgeRepository> as KnowledgeRepository
  );
}

describe('KnowledgeSettingsController', () => {
  it('serves frontend knowledge settings projections from the unified backend', async () => {
    const settings = createSettingsService();
    const workspaceController = new KnowledgeWorkspaceController(settings);
    const settingsController = new KnowledgeSettingsController(settings);
    const chatController = new KnowledgeChatSettingsController(settings);

    await expect(workspaceController.listWorkspaceUsers({ keyword: 'alice' })).resolves.toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: 'user_alice' })]
    });
    expect(settingsController.listModelProviders().items).toContainEqual(expect.objectContaining({ id: 'openai' }));
    expect(chatController.getAssistantConfig()).toMatchObject({
      modelProfileId: 'daily-balanced'
    });
  });

  it('rejects invalid settings mutations through the shared core schema', () => {
    const controller = new KnowledgeSettingsController(createSettingsService());

    expect(() => controller.createApiKey({ name: '', permissions: ['unknown'] })).toThrow(BadRequestException);
  });
});
