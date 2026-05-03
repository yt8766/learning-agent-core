import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi, useKnowledgeApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeDashboard } from '../src/hooks/use-knowledge-dashboard';
import type { DashboardOverview, KnowledgeBase, PageResult } from '../src/types/api';

const overview: DashboardOverview = {
  knowledgeBaseCount: 1,
  documentCount: 2,
  readyDocumentCount: 2,
  failedDocumentCount: 0,
  todayQuestionCount: 3,
  activeAlertCount: 0,
  recentFailedJobs: [],
  recentLowScoreTraces: [],
  recentEvalRuns: [],
  topMissingKnowledgeQuestions: []
};

const knowledgeBase: KnowledgeBase = {
  id: 'kb-1',
  workspaceId: 'workspace-1',
  name: '前端知识库',
  tags: ['frontend'],
  visibility: 'workspace',
  status: 'active',
  documentCount: 2,
  chunkCount: 8,
  readyDocumentCount: 2,
  failedDocumentCount: 0,
  createdBy: 'user-1',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z'
};

function ProviderProbe() {
  const api = useKnowledgeApi();
  capturedApi = api;
  return <span>provider-ready</span>;
}

function DashboardProbe() {
  const dashboard = useKnowledgeDashboard();
  capturedDashboard = dashboard;
  return <span>{dashboard.loading ? 'loading' : 'ready'}</span>;
}

let capturedApi: ReturnType<typeof useKnowledgeApi> | undefined;
let capturedDashboard: ReturnType<typeof useKnowledgeDashboard> | undefined;
let mountedRoot: Root | undefined;

beforeAll(() => {
  installTinyDom();
});

afterEach(async () => {
  if (mountedRoot) {
    await act(async () => {
      mountedRoot?.unmount();
    });
    mountedRoot = undefined;
  }
  capturedApi = undefined;
  capturedDashboard = undefined;
});

describe('KnowledgeApiProvider', () => {
  it('injects a concrete API client into frontend workflows', async () => {
    const listKnowledgeBases = vi.fn<() => Promise<PageResult<KnowledgeBase>>>().mockResolvedValue({
      items: [knowledgeBase],
      total: 1,
      page: 1,
      pageSize: 20
    });

    await renderClient(
      <KnowledgeApiProvider
        client={createApi({
          getDashboardOverview: vi.fn().mockResolvedValue(overview),
          listKnowledgeBases
        })}
      >
        <ProviderProbe />
      </KnowledgeApiProvider>
    );

    expect(capturedApi).toBeDefined();
    const result = await capturedApi?.listKnowledgeBases();

    expect(result?.items[0]?.name).toBe('前端知识库');
    expect(listKnowledgeBases).toHaveBeenCalledTimes(1);
  });

  it('automatically loads dashboard overview and knowledge bases from the injected client', async () => {
    const getDashboardOverview = vi.fn().mockResolvedValue(overview);
    const listKnowledgeBases = vi.fn().mockResolvedValue({
      items: [knowledgeBase],
      total: 1,
      page: 1,
      pageSize: 20
    });

    await renderClient(
      <KnowledgeApiProvider client={createApi({ getDashboardOverview, listKnowledgeBases })}>
        <DashboardProbe />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(capturedDashboard?.loading).toBe(false);
    expect(capturedDashboard?.error).toBeNull();
    expect(capturedDashboard?.overview?.todayQuestionCount).toBe(3);
    expect(capturedDashboard?.knowledgeBases[0]?.name).toBe('前端知识库');
    expect(getDashboardOverview).toHaveBeenCalledTimes(1);
    expect(listKnowledgeBases).toHaveBeenCalledTimes(1);
  });

  it('converts rejected non-error values into Error state', async () => {
    await renderClient(
      <KnowledgeApiProvider
        client={createApi({
          getDashboardOverview: vi.fn().mockRejectedValue('backend unavailable'),
          listKnowledgeBases: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
        })}
      >
        <DashboardProbe />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(capturedDashboard?.loading).toBe(false);
    expect(capturedDashboard?.error).toBeInstanceOf(Error);
    expect(capturedDashboard?.error?.message).toBe('backend unavailable');
  });

  it('keeps the latest reload result when an older request resolves later', async () => {
    const firstOverview = deferred<DashboardOverview>();
    const firstBases = deferred<PageResult<KnowledgeBase>>();
    const secondOverview = deferred<DashboardOverview>();
    const secondBases = deferred<PageResult<KnowledgeBase>>();
    const getDashboardOverview = vi
      .fn<() => Promise<DashboardOverview>>()
      .mockReturnValueOnce(firstOverview.promise)
      .mockReturnValueOnce(secondOverview.promise);
    const listKnowledgeBases = vi
      .fn<() => Promise<PageResult<KnowledgeBase>>>()
      .mockReturnValueOnce(firstBases.promise)
      .mockReturnValueOnce(secondBases.promise);

    await renderClient(
      <KnowledgeApiProvider client={createApi({ getDashboardOverview, listKnowledgeBases })}>
        <DashboardProbe />
      </KnowledgeApiProvider>
    );

    await act(async () => {
      void capturedDashboard?.reload();
    });

    await act(async () => {
      secondOverview.resolve({ ...overview, todayQuestionCount: 8 });
      secondBases.resolve({
        items: [{ ...knowledgeBase, id: 'kb-latest', name: '最新知识库' }],
        total: 1,
        page: 1,
        pageSize: 20
      });
      await secondOverview.promise;
      await secondBases.promise;
    });
    await flushEffects();

    await act(async () => {
      firstOverview.resolve({ ...overview, todayQuestionCount: 1 });
      firstBases.resolve({
        items: [{ ...knowledgeBase, id: 'kb-stale', name: '过期知识库' }],
        total: 1,
        page: 1,
        pageSize: 20
      });
      await firstOverview.promise;
      await firstBases.promise;
    });
    await flushEffects();

    expect(capturedDashboard?.overview?.todayQuestionCount).toBe(8);
    expect(capturedDashboard?.knowledgeBases[0]?.name).toBe('最新知识库');
  });
});

function createApi(overrides: Partial<KnowledgeFrontendApi> = {}): KnowledgeFrontendApi {
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>(),
    streamChat: vi.fn<KnowledgeFrontendApi['streamChat']>(),
    createFeedback: vi.fn<KnowledgeFrontendApi['createFeedback']>(),
    compareEvalRuns: vi.fn<KnowledgeFrontendApi['compareEvalRuns']>(),
    getDashboardOverview: vi.fn().mockResolvedValue(overview),
    getDocument: vi.fn<KnowledgeFrontendApi['getDocument']>(),
    getLatestDocumentJob: vi.fn<KnowledgeFrontendApi['getLatestDocumentJob']>(),
    getObservabilityMetrics: vi.fn<KnowledgeFrontendApi['getObservabilityMetrics']>(),
    getTrace: vi.fn<KnowledgeFrontendApi['getTrace']>(),
    listDocumentChunks: vi.fn<KnowledgeFrontendApi['listDocumentChunks']>(),
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>(),
    listEvalRunResults: vi.fn<KnowledgeFrontendApi['listEvalRunResults']>(),
    listEvalRuns: vi.fn<KnowledgeFrontendApi['listEvalRuns']>(),
    listDocuments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listEmbeddingModels: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listKnowledgeBases: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listRagModelProfiles: vi.fn().mockResolvedValue({ items: [] }),
    listConversations: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listConversationMessages: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listTraces: vi.fn<KnowledgeFrontendApi['listTraces']>(),
    createDocumentFromUpload: vi.fn<KnowledgeFrontendApi['createDocumentFromUpload']>(),
    reprocessDocument: vi.fn<KnowledgeFrontendApi['reprocessDocument']>(),
    deleteDocument: vi.fn<KnowledgeFrontendApi['deleteDocument']>(),
    uploadDocument: vi.fn<KnowledgeFrontendApi['uploadDocument']>(),
    uploadKnowledgeFile: vi.fn<KnowledgeFrontendApi['uploadKnowledgeFile']>(),
    ...overrides
  };
}

function renderClient(element: React.ReactNode) {
  const container = document.createElement('div');
  mountedRoot = createRoot(container);
  return act(async () => {
    mountedRoot?.render(element);
  });
}

function flushEffects() {
  return act(async () => {
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

function installTinyDom() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  class TinyNode {
    childNodes: TinyNode[] = [];
    nodeType: number;
    nodeName: string;
    ownerDocument: TinyDocument;
    parentNode: TinyNode | null = null;
    private text = '';

    constructor(nodeType: number, nodeName: string, ownerDocument: TinyDocument) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.ownerDocument = ownerDocument;
    }

    appendChild(node: TinyNode) {
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }

    insertBefore(node: TinyNode, before: TinyNode | null) {
      const index = before ? this.childNodes.indexOf(before) : -1;
      if (index === -1) {
        return this.appendChild(node);
      }
      this.childNodes.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }

    removeChild(node: TinyNode) {
      this.childNodes = this.childNodes.filter(child => child !== node);
      node.parentNode = null;
      return node;
    }

    addEventListener() {}

    removeEventListener() {}

    get textContent() {
      return this.text || this.childNodes.map(node => node.textContent).join('');
    }

    set textContent(value: string) {
      this.text = value;
      this.childNodes = [];
    }
  }

  class TinyElement extends TinyNode {
    attributes: Record<string, string> = {};
    style: Record<string, string> = {};
    tagName: string;

    constructor(tagName: string, ownerDocument: TinyDocument) {
      super(1, tagName.toUpperCase(), ownerDocument);
      this.tagName = this.nodeName;
    }

    removeAttribute(name: string) {
      delete this.attributes[name];
    }

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }

  class TinyText extends TinyNode {
    constructor(text: string, ownerDocument: TinyDocument) {
      super(3, '#text', ownerDocument);
      this.textContent = text;
    }
  }

  class TinyDocument {
    body: TinyElement;
    defaultView = globalThis;
    nodeName = '#document';
    nodeType = 9;
    ownerDocument = this;

    constructor() {
      this.body = new TinyElement('body', this);
    }

    addEventListener() {}

    createComment(text: string) {
      return new TinyText(text, this);
    }

    createElement(tagName: string) {
      return new TinyElement(tagName, this);
    }

    createTextNode(text: string) {
      return new TinyText(text, this);
    }

    removeEventListener() {}
  }

  const document = new TinyDocument();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Node', TinyNode);
  vi.stubGlobal('Element', TinyElement);
  vi.stubGlobal('HTMLElement', TinyElement);
  vi.stubGlobal('HTMLIFrameElement', class HTMLIFrameElement {});
}
