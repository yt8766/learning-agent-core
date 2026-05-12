import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  KnowledgeSettingsController,
  KnowledgeWorkspaceController,
  KnowledgeChatSettingsController
} from '../../src/api/knowledge/knowledge-settings.controller';

describe('KnowledgeWorkspaceController', () => {
  const createController = () => {
    const settings = {
      listWorkspaceUsers: vi.fn().mockReturnValue({
        items: [{ id: 'u-1', name: 'Test User' }],
        total: 1,
        page: 1,
        pageSize: 20,
        summary: { totalUsers: 1, activeUsers: 1, adminUsers: 0, pendingUsers: 0 }
      }),
      createWorkspaceInvitation: vi.fn().mockReturnValue({
        invitationIds: ['inv-1'],
        invitedUsers: [],
        inviteLink: 'https://example.com/invite',
        expiresAt: '2026-06-01T00:00:00.000Z'
      })
    };
    return { controller: new KnowledgeWorkspaceController(settings as never), settings };
  };

  it('listWorkspaceUsers delegates to service', () => {
    const { controller, settings } = createController();

    const result = controller.listWorkspaceUsers({ keyword: 'test' });

    expect(result.items).toHaveLength(1);
    expect(settings.listWorkspaceUsers).toHaveBeenCalledWith({ keyword: 'test' });
  });

  it('createWorkspaceInvitation parses body and delegates', () => {
    const { controller, settings } = createController();

    const result = controller.createWorkspaceInvitation({
      emails: ['test@example.com'],
      role: 'viewer',
      department: 'Engineering'
    });

    expect(result.invitationIds).toEqual(['inv-1']);
    expect(settings.createWorkspaceInvitation).toHaveBeenCalled();
  });

  it('createWorkspaceInvitation throws BadRequestException for invalid body', () => {
    const { controller } = createController();

    expect(() => controller.createWorkspaceInvitation(null)).toThrow(BadRequestException);
  });
});

describe('KnowledgeSettingsController', () => {
  const createController = () => {
    const settings = {
      listModelProviders: vi.fn().mockReturnValue({ items: [], updatedAt: '2026-05-04T08:00:00.000Z' }),
      listApiKeys: vi.fn().mockReturnValue({ items: [] }),
      createApiKey: vi.fn().mockReturnValue({ apiKey: { id: 'key-1', name: 'Test Key' } }),
      listStorageSettings: vi
        .fn()
        .mockReturnValue({ buckets: [], knowledgeBases: [], updatedAt: '2026-05-04T08:00:00.000Z' }),
      getSecuritySettings: vi.fn().mockReturnValue({ ssoEnabled: true }),
      patchSecuritySettings: vi.fn().mockReturnValue({ ssoEnabled: false })
    };
    return { controller: new KnowledgeSettingsController(settings as never), settings };
  };

  it('listModelProviders delegates to service', () => {
    const { controller, settings } = createController();

    controller.listModelProviders();

    expect(settings.listModelProviders).toHaveBeenCalled();
  });

  it('listApiKeys delegates to service', () => {
    const { controller, settings } = createController();

    controller.listApiKeys();

    expect(settings.listApiKeys).toHaveBeenCalled();
  });

  it('createApiKey parses body and delegates', () => {
    const { controller, settings } = createController();

    const result = controller.createApiKey({
      name: 'Test Key',
      permissions: ['knowledge:read']
    });

    expect(result.apiKey.id).toBe('key-1');
    expect(settings.createApiKey).toHaveBeenCalled();
  });

  it('createApiKey throws BadRequestException for invalid body', () => {
    const { controller } = createController();

    expect(() => controller.createApiKey(null)).toThrow(BadRequestException);
  });

  it('listStorageSettings delegates to service', () => {
    const { controller, settings } = createController();

    controller.listStorageSettings();

    expect(settings.listStorageSettings).toHaveBeenCalled();
  });

  it('getSecuritySettings delegates to service', () => {
    const { controller, settings } = createController();

    controller.getSecuritySettings();

    expect(settings.getSecuritySettings).toHaveBeenCalled();
  });

  it('patchSecuritySettings parses body and delegates', () => {
    const { controller, settings } = createController();

    const result = controller.patchSecuritySettings({ ssoEnabled: false });

    expect(result.ssoEnabled).toBe(false);
    expect(settings.patchSecuritySettings).toHaveBeenCalled();
  });

  it('patchSecuritySettings throws BadRequestException for invalid body', () => {
    const { controller } = createController();

    expect(() => controller.patchSecuritySettings(null)).toThrow(BadRequestException);
  });
});

describe('KnowledgeChatSettingsController', () => {
  const createController = () => {
    const settings = {
      getAssistantConfig: vi.fn().mockReturnValue({ deepThinkEnabled: true }),
      patchAssistantConfig: vi.fn().mockReturnValue({ deepThinkEnabled: false })
    };
    return { controller: new KnowledgeChatSettingsController(settings as never), settings };
  };

  it('getAssistantConfig delegates to service', () => {
    const { controller, settings } = createController();

    controller.getAssistantConfig();

    expect(settings.getAssistantConfig).toHaveBeenCalled();
  });

  it('patchAssistantConfig parses body and delegates', () => {
    const { controller, settings } = createController();

    const result = controller.patchAssistantConfig({ deepThinkEnabled: false });

    expect(result.deepThinkEnabled).toBe(false);
    expect(settings.patchAssistantConfig).toHaveBeenCalled();
  });

  it('patchAssistantConfig throws BadRequestException for invalid body', () => {
    const { controller } = createController();

    expect(() => controller.patchAssistantConfig(null)).toThrow(BadRequestException);
  });
});
