import { describe, expect, it } from 'vitest';

import {
  KnowledgeAssistantConfigResponseSchema,
  KnowledgeApiKeyCreateRequestSchema,
  KnowledgeApiKeyCreateResponseSchema,
  KnowledgeApiKeysResponseSchema,
  KnowledgeModelProvidersResponseSchema,
  KnowledgeSecuritySettingsPatchRequestSchema,
  KnowledgeSecuritySettingsResponseSchema,
  KnowledgeStorageSettingsResponseSchema,
  KnowledgeWorkspaceUsersResponseSchema
} from '../src/contracts/knowledge-service';

describe('Knowledge frontend users and settings contracts', () => {
  it('parses workspace users for the users management page', () => {
    const parsed = KnowledgeWorkspaceUsersResponseSchema.parse({
      items: [
        {
          id: 'user_1',
          name: '张经理',
          email: 'zhang@example.com',
          role: 'admin',
          status: 'active',
          department: '产品部',
          avatarUrl: '/avatar-user-1.png',
          kbAccessCount: 12,
          queryCount: 3420,
          lastActiveAt: '2026-05-04T07:40:00.000Z'
        }
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      summary: {
        totalUsers: 1,
        activeUsers: 1,
        adminUsers: 1,
        pendingUsers: 0
      }
    });

    expect(parsed.items[0]?.role).toBe('admin');
    expect(parsed.summary.activeUsers).toBe(1);
  });

  it('parses settings projections without exposing API key secrets', () => {
    const keys = KnowledgeApiKeysResponseSchema.parse({
      items: [
        {
          id: 'key_1',
          name: '生产环境 API Key',
          maskedKey: 'sk-kno...9c0d',
          status: 'active',
          permissions: ['knowledge:read', 'knowledge:write'],
          createdAt: '2026-05-04T07:40:00.000Z',
          lastUsedAt: '2026-05-04T08:00:00.000Z',
          secret: 'sk-knowledge-prod-plain-secret'
        }
      ]
    });
    expect(keys.items[0]).not.toHaveProperty('secret');
    expect(keys.items[0]?.maskedKey).toContain('...');

    const created = KnowledgeApiKeyCreateResponseSchema.parse({
      apiKey: keys.items[0],
      secret: 'sk-knowledge-prod-plain-secret'
    });
    expect(created).not.toHaveProperty('secret');
  });

  it('parses model, storage, security and assistant configuration contracts', () => {
    expect(
      KnowledgeModelProvidersResponseSchema.parse({
        items: [
          {
            id: 'openai',
            name: 'OpenAI',
            status: 'connected',
            models: [
              {
                id: 'gpt-4.1',
                label: 'GPT-4.1',
                capabilities: ['chat'],
                contextWindow: 128000
              }
            ],
            defaultModelId: 'gpt-4.1'
          }
        ],
        updatedAt: '2026-05-04T08:00:00.000Z'
      }).items[0]?.models[0]?.capabilities
    ).toEqual(['chat']);

    expect(
      KnowledgeStorageSettingsResponseSchema.parse({
        buckets: [
          {
            id: 'documents',
            label: '文档存储',
            used: 45.2,
            total: 100,
            unit: 'GB'
          }
        ],
        knowledgeBases: [
          {
            id: 'kb_1',
            name: '产品技术文档库',
            documentCount: 156,
            storageUsed: 2.4,
            storageUnit: 'GB',
            vectorIndexSize: '840MB',
            lastBackupAt: '2026-05-04T06:00:00.000Z'
          }
        ],
        updatedAt: '2026-05-04T08:00:00.000Z'
      }).buckets[0]?.unit
    ).toBe('GB');

    expect(
      KnowledgeSecuritySettingsResponseSchema.parse({
        ssoEnabled: true,
        mfaRequired: false,
        ipAllowlistEnabled: true,
        ipAllowlist: ['192.168.1.0/24'],
        auditLogEnabled: true,
        passwordPolicy: 'strong',
        encryption: {
          transport: 'TLS 1.3',
          atRest: 'AES-256',
          enabled: true
        },
        securityScore: 92,
        updatedAt: '2026-05-04T08:00:00.000Z'
      }).encryption.enabled
    ).toBe(true);

    expect(
      KnowledgeAssistantConfigResponseSchema.parse({
        deepThinkEnabled: true,
        webSearchEnabled: false,
        modelProfileId: 'daily-balanced',
        defaultKnowledgeBaseIds: ['kb_1'],
        quickPrompts: ['总结 2026 年知识库检索质量'],
        thinkingSteps: [{ id: 'intent', label: '分析问题意图', status: 'done' }],
        updatedAt: '2026-05-04T08:00:00.000Z'
      }).thinkingSteps[0]?.id
    ).toBe('intent');
  });

  it('validates writable settings request payloads', () => {
    expect(
      KnowledgeApiKeyCreateRequestSchema.parse({
        name: '测试环境 API Key',
        permissions: ['knowledge:read']
      })
    ).toMatchObject({ name: '测试环境 API Key' });

    expect(
      KnowledgeSecuritySettingsPatchRequestSchema.parse({
        mfaRequired: true,
        ipAllowlist: ['10.0.0.0/8']
      })
    ).toMatchObject({ mfaRequired: true });
  });
});
