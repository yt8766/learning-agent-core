import { describe, expect, it } from 'vitest';

import { KnowledgeFrontendSettingsController } from '../../src/knowledge/knowledge-frontend-settings.controller';
import { KnowledgeFrontendSettingsService } from '../../src/knowledge/knowledge-frontend-settings.service';

describe('KnowledgeFrontendSettingsController', () => {
  it('returns workspace users for the users management page', () => {
    const controller = createController();

    expect(controller.listWorkspaceUsers({ page: '1', pageSize: '20', keyword: '张' })).toMatchObject({
      items: [expect.objectContaining({ email: expect.stringContaining('@'), role: 'admin' })],
      page: 1,
      pageSize: 20,
      summary: expect.objectContaining({
        totalUsers: expect.any(Number),
        activeUsers: expect.any(Number)
      })
    });
  });

  it('returns model, storage, security and assistant settings projections', () => {
    const controller = createController();

    const providers = controller.listModelProviders();
    expect(providers.updatedAt).toEqual(expect.any(String));
    expect(providers.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'openai', models: expect.any(Array) })])
    );
    const storage = controller.listStorageSettings();
    expect(storage.buckets).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'documents' })]));
    expect(storage.knowledgeBases).toEqual(expect.any(Array));
    expect(controller.getSecuritySettings()).toMatchObject({
      auditLogEnabled: true,
      encryption: expect.objectContaining({ enabled: true })
    });
    expect(controller.getAssistantConfig()).toMatchObject({
      quickPrompts: expect.any(Array),
      thinkingSteps: expect.any(Array)
    });
  });

  it('masks API keys and never returns plaintext secrets', () => {
    const controller = createController();

    const listed = controller.listApiKeys();
    expect(listed.items[0]).toMatchObject({
      maskedKey: expect.stringContaining('...')
    });
    expect(JSON.stringify(listed)).not.toContain('plain-secret');

    const created = controller.createApiKey({
      name: '集成测试 API Key',
      permissions: ['knowledge:read', 'knowledge:write']
    });
    expect(created.apiKey.maskedKey).toContain('...');
    expect(created.apiKey).not.toHaveProperty('secret');
    expect(JSON.stringify(created)).not.toContain('plain-secret');
  });

  it('updates writable security and assistant settings through stable request DTOs', () => {
    const controller = createController();

    expect(controller.patchSecuritySettings({ mfaRequired: true, ipAllowlist: ['10.0.0.0/8'] })).toMatchObject({
      mfaRequired: true,
      ipAllowlist: ['10.0.0.0/8']
    });
    expect(
      controller.patchAssistantConfig({ webSearchEnabled: true, quickPrompts: ['生成知识治理待办'] })
    ).toMatchObject({
      webSearchEnabled: true,
      quickPrompts: ['生成知识治理待办']
    });
  });
});

function createController(): KnowledgeFrontendSettingsController {
  return new KnowledgeFrontendSettingsController(new KnowledgeFrontendSettingsService());
}
