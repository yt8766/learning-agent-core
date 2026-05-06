import type {
  KnowledgeApiKey,
  KnowledgeApiKeyCreateRequest,
  KnowledgeApiKeyCreateResponse,
  KnowledgeApiKeysResponse,
  KnowledgeAssistantConfigPatchRequest,
  KnowledgeAssistantConfigResponse,
  KnowledgeModelProvidersResponse,
  KnowledgeSecuritySettingsPatchRequest,
  KnowledgeSecuritySettingsResponse,
  KnowledgeStorageSettingsResponse,
  KnowledgeWorkspaceInvitationCreateRequest,
  KnowledgeWorkspaceInvitationCreateResponse,
  KnowledgeWorkspaceUser,
  KnowledgeWorkspaceUsersResponse
} from '@agent/core';

const now = '2026-05-04T08:00:00.000Z';

interface WorkspaceUsersQuery {
  keyword?: string;
  page?: number | string;
  pageSize?: number | string;
}

interface StoredApiKey {
  id: string;
  name: string;
  secret: string;
  status: KnowledgeApiKey['status'];
  permissions: KnowledgeApiKey['permissions'];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt?: string | null;
}

export class KnowledgeFrontendSettingsService {
  private readonly users: KnowledgeWorkspaceUser[] = [
    {
      id: 'user_zhang',
      name: '张经理',
      email: 'zhang@example.com',
      role: 'admin',
      status: 'active',
      department: '产品部',
      avatarUrl: '/avatar-user-1.png',
      kbAccessCount: 12,
      queryCount: 3420,
      lastActiveAt: '2026-05-04T07:45:00.000Z'
    },
    {
      id: 'user_wang',
      name: '王芳',
      email: 'wangfang@example.com',
      role: 'editor',
      status: 'active',
      department: '技术部',
      avatarUrl: '/avatar-user-2.png',
      kbAccessCount: 8,
      queryCount: 2156,
      lastActiveAt: '2026-05-04T07:30:00.000Z'
    },
    {
      id: 'user_zhao',
      name: '赵强',
      email: 'zhaoqiang@example.com',
      role: 'viewer',
      status: 'pending',
      department: '运营部',
      avatarUrl: '/avatar-user-3.png',
      kbAccessCount: 0,
      queryCount: 0,
      lastActiveAt: null
    }
  ];

  private readonly apiKeys: StoredApiKey[] = [
    {
      id: 'key_prod',
      name: '生产环境 API Key',
      secret: 'sk-knowledge-prod-plain-secret-7a8b9c0d',
      status: 'active',
      permissions: ['knowledge:read', 'knowledge:write'],
      createdAt: '2026-01-15T09:00:00.000Z',
      lastUsedAt: '2026-05-04T07:58:00.000Z'
    },
    {
      id: 'key_test',
      name: '测试环境 API Key',
      secret: 'sk-knowledge-test-plain-secret-3x4y5z6a',
      status: 'active',
      permissions: ['knowledge:read'],
      createdAt: '2026-02-01T09:00:00.000Z',
      lastUsedAt: '2026-05-04T07:00:00.000Z'
    }
  ];

  private securitySettings: KnowledgeSecuritySettingsResponse = {
    ssoEnabled: true,
    mfaRequired: false,
    ipAllowlistEnabled: true,
    ipAllowlist: ['192.168.1.0/24', '10.0.0.0/8'],
    auditLogEnabled: true,
    passwordPolicy: 'strong',
    encryption: {
      enabled: true,
      transport: 'TLS 1.3',
      atRest: 'AES-256'
    },
    securityScore: 92,
    updatedAt: now
  };

  private assistantConfig: KnowledgeAssistantConfigResponse = {
    deepThinkEnabled: true,
    webSearchEnabled: false,
    modelProfileId: 'daily-balanced',
    defaultKnowledgeBaseIds: ['kb_product'],
    quickPrompts: [
      '总结 2026 年知识库检索质量',
      '查找低置信回答的主要原因',
      '设计 RAG 检索架构方案',
      '生成本周知识治理待办'
    ],
    thinkingSteps: [
      { id: 'intent', label: '分析问题意图', status: 'done' },
      { id: 'retrieval', label: '选择知识库与检索模式', status: 'done' },
      { id: 'answer', label: '整理引用与回答结构', status: 'pending' }
    ],
    updatedAt: now
  };

  listWorkspaceUsers(query: WorkspaceUsersQuery = {}): KnowledgeWorkspaceUsersResponse {
    const page = normalizePage(query.page);
    const pageSize = normalizePageSize(query.pageSize);
    const keyword = query.keyword?.trim().toLowerCase();
    const filtered = keyword
      ? this.users.filter(user => {
          return (
            user.name.toLowerCase().includes(keyword) ||
            user.email.toLowerCase().includes(keyword) ||
            user.department?.toLowerCase().includes(keyword)
          );
        })
      : this.users;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return {
      items,
      total: filtered.length,
      page,
      pageSize,
      summary: {
        totalUsers: this.users.length,
        activeUsers: this.users.filter(user => user.status === 'active').length,
        adminUsers: this.users.filter(user => user.role === 'admin').length,
        pendingUsers: this.users.filter(user => user.status === 'pending').length
      }
    };
  }

  createWorkspaceInvitation(
    input: KnowledgeWorkspaceInvitationCreateRequest
  ): KnowledgeWorkspaceInvitationCreateResponse {
    const invitedUsers = input.emails.map((email, index) => ({
      id: `invited_${Date.now()}_${index}`,
      name: email.split('@')[0] ?? email,
      email,
      role: input.role,
      status: 'pending' as const,
      department: input.department,
      kbAccessCount: 0,
      queryCount: 0,
      lastActiveAt: null
    }));
    this.users.push(...invitedUsers);
    return {
      invitationIds: invitedUsers.map(user => `invite_${user.id}`),
      invitedUsers,
      inviteLink: 'https://knowledge.local/invite/xyz789',
      expiresAt: '2026-05-11T08:00:00.000Z'
    };
  }

  listModelProviders(): KnowledgeModelProvidersResponse {
    return {
      items: [
        {
          id: 'openai',
          name: 'OpenAI',
          status: 'connected',
          defaultModelId: 'gpt-4.1',
          configuredAt: '2026-05-01T08:00:00.000Z',
          models: [
            { id: 'gpt-4.1', label: 'GPT-4.1', capabilities: ['chat'], contextWindow: 128000 },
            { id: 'text-embedding-3-large', label: 'Text Embedding 3 Large', capabilities: ['embedding'] }
          ]
        },
        {
          id: 'deepseek',
          name: 'DeepSeek',
          status: 'connected',
          defaultModelId: 'deepseek-chat',
          configuredAt: '2026-05-01T08:00:00.000Z',
          models: [{ id: 'deepseek-chat', label: 'DeepSeek Chat', capabilities: ['chat'], contextWindow: 64000 }]
        },
        {
          id: 'ollama',
          name: 'Ollama',
          status: 'disconnected',
          models: [{ id: 'llama3-70b', label: 'Llama 3 70B', capabilities: ['chat'] }]
        }
      ],
      updatedAt: now
    };
  }

  listApiKeys(): KnowledgeApiKeysResponse {
    return {
      items: this.apiKeys.map(toApiKeyProjection)
    };
  }

  createApiKey(input: KnowledgeApiKeyCreateRequest): KnowledgeApiKeyCreateResponse {
    const stored: StoredApiKey = {
      id: `key_${this.apiKeys.length + 1}`,
      name: input.name,
      secret: `sk-knowledge-created-plain-secret-${this.apiKeys.length + 1}`,
      status: 'active',
      permissions: input.permissions,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: input.expiresAt ?? null
    };
    this.apiKeys.push(stored);
    return {
      apiKey: toApiKeyProjection(stored)
    };
  }

  listStorageSettings(): KnowledgeStorageSettingsResponse {
    return {
      buckets: [
        { id: 'documents', label: '文档存储', used: 45.2, total: 100, unit: 'GB' },
        { id: 'vectors', label: '向量索引', used: 12.8, total: 50, unit: 'GB' },
        { id: 'media', label: '媒体文件', used: 8.5, total: 30, unit: 'GB' },
        { id: 'backups', label: '备份数据', used: 23.1, total: 40, unit: 'GB' }
      ],
      knowledgeBases: [
        {
          id: 'kb_product',
          name: '产品技术文档库',
          documentCount: 156,
          storageUsed: 2.4,
          storageUnit: 'GB',
          vectorIndexSize: '840MB',
          lastBackupAt: '2026-05-04T06:00:00.000Z'
        }
      ],
      updatedAt: now
    };
  }

  getSecuritySettings(): KnowledgeSecuritySettingsResponse {
    return this.securitySettings;
  }

  patchSecuritySettings(input: KnowledgeSecuritySettingsPatchRequest): KnowledgeSecuritySettingsResponse {
    this.securitySettings = {
      ...this.securitySettings,
      ...input,
      updatedAt: now
    };
    return this.securitySettings;
  }

  getAssistantConfig(): KnowledgeAssistantConfigResponse {
    return this.assistantConfig;
  }

  patchAssistantConfig(input: KnowledgeAssistantConfigPatchRequest): KnowledgeAssistantConfigResponse {
    this.assistantConfig = {
      ...this.assistantConfig,
      ...input,
      updatedAt: now
    };
    return this.assistantConfig;
  }
}

function normalizePage(value: number | string | undefined): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value: number | string | undefined): number {
  const pageSize = Number(value ?? 20);
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return 20;
  }
  return Math.min(pageSize, 100);
}

function toApiKeyProjection(key: StoredApiKey): KnowledgeApiKey {
  return {
    id: key.id,
    name: key.name,
    maskedKey: maskApiKey(key.secret),
    status: key.status,
    permissions: key.permissions,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt
  };
}

function maskApiKey(secret: string): string {
  if (secret.length <= 12) {
    return `${secret.slice(0, 2)}...${secret.slice(-2)}`;
  }
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}
