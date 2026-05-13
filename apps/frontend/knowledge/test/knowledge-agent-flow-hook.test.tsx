/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeAgentFlow } from '../src/hooks/use-knowledge-agent-flow';
import { installTinyDom } from './tiny-dom';

let root: Root | undefined;
let container: HTMLElement | undefined;
let captured: ReturnType<typeof useKnowledgeAgentFlow> | undefined;

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
  captured = undefined;
});

describe('useKnowledgeAgentFlow', () => {
  it('loads flows on mount and sets active flow', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [
          { id: 'flow-1', name: 'Test Flow', nodes: [], edges: [] },
          { id: 'flow-2', name: 'Second Flow', nodes: [], edges: [] }
        ],
        page: 1,
        pageSize: 20,
        total: 2
      })
    });

    await renderWithApi(api);
    await flushEffects();

    expect(captured?.loading).toBe(false);
    expect(captured?.flows).toHaveLength(2);
    expect(captured?.activeFlow?.id).toBe('flow-1');
    expect(captured?.error).toBeNull();
  });

  it('reports error when loading fails', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockRejectedValue(new Error('Load failed'))
    });

    await renderWithApi(api);
    await flushEffects();

    expect(captured?.loading).toBe(false);
    expect(captured?.error?.message).toBe('Load failed');
    expect(captured?.flows).toHaveLength(0);
  });

  it('saves a new flow', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [{ id: 'flow-1', name: 'Existing', nodes: [], edges: [] }],
        page: 1,
        pageSize: 20,
        total: 1
      }),
      saveAgentFlow: vi.fn().mockResolvedValue({
        flow: { id: 'flow-new', name: 'New Flow', nodes: [], edges: [] }
      })
    });

    await renderWithApi(api);
    await flushEffects();

    const result = await captured?.saveFlow({ id: 'flow-new', name: 'New Flow', nodes: [], edges: [] } as any);

    expect(api.saveAgentFlow).toHaveBeenCalled();
    expect(result?.id).toBe('flow-new');
  });

  it('updates an existing flow', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [{ id: 'flow-1', name: 'Existing', nodes: [], edges: [] }],
        page: 1,
        pageSize: 20,
        total: 1
      }),
      updateAgentFlow: vi.fn().mockResolvedValue({
        flow: { id: 'flow-1', name: 'Updated', nodes: [], edges: [] }
      })
    });

    await renderWithApi(api);
    await flushEffects();

    const result = await captured?.saveFlow({ id: 'flow-1', name: 'Updated', nodes: [], edges: [] } as any);

    expect(api.updateAgentFlow).toHaveBeenCalledWith('flow-1', expect.any(Object));
    expect(result?.name).toBe('Updated');
  });

  it('runs a flow', async () => {
    const runResponse = { runId: 'run-1', status: 'started' };
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [{ id: 'flow-1', name: 'Test', nodes: [], edges: [] }],
        page: 1,
        pageSize: 20,
        total: 1
      }),
      runAgentFlow: vi.fn().mockResolvedValue(runResponse)
    });

    await renderWithApi(api);
    await flushEffects();

    const result = await captured?.runFlow();

    expect(api.runAgentFlow).toHaveBeenCalledWith(
      'flow-1',
      expect.objectContaining({
        flowId: 'flow-1'
      })
    );
    expect(result).toEqual(runResponse);
  });

  it('returns undefined when running without active flow', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0
      })
    });

    await renderWithApi(api);
    await flushEffects();

    const result = await captured?.runFlow();

    expect(result).toBeUndefined();
  });

  it('allows changing active flow ID', async () => {
    const api = createApi({
      listAgentFlows: vi.fn().mockResolvedValue({
        items: [
          { id: 'flow-1', name: 'First', nodes: [], edges: [] },
          { id: 'flow-2', name: 'Second', nodes: [], edges: [] }
        ],
        page: 1,
        pageSize: 20,
        total: 2
      })
    });

    await renderWithApi(api);
    await flushEffects();

    act(() => {
      captured?.setActiveFlowId('flow-2');
    });

    expect(captured?.activeFlow?.id).toBe('flow-2');
  });
});

function Probe() {
  captured = useKnowledgeAgentFlow();
  return (
    <div>
      {captured.loading ? 'loading' : 'ready'}
      {captured.error ? `error:${captured.error.message}` : ''}
      {captured.flows.map(f => (
        <span key={f.id}>{f.name}</span>
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

function renderWithApi(api: KnowledgeFrontendApi) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeApiProvider api={api}>
          <Probe />
        </KnowledgeApiProvider>
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
