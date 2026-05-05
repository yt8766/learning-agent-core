import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import {
  useChatAssistantConfig,
  useSettingsApiKeys,
  useSettingsModelProviders,
  useSettingsSecurity,
  useSettingsStorage,
  useWorkspaceUsers
} from '../src/hooks/use-knowledge-governance';
import { installTinyDom } from './tiny-dom';

let root: Root | undefined;
let container: HTMLElement | undefined;

beforeAll(() => {
  installTinyDom();
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container = undefined;
});

describe('Knowledge governance hooks API data flow', () => {
  it('projects workspace users from the injected API', async () => {
    const api = createApi({
      listWorkspaceUsers: vi.fn().mockResolvedValue({
        items: [
          {
            department: '研究部',
            email: 'lin@example.com',
            id: 'u-api',
            kbAccessCount: 7,
            lastActiveAt: '2026-05-04T08:00:00.000Z',
            name: '林 API',
            queryCount: 1201,
            role: 'editor',
            status: 'active'
          }
        ],
        page: 1,
        pageSize: 20,
        summary: {
          activeUsers: 1,
          adminUsers: 0,
          pendingUsers: 0,
          totalUsers: 1
        },
        total: 1
      })
    });

    await renderWithApi(api, <WorkspaceUsersProbe />);
    await flushEffects();

    expect(api.listWorkspaceUsers).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('林 API');
    expect(container?.textContent).toContain('研究部');
  });

  it('projects settings sections from the injected API', async () => {
    const api = createApi({
      getSettingsApiKeys: vi.fn().mockResolvedValue({
        items: [
          {
            createdAt: '2026-05-01',
            id: 'key-api',
            maskedKey: 'sk-liv...abcd',
            lastUsedAt: '2026-05-04T08:00:00.000Z',
            name: 'API 注入密钥',
            permissions: ['knowledge:read', 'knowledge:write'],
            status: 'active'
          }
        ]
      }),
      getSettingsModelProviders: vi.fn().mockResolvedValue({
        items: [
          {
            defaultModelId: 'api-model-1',
            id: 'provider-api',
            models: [{ id: 'api-model-1', label: 'Api Model 1', capabilities: ['chat'] }],
            name: 'API Provider',
            status: 'connected'
          }
        ],
        updatedAt: '2026-05-04T08:00:00.000Z'
      }),
      getSettingsSecurity: vi.fn().mockResolvedValue({
        auditLogEnabled: true,
        encryption: {
          atRest: 'AES-256 API',
          enabled: true,
          transport: 'TLS 1.3 API'
        },
        ipAllowlistEnabled: true,
        ipAllowlist: ['10.2.0.0/16'],
        mfaRequired: true,
        passwordPolicy: '企业级',
        securityScore: 97,
        ssoEnabled: true,
        updatedAt: '2026-05-04T08:00:00.000Z'
      }),
      getSettingsStorage: vi.fn().mockResolvedValue({
        buckets: [
          {
            id: 'object',
            label: 'API 对象存储',
            total: 100,
            unit: 'GB',
            used: 58
          }
        ],
        knowledgeBases: [
          {
            documentCount: 12,
            id: 'storage-api',
            lastBackupAt: '2026-05-04T08:00:00.000Z',
            name: 'API 存储库',
            storageUnit: 'GB',
            storageUsed: 9.1,
            vectorIndexSize: '800 MB'
          }
        ],
        updatedAt: '2026-05-04T08:00:00.000Z'
      })
    });

    await renderWithApi(api, <SettingsProjectionProbe />);
    await flushEffects();

    expect(api.getSettingsModelProviders).toHaveBeenCalledTimes(1);
    expect(api.getSettingsApiKeys).toHaveBeenCalledTimes(1);
    expect(api.getSettingsStorage).toHaveBeenCalledTimes(1);
    expect(api.getSettingsSecurity).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('API Provider');
    expect(container?.textContent).toContain('API 注入密钥');
    expect(container?.textContent).toContain('API 存储库');
    expect(container?.textContent).toContain('AES-256 API');
  });

  it('projects Chat Lab assistant config from the injected API', async () => {
    const api = createApi({
      getChatAssistantConfig: vi.fn().mockResolvedValue({
        deepThinkEnabled: false,
        defaultKnowledgeBaseIds: [],
        modelProfileId: 'daily-balanced',
        quickPrompts: ['API 快捷问题'],
        thinkingSteps: [{ id: 'retrieval', label: 'API 检索', status: 'running' }],
        updatedAt: '2026-05-04T08:00:00.000Z',
        webSearchEnabled: true
      })
    });

    await renderWithApi(api, <AssistantConfigProbe />);
    await flushEffects();

    expect(api.getChatAssistantConfig).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('API 快捷问题');
    expect(container?.textContent).toContain('API 检索');
  });
});

function WorkspaceUsersProbe() {
  const { users } = useWorkspaceUsers();
  return (
    <div>
      {users.map(user => (
        <span key={user.id}>
          {user.name}
          {user.department}
        </span>
      ))}
    </div>
  );
}

function SettingsProjectionProbe() {
  const { apiKeys } = useSettingsApiKeys();
  const { providers } = useSettingsModelProviders();
  const { security } = useSettingsSecurity();
  const { storage } = useSettingsStorage();
  return (
    <div>
      {providers.map(provider => (
        <span key={provider.id}>{provider.name}</span>
      ))}
      {apiKeys.map(apiKey => (
        <span key={apiKey.id}>{apiKey.name}</span>
      ))}
      {storage.knowledgeBases.map(knowledgeBase => (
        <span key={knowledgeBase.id}>{knowledgeBase.name}</span>
      ))}
      <span>{security?.encryption.atRest}</span>
    </div>
  );
}

function AssistantConfigProbe() {
  const { config } = useChatAssistantConfig();
  return (
    <div>
      {config?.quickPrompts.map(prompt => (
        <span key={prompt}>{prompt}</span>
      ))}
      {config?.thinkingSteps.map(step => (
        <span key={step.id}>{step.label}</span>
      ))}
    </div>
  );
}

function createApi(overrides: Partial<KnowledgeFrontendApi> = {}): KnowledgeFrontendApi {
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>(),
    compareEvalRuns: vi.fn<KnowledgeFrontendApi['compareEvalRuns']>(),
    createDocumentFromUpload: vi.fn<KnowledgeFrontendApi['createDocumentFromUpload']>(),
    createFeedback: vi.fn<KnowledgeFrontendApi['createFeedback']>(),
    deleteDocument: vi.fn<KnowledgeFrontendApi['deleteDocument']>(),
    getChatAssistantConfig: vi.fn().mockResolvedValue({
      deepThinkEnabled: true,
      defaultKnowledgeBaseIds: [],
      modelProfileId: 'knowledge-rag',
      quickPrompts: [],
      thinkingSteps: [],
      updatedAt: '2026-05-04T08:00:00.000Z',
      webSearchEnabled: false
    }),
    getDashboardOverview: vi.fn<KnowledgeFrontendApi['getDashboardOverview']>(),
    getDocument: vi.fn<KnowledgeFrontendApi['getDocument']>(),
    getLatestDocumentJob: vi.fn<KnowledgeFrontendApi['getLatestDocumentJob']>(),
    getObservabilityMetrics: vi.fn<KnowledgeFrontendApi['getObservabilityMetrics']>(),
    getSettingsApiKeys: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    getSettingsModelProviders: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    getSettingsSecurity: vi.fn().mockResolvedValue({
      auditLogEnabled: true,
      encryption: {
        atRest: 'AES-256',
        enabled: true,
        transport: 'TLS 1.3'
      },
      ipAllowlistEnabled: false,
      ipAllowlist: [],
      mfaRequired: false,
      passwordPolicy: '基础',
      securityScore: 80,
      ssoEnabled: true,
      updatedAt: '2026-05-04T08:00:00.000Z'
    }),
    getSettingsStorage: vi
      .fn()
      .mockResolvedValue({ buckets: [], knowledgeBases: [], updatedAt: '2026-05-04T08:00:00.000Z' }),
    getTrace: vi.fn<KnowledgeFrontendApi['getTrace']>(),
    listAgentFlows: vi.fn<KnowledgeFrontendApi['listAgentFlows']>(),
    listConversationMessages: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    listConversations: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    listDocumentChunks: vi.fn<KnowledgeFrontendApi['listDocumentChunks']>(),
    listDocuments: vi.fn<KnowledgeFrontendApi['listDocuments']>(),
    listEmbeddingModels: vi.fn<KnowledgeFrontendApi['listEmbeddingModels']>(),
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>(),
    listEvalRunResults: vi.fn<KnowledgeFrontendApi['listEvalRunResults']>(),
    listEvalRuns: vi.fn<KnowledgeFrontendApi['listEvalRuns']>(),
    listKnowledgeBases: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    listRagModelProfiles: vi.fn().mockResolvedValue({ items: [] }),
    listTraces: vi.fn<KnowledgeFrontendApi['listTraces']>(),
    listWorkspaceUsers: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      summary: {
        activeUsers: 0,
        adminUsers: 0,
        pendingUsers: 0,
        totalUsers: 0
      },
      total: 0
    }),
    reprocessDocument: vi.fn<KnowledgeFrontendApi['reprocessDocument']>(),
    runAgentFlow: vi.fn<KnowledgeFrontendApi['runAgentFlow']>(),
    saveAgentFlow: vi.fn<KnowledgeFrontendApi['saveAgentFlow']>(),
    streamChat: vi.fn<KnowledgeFrontendApi['streamChat']>(),
    updateAgentFlow: vi.fn<KnowledgeFrontendApi['updateAgentFlow']>(),
    uploadDocument: vi.fn<KnowledgeFrontendApi['uploadDocument']>(),
    uploadKnowledgeFile: vi.fn<KnowledgeFrontendApi['uploadKnowledgeFile']>(),
    ...overrides
  };
}

function renderWithApi(api: KnowledgeFrontendApi, element: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient();
  return act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeApiProvider api={api}>{element}</KnowledgeApiProvider>
      </QueryClientProvider>
    );
  });
}

function flushEffects() {
  return act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
      await new Promise(resolve => {
        globalThis.setTimeout(resolve, 0);
      });
    }
  });
}
