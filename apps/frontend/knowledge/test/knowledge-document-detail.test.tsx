import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { DocumentDetailPage } from '../src/pages/documents/document-detail-page';
import type { DocumentChunk, DocumentProcessingJob, KnowledgeDocument, PageResult } from '../src/types/api';

vi.mock('antd', () => {
  function Descriptions({ children }: { children?: React.ReactNode }) {
    return <dl>{children}</dl>;
  }
  Descriptions.Item = function DescriptionItem({
    children,
    label
  }: {
    children?: React.ReactNode;
    label?: React.ReactNode;
  }) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    );
  };

  return {
    Button({ children, disabled, onClick }: { children?: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
      return (
        <button data-disabled={disabled ? 'true' : 'false'} data-has-click={onClick ? 'true' : 'false'}>
          {children}
        </button>
      );
    },
    Card({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) {
      return (
        <section>
          {title ? <h3>{title}</h3> : null}
          {children}
        </section>
      );
    },
    Descriptions,
    Space({ children }: { children?: React.ReactNode }) {
      return <span>{children}</span>;
    },
    Table<T extends { id?: string }>({
      columns,
      dataSource,
      rowKey
    }: {
      columns?: Array<{
        dataIndex?: keyof T;
        render?: (value: unknown, record: T) => React.ReactNode;
        title?: React.ReactNode;
      }>;
      dataSource?: T[];
      rowKey?: keyof T | ((record: T) => string);
    }) {
      return (
        <table>
          <tbody>
            {(dataSource ?? []).map((record, index) => {
              const key = typeof rowKey === 'function' ? rowKey(record) : String(record[rowKey ?? 'id'] ?? index);
              return (
                <tr key={key}>
                  {(columns ?? []).map((column, columnIndex) => {
                    const value = column.dataIndex ? record[column.dataIndex] : undefined;
                    return (
                      <td key={columnIndex}>{column.render ? column.render(value, record) : String(value ?? '')}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    },
    Tag({ children }: { children?: React.ReactNode }) {
      return <span>{children}</span>;
    },
    Timeline({ items }: { items?: Array<{ children?: React.ReactNode }> }) {
      return (
        <ol>
          {(items ?? []).map((item, index) => (
            <li key={index}>{item.children}</li>
          ))}
        </ol>
      );
    },
    Typography: {
      Paragraph({ children }: { children?: React.ReactNode }) {
        return <p>{children}</p>;
      },
      Text({ children }: { children?: React.ReactNode }) {
        return <span>{children}</span>;
      },
      Title({ children }: { children?: React.ReactNode }) {
        return <h1>{children}</h1>;
      }
    }
  };
});

const now = '2026-05-02T00:00:00.000Z';

const documentRecord: KnowledgeDocument = {
  id: 'doc_detail',
  workspaceId: 'ws_1',
  knowledgeBaseId: 'kb_frontend',
  title: '部署手册',
  filename: 'deploy.md',
  sourceType: 'user-upload',
  status: 'ready',
  version: '1',
  chunkCount: 2,
  embeddedChunkCount: 2,
  latestJobId: 'job_detail',
  metadata: { objectKey: 'knowledge/kb_frontend/upload_1/deploy.md' },
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

const latestJob: DocumentProcessingJob = {
  id: 'job_detail',
  documentId: 'doc_detail',
  status: 'succeeded',
  currentStage: 'commit',
  stages: [
    { stage: 'parse', status: 'succeeded', startedAt: now, completedAt: now },
    { stage: 'chunk', status: 'succeeded', startedAt: now, completedAt: now },
    { stage: 'embed', status: 'succeeded', startedAt: now, completedAt: now },
    { stage: 'index_vector', status: 'succeeded', startedAt: now, completedAt: now }
  ],
  createdAt: now,
  completedAt: now
};

const chunks: DocumentChunk[] = [
  {
    id: 'chunk_1',
    documentId: 'doc_detail',
    knowledgeBaseId: 'kb_frontend',
    chunkIndex: 0,
    content: '部署前确认环境变量。',
    tokenCount: 8,
    status: 'ready',
    embeddingModel: 'text-embedding',
    embeddingStatus: 'ready',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'chunk_2',
    documentId: 'doc_detail',
    knowledgeBaseId: 'kb_frontend',
    chunkIndex: 1,
    content: '执行发布并检查索引。',
    tokenCount: 9,
    status: 'ready',
    embeddingModel: 'text-embedding',
    embeddingStatus: 'ready',
    createdAt: now,
    updatedAt: now
  }
];

interface CoreOpsApi {
  getDocument(documentId: string): Promise<KnowledgeDocument>;
  getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
  listDocumentChunks(documentId: string): Promise<{ items: DocumentChunk[]; total: number }>;
}

let mountedRoot: Root | undefined;
let container: HTMLElement | undefined;

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
  container = undefined;
});

describe('knowledge document detail', () => {
  it('shows document metadata, latest job timeline, and chunks', async () => {
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <MemoryRouter initialEntries={['/documents/doc_detail']}>
          <Routes>
            <Route element={<DocumentDetailPage />} path="/documents/:documentId" />
          </Routes>
        </MemoryRouter>
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(client.getDocument).toHaveBeenCalledWith('doc_detail');
    expect(client.getLatestDocumentJob).toHaveBeenCalledWith('doc_detail');
    expect(client.listDocumentChunks).toHaveBeenCalledWith('doc_detail');
    expect(container?.textContent).toContain('部署手册');
    expect(container?.textContent).toContain('job_detail');
    expect(container?.textContent).toContain('index_vector');
    expect(container?.textContent).toContain('部署前确认环境变量。');
    expect(container?.textContent).toContain('text-embedding');
  });

  it('enables reprocess when the core operations API is available', async () => {
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <MemoryRouter initialEntries={['/documents/doc_detail']}>
          <Routes>
            <Route element={<DocumentDetailPage />} path="/documents/:documentId" />
          </Routes>
        </MemoryRouter>
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(container?.textContent).toContain('重新处理');
    expect(container?.textContent).not.toContain('等待 Worker A 接入 reprocessDocument');
    expect(client.reprocessDocument).not.toHaveBeenCalled();
  });
});

function createClient(): KnowledgeFrontendApi & CoreOpsApi {
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>(),
    compareEvalRuns: vi.fn<KnowledgeFrontendApi['compareEvalRuns']>(),
    createDocumentFromUpload: vi.fn<KnowledgeFrontendApi['createDocumentFromUpload']>().mockResolvedValue({
      document: documentRecord,
      job: latestJob
    }),
    createFeedback: vi.fn<KnowledgeFrontendApi['createFeedback']>(),
    getDashboardOverview: vi.fn<KnowledgeFrontendApi['getDashboardOverview']>(),
    getDocument: vi.fn<CoreOpsApi['getDocument']>().mockResolvedValue(documentRecord),
    getLatestDocumentJob: vi.fn<CoreOpsApi['getLatestDocumentJob']>().mockResolvedValue(latestJob),
    getObservabilityMetrics: vi.fn<KnowledgeFrontendApi['getObservabilityMetrics']>(),
    getTrace: vi.fn<KnowledgeFrontendApi['getTrace']>(),
    listDocumentChunks: vi
      .fn<CoreOpsApi['listDocumentChunks']>()
      .mockResolvedValue({ items: chunks, total: chunks.length }),
    listDocuments: vi.fn<KnowledgeFrontendApi['listDocuments']>().mockResolvedValue({
      items: [documentRecord],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listEvalDatasets: vi.fn<KnowledgeFrontendApi['listEvalDatasets']>(),
    listEvalRunResults: vi.fn<KnowledgeFrontendApi['listEvalRunResults']>(),
    listEvalRuns: vi.fn<KnowledgeFrontendApi['listEvalRuns']>(),
    listEmbeddingModels: vi.fn<KnowledgeFrontendApi['listEmbeddingModels']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    }),
    listKnowledgeBases: vi.fn<KnowledgeFrontendApi['listKnowledgeBases']>().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    } satisfies PageResult<never>),
    listTraces: vi.fn<KnowledgeFrontendApi['listTraces']>(),
    reprocessDocument: vi.fn<KnowledgeFrontendApi['reprocessDocument']>(),
    deleteDocument: vi.fn<KnowledgeFrontendApi['deleteDocument']>(),
    uploadDocument: vi.fn<KnowledgeFrontendApi['uploadDocument']>(),
    uploadKnowledgeFile: vi.fn<KnowledgeFrontendApi['uploadKnowledgeFile']>().mockResolvedValue({
      uploadId: 'upload_1',
      knowledgeBaseId: 'kb_frontend',
      filename: 'deploy.md',
      size: 12,
      contentType: 'text/markdown',
      objectKey: 'knowledge/kb_frontend/upload_1/deploy.md',
      ossUrl: 'oss://bucket/knowledge/kb_frontend/upload_1/deploy.md',
      uploadedAt: now
    })
  };
}

function renderClient(element: React.ReactNode) {
  container = document.createElement('div');
  mountedRoot = createRoot(container);
  return act(async () => {
    mountedRoot?.render(element);
  });
}

function flushEffects() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
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
    style: {
      [key: string]: string | ((name: string, value: string) => void);
      setProperty(name: string, value: string): void;
    } = {
      setProperty(name: string, value: string) {
        this[name] = value;
      }
    };
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

    createElementNS(_namespace: string, tagName: string) {
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
