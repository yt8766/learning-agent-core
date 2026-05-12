import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeBaseDetail } from '../src/hooks/use-knowledge-base-detail';
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

describe('useKnowledgeBaseDetail', () => {
  it('returns error when no knowledgeBaseId is provided', async () => {
    const api = createApi();
    await renderWithApi(api, <Probe knowledgeBaseId={undefined} />);

    expect(container?.textContent).toContain('缺少知识库 ID');
  });

  it('returns error when knowledge base is not found', async () => {
    const api = createApi({
      listKnowledgeBases: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0
      }),
      listDocuments: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0
      })
    });

    await renderWithApi(api, <Probe knowledgeBaseId="kb-missing" />);
    await flushEffects();

    expect(container?.textContent).toContain('未找到知识库');
  });

  it('returns knowledge base and documents when found', async () => {
    const api = createApi({
      listKnowledgeBases: vi.fn().mockResolvedValue({
        items: [{ id: 'kb-1', name: 'Test KB', status: 'active', documentCount: 2, chunkCount: 10 }],
        page: 1,
        pageSize: 20,
        total: 1
      }),
      listDocuments: vi.fn().mockResolvedValue({
        items: [
          { id: 'doc-1', title: 'Doc 1', status: 'ready', sourceType: 'upload' },
          { id: 'doc-2', title: 'Doc 2', status: 'processing', sourceType: 'upload' }
        ],
        page: 1,
        pageSize: 20,
        total: 2
      })
    });

    await renderWithApi(api, <Probe knowledgeBaseId="kb-1" />);
    await flushEffects();

    expect(container?.textContent).toContain('Test KB');
    expect(container?.textContent).toContain('Doc 1');
    expect(container?.textContent).toContain('Doc 2');
  });

  it('reports error when API call fails', async () => {
    const api = createApi({
      listKnowledgeBases: vi.fn().mockRejectedValue(new Error('Network error'))
    });

    await renderWithApi(api, <Probe knowledgeBaseId="kb-1" />);
    await flushEffects();

    expect(container?.textContent).toContain('Network error');
  });
});

function Probe({ knowledgeBaseId }: { knowledgeBaseId: string | undefined }) {
  const detail = useKnowledgeBaseDetail(knowledgeBaseId);
  return (
    <div>
      {detail.error ? <span>error:{detail.error.message}</span> : null}
      {detail.knowledgeBase ? <span>kb:{detail.knowledgeBase.name}</span> : null}
      {detail.loading ? <span>loading</span> : null}
      {detail.documents.map(doc => (
        <span key={doc.id}>doc:{doc.title}</span>
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
    getChatAssistantConfig: vi.fn<KnowledgeFrontendApi['getChatAssistantConfig']>(),
    getDashboardOverview: vi.fn<KnowledgeFrontendApi['getDashboardOverview']>(),
    getDocument: vi.fn<KnowledgeFrontendApi['getDocument']>(),
    getLatestDocumentJob: vi.fn<KnowledgeFrontendApi['getLatestDocumentJob']>(),
    getObservabilityMetrics: vi.fn<KnowledgeFrontendApi['getObservabilityMetrics']>(),
    getSettingsApiKeys: vi.fn<KnowledgeFrontendApi['getSettingsApiKeys']>(),
    getSettingsModelProviders: vi.fn<KnowledgeFrontendApi['getSettingsModelProviders']>(),
    getSettingsSecurity: vi.fn<KnowledgeFrontendApi['getSettingsSecurity']>(),
    getSettingsStorage: vi.fn<KnowledgeFrontendApi['getSettingsStorage']>(),
    getTrace: vi.fn<KnowledgeFrontendApi['getTrace']>(),
    listAgentFlows: vi.fn<KnowledgeFrontendApi['listAgentFlows']>(),
    listConversationMessages: vi.fn<KnowledgeFrontendApi['listConversationMessages']>(),
    listConversations: vi.fn<KnowledgeFrontendApi['listConversations']>(),
    listDocumentChunks: vi.fn<KnowledgeFrontendApi['listDocumentChunks']>(),
    listDocuments: vi.fn<KnowledgeFrontendApi['listDocuments']>(),
    listEmbeddingModels: vi.fn<KnowledgeFrontendApi['listEmbeddingModels']>(),
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>(),
    listEvalRunResults: vi.fn<KnowledgeFrontendApi['listEvalRunResults']>(),
    listEvalRuns: vi.fn<KnowledgeFrontendApi['listEvalRuns']>(),
    listKnowledgeBases: vi.fn<KnowledgeFrontendApi['listKnowledgeBases']>(),
    listRagModelProfiles: vi.fn<KnowledgeFrontendApi['listRagModelProfiles']>(),
    listTraces: vi.fn<KnowledgeFrontendApi['listTraces']>(),
    listWorkspaceUsers: vi.fn<KnowledgeFrontendApi['listWorkspaceUsers']>(),
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
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
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
}
