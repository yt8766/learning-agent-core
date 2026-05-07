import { describe, expect, it } from 'vitest';

import { KnowledgeFrontendSettingsService } from '../../src/domains/knowledge/services/knowledge-frontend-settings.service';

describe('KnowledgeFrontendSettingsService', () => {
  it('lists workspace users with paging and summary', () => {
    const service = new KnowledgeFrontendSettingsService();

    expect(service.listWorkspaceUsers({ keyword: 'wang', page: '1', pageSize: '1' })).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 1,
      summary: {
        totalUsers: 3,
        activeUsers: 2,
        adminUsers: 1,
        pendingUsers: 1
      },
      items: [expect.objectContaining({ id: 'user_wang', email: 'wangfang@example.com' })]
    });
  });

  it('creates API keys without exposing the plain secret', () => {
    const service = new KnowledgeFrontendSettingsService();

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
    const service = new KnowledgeFrontendSettingsService();

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
