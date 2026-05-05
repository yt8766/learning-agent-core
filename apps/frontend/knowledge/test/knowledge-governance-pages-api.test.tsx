import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import './knowledge-governance-page-mocks';
import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { ChatLabPage } from '../src/pages/chat-lab/chat-lab-page';
import { SettingsKeysPage } from '../src/pages/settings/settings-keys-page';
import { SettingsModelsPage } from '../src/pages/settings/settings-models-page';
import { SettingsSecurityPage } from '../src/pages/settings/settings-security-page';
import { SettingsStoragePage } from '../src/pages/settings/settings-storage-page';
import { UsersPage } from '../src/pages/users/users-page';
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

describe('Knowledge governance pages API data flow', () => {
  it('renders workspace users from the injected API instead of page fixtures', async () => {
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

    await renderWithApi(api, <UsersPage />);
    await flushEffects();

    expect(api.listWorkspaceUsers).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('林 API');
    expect(container?.textContent).toContain('研究部');
    expect(container?.textContent).not.toContain('张经理');
  });

  it('renders settings sections from the injected API projections', async () => {
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

    await renderWithApi(
      api,
      <>
        <SettingsModelsPage />
        <SettingsKeysPage />
        <SettingsStoragePage />
        <SettingsSecurityPage />
      </>
    );
    await flushEffects();

    expect(api.getSettingsModelProviders).toHaveBeenCalledTimes(1);
    expect(api.getSettingsApiKeys).toHaveBeenCalledTimes(1);
    expect(api.getSettingsStorage).toHaveBeenCalledTimes(1);
    expect(api.getSettingsSecurity).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('API Provider');
    expect(container?.textContent).toContain('API 注入密钥');
    expect(container?.textContent).toContain('API 存储库');
    expect(container?.textContent).toContain('AES-256 API');
    expect(container?.textContent).not.toContain('生产环境 API Key');
  });

  it('loads Chat Lab assistant config from the injected API while keeping chat data APIs', async () => {
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

    await renderWithApi(api, <ChatLabPage />);
    await flushEffects();

    expect(api.getChatAssistantConfig).toHaveBeenCalledTimes(1);
    expect(api.listKnowledgeBases).toHaveBeenCalledTimes(1);
    expect(api.listRagModelProfiles).toHaveBeenCalledTimes(1);
    expect(api.listConversations).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('API 快捷问题');
    expect(container?.textContent).toContain('API 检索');
    expect(container?.textContent).not.toContain('总结 2026 年知识库检索质量');
  });
});

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
    }
    await new Promise(resolve => {
      globalThis.setTimeout(resolve, 0);
    });
  });
}
