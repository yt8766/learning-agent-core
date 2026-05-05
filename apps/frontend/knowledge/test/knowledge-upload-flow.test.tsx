import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';

import { knowledgeQueryKeys } from '../src/api/knowledge-query';
import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useDocumentUpload } from '../src/hooks/use-document-upload';
import { useKnowledgeDocuments } from '../src/hooks/use-knowledge-documents';
import type {
  DocumentChunk,
  DocumentProcessingJob,
  EmbeddingModelOption,
  KnowledgeDocument,
  KnowledgeBase,
  PageResult
} from '../src/types/api';

const now = '2026-05-02T00:00:00.000Z';

const knowledgeBase: KnowledgeBase = {
  id: 'kb_frontend',
  workspaceId: 'ws_1',
  name: '前端知识库',
  tags: ['frontend'],
  visibility: 'workspace',
  status: 'active',
  documentCount: 0,
  chunkCount: 0,
  readyDocumentCount: 0,
  failedDocumentCount: 0,
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

const queuedJob: DocumentProcessingJob = {
  id: 'job_upload',
  documentId: 'doc_upload',
  status: 'queued',
  currentStage: 'parse',
  stages: [],
  createdAt: now
};

const runningJob: DocumentProcessingJob = {
  ...queuedJob,
  status: 'running',
  currentStage: 'chunk'
};

const succeededJob: DocumentProcessingJob = {
  ...queuedJob,
  status: 'succeeded',
  currentStage: 'commit',
  completedAt: now
};

const documentRecord: KnowledgeDocument = {
  id: 'doc_upload',
  workspaceId: 'ws_1',
  knowledgeBaseId: 'kb_frontend',
  title: 'runbook.md',
  filename: 'runbook.md',
  sourceType: 'user-upload',
  status: 'queued',
  version: '1',
  chunkCount: 0,
  embeddedChunkCount: 0,
  latestJobId: queuedJob.id,
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

interface CoreOpsApi {
  createDocumentFromUpload(
    knowledgeBaseId: string,
    input: { filename: string; objectKey: string; uploadId: string }
  ): Promise<{ document: KnowledgeDocument; job: DocumentProcessingJob }>;
  getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
  uploadKnowledgeFile(input: { file: File; knowledgeBaseId: string }): Promise<{
    uploadId: string;
    knowledgeBaseId: string;
    filename: string;
    size: number;
    contentType: 'text/markdown' | 'text/plain';
    objectKey: string;
    ossUrl: string;
    uploadedAt: string;
  }>;
}

function UploadProbe({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  capturedUpload = useDocumentUpload({ embeddingModelId: 'embed_openai_small', knowledgeBaseId, pollIntervalMs: 10 });
  return (
    <div>
      <span>{capturedUpload.status}</span>
      <span>{capturedUpload.uploadResult?.filename}</span>
      <span>{capturedUpload.job?.status}</span>
      <span>{capturedUpload.progressPercent}</span>
    </div>
  );
}

function DocumentsProbe() {
  capturedDocuments = useKnowledgeDocuments();
  return <div>{capturedDocuments.documents.length}</div>;
}

let capturedUpload: ReturnType<typeof useDocumentUpload>;
let capturedDocuments: ReturnType<typeof useKnowledgeDocuments>;
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
  vi.useRealTimers();
});

describe('knowledge upload flow', () => {
  it('uploads md/txt files, creates a document from the upload result, then polls the latest job', async () => {
    vi.useFakeTimers();
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <UploadProbe knowledgeBaseId="kb_frontend" />
      </KnowledgeApiProvider>
    );

    const file = new File(['# Runbook'], 'runbook.md', { type: 'text/markdown' });
    await act(async () => {
      await capturedUpload.upload(file);
    });

    expect(client.uploadKnowledgeFile).toHaveBeenCalledWith({ file, knowledgeBaseId: 'kb_frontend' });
    expect(client.createDocumentFromUpload).toHaveBeenCalledWith('kb_frontend', {
      filename: 'runbook.md',
      metadata: { embeddingModelId: 'embed_openai_small' },
      objectKey: 'knowledge/kb_frontend/upload_1/runbook.md',
      uploadId: 'upload_1'
    });
    expect(capturedUpload.status).toBe('polling');
    expect(capturedUpload.uploadResult?.filename).toBe('runbook.md');
    expect(capturedUpload.progressPercent).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(client.getLatestDocumentJob).toHaveBeenCalledWith('doc_upload');
    expect(capturedUpload.status).toBe('succeeded');
    expect(capturedUpload.job?.status).toBe('succeeded');
    expect(capturedUpload.progressPercent).toBe(100);
  });

  it('rejects unsupported web/html files before upload', async () => {
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <UploadProbe knowledgeBaseId="kb_frontend" />
      </KnowledgeApiProvider>
    );

    await act(async () => {
      await capturedUpload.upload(new File(['<html />'], 'page.html', { type: 'text/html' }));
    });

    expect(client.uploadKnowledgeFile).not.toHaveBeenCalled();
    expect(capturedUpload.status).toBe('failed');
    expect(capturedUpload.error?.message).toContain('仅支持 Markdown/TXT');
  });

  it('invalidates the documents query after uploading a document', async () => {
    const client = createClient();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await renderClient(
      <QueryClientProvider client={queryClient}>
        <KnowledgeApiProvider client={client}>
          <DocumentsProbe />
        </KnowledgeApiProvider>
      </QueryClientProvider>
    );

    const file = new File(['# Runbook'], 'runbook.md', { type: 'text/markdown' });
    await act(async () => {
      await capturedDocuments.uploadDocument(file, 'kb_frontend');
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: knowledgeQueryKeys.documents() });
  });
});

function createClient(): KnowledgeFrontendApi & CoreOpsApi {
  const uploadKnowledgeFile = vi.fn<CoreOpsApi['uploadKnowledgeFile']>().mockResolvedValue({
    uploadId: 'upload_1',
    knowledgeBaseId: 'kb_frontend',
    filename: 'runbook.md',
    size: 9,
    contentType: 'text/markdown',
    objectKey: 'knowledge/kb_frontend/upload_1/runbook.md',
    ossUrl: 'oss://bucket/knowledge/kb_frontend/upload_1/runbook.md',
    uploadedAt: now
  });
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>(),
    streamChat: vi.fn<KnowledgeFrontendApi['streamChat']>(),
    compareEvalRuns: vi.fn<KnowledgeFrontendApi['compareEvalRuns']>(),
    createDocumentFromUpload: vi.fn<CoreOpsApi['createDocumentFromUpload']>().mockResolvedValue({
      document: documentRecord,
      job: queuedJob
    }),
    createFeedback: vi.fn<KnowledgeFrontendApi['createFeedback']>(),
    getDashboardOverview: vi.fn<KnowledgeFrontendApi['getDashboardOverview']>(),
    getDocument: vi.fn<KnowledgeFrontendApi['getDocument']>().mockResolvedValue(documentRecord),
    getLatestDocumentJob: vi
      .fn<CoreOpsApi['getLatestDocumentJob']>()
      .mockResolvedValueOnce(runningJob)
      .mockResolvedValueOnce(succeededJob),
    getObservabilityMetrics: vi.fn<KnowledgeFrontendApi['getObservabilityMetrics']>(),
    getTrace: vi.fn<KnowledgeFrontendApi['getTrace']>(),
    listDocuments: vi.fn<KnowledgeFrontendApi['listDocuments']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    listDocumentChunks: vi.fn<KnowledgeFrontendApi['listDocumentChunks']>().mockResolvedValue({
      items: [] satisfies DocumentChunk[],
      total: 0
    }),
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>(),
    listEvalRunResults: vi.fn<KnowledgeFrontendApi['listEvalRunResults']>(),
    listEvalRuns: vi.fn<KnowledgeFrontendApi['listEvalRuns']>(),
    listKnowledgeBases: vi.fn<() => Promise<PageResult<KnowledgeBase>>>().mockResolvedValue({
      items: [knowledgeBase],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listEmbeddingModels: vi.fn<() => Promise<PageResult<EmbeddingModelOption>>>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    listRagModelProfiles: vi.fn<KnowledgeFrontendApi['listRagModelProfiles']>().mockResolvedValue({ items: [] }),
    listConversations: vi.fn<KnowledgeFrontendApi['listConversations']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    listConversationMessages: vi.fn<KnowledgeFrontendApi['listConversationMessages']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    listWorkspaceUsers: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      summary: { totalUsers: 0, activeUsers: 0, adminUsers: 0, pendingUsers: 0 }
    }),
    getSettingsModelProviders: vi.fn().mockResolvedValue({ items: [], updatedAt: now }),
    getSettingsApiKeys: vi.fn().mockResolvedValue({ items: [] }),
    getSettingsStorage: vi.fn().mockResolvedValue({ buckets: [], knowledgeBases: [], updatedAt: now }),
    getSettingsSecurity: vi.fn().mockResolvedValue({
      auditLogEnabled: true,
      encryption: { enabled: true, transport: 'TLS 1.3', atRest: 'AES-256' },
      ipAllowlist: [],
      ipAllowlistEnabled: false,
      mfaRequired: false,
      passwordPolicy: '基础',
      securityScore: 80,
      ssoEnabled: true,
      updatedAt: now
    }),
    getChatAssistantConfig: vi.fn().mockResolvedValue({
      deepThinkEnabled: true,
      webSearchEnabled: false,
      modelProfileId: 'knowledge-rag',
      defaultKnowledgeBaseIds: [],
      quickPrompts: [],
      thinkingSteps: [],
      updatedAt: now
    }),
    listAgentFlows: vi.fn<KnowledgeFrontendApi['listAgentFlows']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    saveAgentFlow: vi.fn<KnowledgeFrontendApi['saveAgentFlow']>(),
    updateAgentFlow: vi.fn<KnowledgeFrontendApi['updateAgentFlow']>(),
    runAgentFlow: vi.fn<KnowledgeFrontendApi['runAgentFlow']>(),
    listTraces: vi.fn<KnowledgeFrontendApi['listTraces']>(),
    reprocessDocument: vi.fn<KnowledgeFrontendApi['reprocessDocument']>(),
    deleteDocument: vi.fn<KnowledgeFrontendApi['deleteDocument']>(),
    uploadDocument: vi.fn<KnowledgeFrontendApi['uploadDocument']>(),
    uploadKnowledgeFile
  };
}

function renderClient(element: React.ReactNode) {
  const container = document.createElement('div');
  mountedRoot = createRoot(container);
  return act(async () => {
    mountedRoot?.render(element);
  });
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
