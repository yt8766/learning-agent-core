import { describe, expect, it, vi } from 'vitest';

import { KnowledgeFrontendSettingsService } from '../../src/domains/knowledge/services/knowledge-frontend-settings.service';
import type { KnowledgeRepository } from '../../src/domains/knowledge/repositories/knowledge.repository';

function createService() {
  const identityUsers = {
    listUsers: vi.fn().mockResolvedValue({
      users: [
        {
          id: 'user_alice',
          username: 'alice@example.com',
          displayName: 'Alice',
          roles: ['admin'],
          status: 'enabled'
        },
        {
          id: 'user_bob',
          username: 'bob',
          displayName: 'Bob',
          roles: ['developer'],
          status: 'disabled'
        }
      ]
    })
  };
  const repository: Partial<KnowledgeRepository> = {
    listBasesForUser: vi.fn(async userId =>
      userId === 'user_alice'
        ? [
            {
              id: 'kb_1',
              name: '产品库',
              description: '',
              createdByUserId: 'user_alice',
              status: 'active',
              createdAt: '2026-05-04T07:00:00.000Z',
              updatedAt: '2026-05-04T07:00:00.000Z'
            }
          ]
        : []
    ),
    listChatConversationsForUser: vi.fn(async userId =>
      userId === 'user_alice'
        ? {
            total: 2,
            items: [
              {
                id: 'conv_2',
                userId,
                title: '最近会话',
                activeModelProfileId: 'daily-balanced',
                createdAt: '2026-05-04T07:30:00.000Z',
                updatedAt: '2026-05-04T07:45:00.000Z'
              },
              {
                id: 'conv_1',
                userId,
                title: '较早会话',
                activeModelProfileId: 'daily-balanced',
                createdAt: '2026-05-04T07:10:00.000Z',
                updatedAt: '2026-05-04T07:20:00.000Z'
              }
            ]
          }
        : { total: 0, items: [] }
    )
  };

  return {
    identityUsers,
    repository,
    service: new KnowledgeFrontendSettingsService(identityUsers as never, repository as KnowledgeRepository)
  };
}

describe('KnowledgeFrontendSettingsService', () => {
  it('lists workspace users from identity accounts with knowledge usage summary', async () => {
    const { service, identityUsers, repository } = createService();

    await expect(service.listWorkspaceUsers({ keyword: 'alice', page: '1', pageSize: '1' })).resolves.toMatchObject({
      total: 1,
      page: 1,
      pageSize: 1,
      summary: {
        totalUsers: 2,
        activeUsers: 1,
        adminUsers: 1,
        pendingUsers: 0
      },
      items: [
        expect.objectContaining({
          id: 'user_alice',
          name: 'Alice',
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
          kbAccessCount: 1,
          queryCount: 2,
          lastActiveAt: '2026-05-04T07:45:00.000Z'
        })
      ]
    });
    expect(identityUsers.listUsers).toHaveBeenCalledTimes(1);
    expect(repository.listBasesForUser).toHaveBeenCalledWith('user_alice');
    expect(repository.listChatConversationsForUser).toHaveBeenCalledWith('user_alice');
  });

  it('projects non-email identity usernames to a stable workspace email instead of using sample users', async () => {
    const { service } = createService();

    const result = await service.listWorkspaceUsers({ keyword: 'bob' });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'user_bob',
        email: 'bob@identity.local',
        role: 'editor',
        status: 'inactive'
      })
    ]);
    expect(result.items).not.toContainEqual(expect.objectContaining({ id: 'user_zhang' }));
  });

  it('creates API keys without exposing the plain secret', () => {
    const { service } = createService();

    const result = service.createApiKey({
      name: 'CI key',
      permissions: ['knowledge:read'],
      expiresAt: '2026-06-01T00:00:00.000Z'
    });

    expect(result.apiKey).toMatchObject({
      name: 'CI key',
      maskedKey: expect.stringMatching(/^sk-kno\.\.\..+$/),
      permissions: ['knowledge:read'],
      expiresAt: '2026-06-01T00:00:00.000Z'
    });
    expect(result.apiKey).not.toHaveProperty('secret');
  });

  it('patches assistant and security settings independently', () => {
    const { service } = createService();

    expect(service.patchAssistantConfig({ webSearchEnabled: true })).toMatchObject({
      webSearchEnabled: true,
      deepThinkEnabled: true
    });
    expect(service.patchSecuritySettings({ mfaRequired: true })).toMatchObject({
      mfaRequired: true,
      ssoEnabled: true
    });
  });
});
