import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeObservability } from '../src/hooks/use-knowledge-observability';
import type { ObservabilityMetrics, PageResult, RagTrace, RagTraceDetail } from '../src/types/api';
import { installTinyDom } from './tiny-dom';

const now = '2026-05-06T00:00:00.000Z';

const metrics: ObservabilityMetrics = {
  averageLatencyMs: 120,
  citationClickRate: 0.3,
  errorRate: 0,
  negativeFeedbackRate: 0.1,
  noAnswerRate: 0.05,
  p95LatencyMs: 220,
  p99LatencyMs: 300,
  questionCount: 2,
  stageLatency: [],
  timeoutRate: 0,
  traceCount: 2
};

const traceOne: RagTrace = {
  id: 'trace-1',
  workspaceId: 'ws-1',
  knowledgeBaseIds: ['kb-1'],
  question: 'Trace one?',
  status: 'succeeded',
  createdAt: now
};

const traceTwo: RagTrace = {
  id: 'trace-2',
  workspaceId: 'ws-1',
  knowledgeBaseIds: ['kb-1'],
  question: 'Trace two?',
  status: 'succeeded',
  createdAt: now
};

const traceTwoDetail: RagTraceDetail = {
  ...traceTwo,
  answer: 'Trace two answer',
  citations: [],
  spans: []
};

function ObservabilityProbe() {
  capturedObservability = useKnowledgeObservability();
  return <span>{capturedObservability.trace?.id ?? 'no-trace'}</span>;
}

let capturedObservability: ReturnType<typeof useKnowledgeObservability>;
let mountedRoot: Root | undefined;

beforeAll(() => {
  installTinyDom();
});

afterEach(async () => {
  if (mountedRoot) {
    await act(async () => {
      mountedRoot?.unmount();
    });
  }
  mountedRoot = undefined;
});

describe('useKnowledgeObservability', () => {
  it('selects trace detail without refetching metrics or waiting for the trace list round trip', async () => {
    const metricsResult = deferred<ObservabilityMetrics>();
    const tracesResult = deferred<PageResult<RagTrace>>();
    const api = createApi({
      getObservabilityMetrics: vi.fn().mockReturnValue(metricsResult.promise),
      getTrace: vi.fn().mockResolvedValue(traceTwoDetail),
      listTraces: vi.fn().mockReturnValue(tracesResult.promise)
    });

    await renderWithApi(api);

    await act(async () => {
      await capturedObservability.selectTrace('trace-2');
    });

    expect(api.getTrace).toHaveBeenCalledTimes(1);
    expect(api.getTrace).toHaveBeenCalledWith('trace-2');
    expect(api.getObservabilityMetrics).toHaveBeenCalledTimes(1);

    await act(async () => {
      metricsResult.resolve(metrics);
      tracesResult.resolve({ items: [traceOne, traceTwo], page: 1, pageSize: 20, total: 2 });
      await metricsResult.promise;
      await tracesResult.promise;
    });
    await flushEffects();

    expect(api.getTrace).toHaveBeenCalledTimes(1);
    expect(api.getObservabilityMetrics).toHaveBeenCalledTimes(1);
  });
});

function createApi(overrides: Partial<KnowledgeFrontendApi>): KnowledgeFrontendApi {
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
  const container = document.createElement('div');
  mountedRoot = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  return act(async () => {
    mountedRoot?.render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeApiProvider client={api}>
          <ObservabilityProbe />
        </KnowledgeApiProvider>
      </QueryClientProvider>
    );
  });
}

function flushEffects() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, reject, resolve };
}
