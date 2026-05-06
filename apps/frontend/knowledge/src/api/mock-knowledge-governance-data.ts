import type {
  ChatAssistantConfig,
  SettingsApiKey,
  SettingsModelProvider,
  SettingsSecurityPolicy,
  SettingsStorageOverview,
  WorkspaceUser
} from '../types/api';

export const mockWorkspaceUsers: WorkspaceUser[] = [
  {
    avatarUrl: '/avatar-user-1.png',
    department: '产品部',
    email: 'zhang@company.com',
    id: 'u1',
    kbAccessCount: 12,
    lastActiveAt: '2026-05-04T07:45:00.000Z',
    name: '张经理',
    queryCount: 3420,
    role: 'admin',
    status: 'active'
  },
  {
    avatarUrl: '/avatar-user-2.png',
    department: '技术部',
    email: 'wangfang@company.com',
    id: 'u2',
    kbAccessCount: 8,
    lastActiveAt: '2026-05-04T07:30:00.000Z',
    name: '王芳',
    queryCount: 2156,
    role: 'editor',
    status: 'active'
  },
  {
    avatarUrl: '/avatar-user-3.png',
    department: '销售部',
    email: 'liming@company.com',
    id: 'u3',
    kbAccessCount: 4,
    lastActiveAt: null,
    name: '李明',
    queryCount: 567,
    role: 'viewer',
    status: 'pending'
  }
];

export const mockSettingsModelProviders: SettingsModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'connected',
    defaultModelId: 'gpt-4.1',
    configuredAt: '2026-05-01T08:00:00.000Z',
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1', capabilities: ['chat'], contextWindow: 128000 },
      { id: 'gpt-4o', label: 'GPT-4o', capabilities: ['chat'], contextWindow: 128000 },
      { id: 'text-embedding-3-large', label: 'Text Embedding 3 Large', capabilities: ['embedding'] }
    ]
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    status: 'connected',
    defaultModelId: 'gpt-4.1-azure',
    configuredAt: '2026-05-01T08:00:00.000Z',
    models: [
      { id: 'gpt-4.1-azure', label: 'GPT-4.1 Azure', capabilities: ['chat'], contextWindow: 128000 },
      { id: 'gpt-4o-azure', label: 'GPT-4o Azure', capabilities: ['chat'], contextWindow: 128000 }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    status: 'connected',
    defaultModelId: 'deepseek-chat',
    configuredAt: '2026-05-01T08:00:00.000Z',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', capabilities: ['chat'], contextWindow: 64000 },
      { id: 'deepseek-coder', label: 'DeepSeek Coder', capabilities: ['chat'], contextWindow: 64000 }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    status: 'disconnected',
    models: [
      { id: 'llama3-70b', label: 'Llama 3 70B', capabilities: ['chat'] },
      { id: 'qwen2.5', label: 'Qwen 2.5', capabilities: ['chat'] }
    ]
  }
];

export const mockSettingsApiKeys: SettingsApiKey[] = [
  {
    id: 'k1',
    name: '生产环境 API Key',
    maskedKey: 'sk-kno...9c0d',
    permissions: ['knowledge:read', 'knowledge:write'],
    createdAt: '2026-04-12T08:00:00.000Z',
    lastUsedAt: '2026-05-04T07:58:00.000Z',
    status: 'active'
  },
  {
    id: 'k2',
    name: '测试环境 API Key',
    maskedKey: 'sk-kno...5z6a',
    permissions: ['knowledge:read'],
    createdAt: '2026-04-20T08:00:00.000Z',
    lastUsedAt: '2026-05-04T07:00:00.000Z',
    status: 'active'
  }
];

export const mockSettingsStorage: SettingsStorageOverview = {
  buckets: [
    { id: 'documents', label: '文档存储', used: 45.2, total: 100, unit: 'GB' },
    { id: 'vectors', label: '向量索引', used: 12.8, total: 50, unit: 'GB' },
    { id: 'media', label: '媒体文件', used: 8.5, total: 30, unit: 'GB' },
    { id: 'backups', label: '备份数据', used: 23.1, total: 40, unit: 'GB' }
  ],
  knowledgeBases: [
    {
      id: 'kb-product',
      name: '产品技术文档库',
      documentCount: 156,
      storageUsed: 2.4,
      storageUnit: 'GB',
      vectorIndexSize: '840 MB',
      lastBackupAt: '2026-05-04T06:00:00.000Z'
    },
    {
      id: 'kb-sales',
      name: '2024 销售资料库',
      documentCount: 89,
      storageUsed: 1.1,
      storageUnit: 'GB',
      vectorIndexSize: '420 MB',
      lastBackupAt: '2026-05-03T18:00:00.000Z'
    }
  ],
  updatedAt: '2026-05-04T08:00:00.000Z'
};

export const mockSettingsSecurity: SettingsSecurityPolicy = {
  auditLogEnabled: true,
  encryption: {
    atRest: 'AES-256',
    enabled: true,
    transport: 'TLS 1.3'
  },
  ipAllowlistEnabled: true,
  ipAllowlist: ['192.168.1.0/24', '10.0.0.0/8'],
  mfaRequired: false,
  passwordPolicy: 'enterprise',
  securityScore: 92,
  ssoEnabled: true,
  updatedAt: '2026-05-04T08:00:00.000Z'
};

export const mockChatAssistantConfig: ChatAssistantConfig = {
  deepThinkEnabled: true,
  defaultKnowledgeBaseIds: ['kb_frontend'],
  modelProfileId: 'knowledge-rag',
  webSearchEnabled: false,
  quickPrompts: [
    '总结 2026 年知识库检索质量',
    '查找低置信回答的主要原因',
    '设计 RAG 检索架构方案',
    '生成本周知识治理待办'
  ],
  thinkingSteps: [
    { id: 'intent', label: '分析问题意图', status: 'done' },
    { id: 'retrieval', label: '选择知识库与检索模式', status: 'running' },
    { id: 'answer', label: '整理引用与回答结构', status: 'pending' }
  ],
  updatedAt: '2026-05-04T08:00:00.000Z'
};
