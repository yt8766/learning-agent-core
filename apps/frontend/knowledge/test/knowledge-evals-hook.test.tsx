import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeEvals } from '../src/hooks/use-knowledge-evals';
import type { EvalDataset, EvalRun, PageResult } from '../src/types/api';
import { installTinyDom } from './tiny-dom';

const now = '2026-05-06T00:00:00.000Z';

const dataset: EvalDataset = {
  id: 'dataset-1',
  workspaceId: 'ws-1',
  name: '评测集',
  tags: [],
  caseCount: 2,
  createdBy: 'user-1',
  createdAt: now,
  updatedAt: now
};

function createRun(id: string): EvalRun {
  return {
    id,
    workspaceId: 'ws-1',
    datasetId: dataset.id,
    knowledgeBaseIds: ['kb-1'],
    status: 'succeeded',
    caseCount: 2,
    completedCaseCount: 2,
    failedCaseCount: 0,
    createdBy: 'user-1',
    createdAt: now
  };
}

function EvalsProbe() {
  capturedEvals = useKnowledgeEvals();
  return <span>{capturedEvals.comparisonText}</span>;
}

let capturedEvals: ReturnType<typeof useKnowledgeEvals>;
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

describe('useKnowledgeEvals', () => {
  it('reloads comparison with the latest runs pair', async () => {
    const firstCandidate = createRun('run-candidate-old');
    const firstBaseline = createRun('run-baseline-old');
    const latestCandidate = createRun('run-candidate-new');
    const latestBaseline = createRun('run-baseline-new');
    const api = createApi({
      compareEvalRuns: vi.fn<KnowledgeFrontendApi['compareEvalRuns']>().mockResolvedValue({
        baselineRunId: latestBaseline.id,
        candidateRunId: latestCandidate.id,
        totalScoreDelta: 4,
        retrievalScoreDelta: 2,
        generationScoreDelta: 1,
        perMetricDelta: { totalScore: 4 }
      }),
      listEvalRuns: vi
        .fn<KnowledgeFrontendApi['listEvalRuns']>()
        .mockResolvedValueOnce({ items: [firstCandidate, firstBaseline], page: 1, pageSize: 20, total: 2 })
        .mockResolvedValueOnce({ items: [latestCandidate, latestBaseline], page: 1, pageSize: 20, total: 2 })
    });

    await renderWithApi(api);
    await flushEffects();

    await act(async () => {
      await capturedEvals.reload();
    });

    expect(api.compareEvalRuns).toHaveBeenLastCalledWith({
      baselineRunId: latestBaseline.id,
      candidateRunId: latestCandidate.id
    });
    expect(capturedEvals.comparisonText).toContain('总分变化 4');
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
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>().mockResolvedValue({
      items: [dataset],
      page: 1,
      pageSize: 20,
      total: 1
    } satisfies PageResult<EvalDataset>),
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
          <EvalsProbe />
        </KnowledgeApiProvider>
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
