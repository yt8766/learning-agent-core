import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { ChatLabPage } from '../src/pages/chat-lab/chat-lab-page';
import { DocumentsPage, resolveDocumentUploadKnowledgeBaseId } from '../src/pages/documents/documents-page';
import { EvalsPage } from '../src/pages/evals/evals-page';
import { ObservabilityPage } from '../src/pages/observability/observability-page';
import type {
  ChatMessage,
  ChatResponse,
  CreateFeedbackRequest,
  DashboardOverview,
  EvalDataset,
  EvalRun,
  EvalRunComparison,
  DocumentProcessingJob,
  DocumentChunk,
  EmbeddingModelOption,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeUploadResult,
  ObservabilityMetrics,
  PageResult,
  RagTrace,
  RagTraceDetail
} from '../src/types/api';

const testState = vi.hoisted(() => ({
  autoSubmitMessage: undefined as string | undefined,
  renderedPopconfirms: [] as Array<{
    cancelText?: React.ReactNode;
    description?: React.ReactNode;
    okButtonProps?: { danger?: boolean };
    okText?: React.ReactNode;
    onConfirm?: () => void;
    title?: React.ReactNode;
  }>,
  renderedButtons: [] as Array<{ children?: React.ReactNode; onClick?: () => void }>,
  submitted: false
}));

vi.mock('@ant-design/x/es/bubble', () => ({
  default: {
    List({
      items,
      role
    }: {
      items: Array<{
        content?: React.ReactNode;
        footer?: React.ReactNode;
        key: string;
        role?: string;
        status?: string;
        extraInfo?: Record<string, unknown>;
      }>;
      role?: Record<
        string,
        {
          contentRender?: (content: React.ReactNode, info: Record<string, unknown>) => React.ReactNode;
          footer?: (content: React.ReactNode, info: Record<string, unknown>) => React.ReactNode;
          loadingRender?: () => React.ReactNode;
        }
      >;
    }) {
      return (
        <div>
          {items.map(item => {
            const roleConfig = item.role ? role?.[item.role] : undefined;
            const info = { key: item.key, status: item.status, extraInfo: item.extraInfo };
            const content = item.content;
            const renderedContent =
              item.status === 'loading' ? roleConfig?.loadingRender?.() : roleConfig?.contentRender?.(content, info);
            const footer = item.footer ?? roleConfig?.footer?.(content, info);
            return (
              <article key={item.key}>
                <div>{renderedContent ?? content}</div>
                {footer ? <footer>{footer}</footer> : null}
              </article>
            );
          })}
        </div>
      );
    }
  }
}));

vi.mock('@ant-design/x/es/actions', () => {
  function Actions({
    items
  }: {
    items: Array<{ actionRender?: React.ReactNode | (() => React.ReactNode); key?: string; label?: string }>;
  }) {
    return (
      <div>
        {items.map(item => (
          <span key={item.key}>
            {typeof item.actionRender === 'function' ? item.actionRender() : (item.actionRender ?? item.label)}
          </span>
        ))}
      </div>
    );
  }
  Actions.Copy = ({ text }: { text?: React.ReactNode }) => <button>copy {text}</button>;
  Actions.Feedback = ({ onChange, value }: { onChange?: (value: string) => void; value?: string }) => (
    <span>
      <button onClick={() => onChange?.('like')}>like</button>
      <button onClick={() => onChange?.('dislike')}>dislike</button>
      <span>{value}</span>
    </span>
  );
  return { default: Actions };
});

vi.mock('@ant-design/x/es/conversations', () => ({
  default({ items }: { items: Array<{ key: string; label: React.ReactNode }> }) {
    return (
      <nav>
        {items.map(item => (
          <span key={item.key}>{item.label}</span>
        ))}
      </nav>
    );
  }
}));

vi.mock('@ant-design/x/es/suggestion', () => ({
  default({
    children,
    items,
    onSelect
  }: {
    children?: (props: { onKeyDown: () => void; onTrigger: () => void; open: boolean }) => React.ReactElement;
    items: Array<{ label?: React.ReactNode; value: string }>;
    onSelect?: (value: string, info: Array<{ label?: React.ReactNode; value: string }>) => void;
  }) {
    return (
      <div>
        {children?.({ onKeyDown: () => {}, onTrigger: () => {}, open: false })}
        {items.map(item => (
          <button key={item.value} onClick={() => onSelect?.(item.value, [item])}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }
}));

vi.mock('@ant-design/x/es/sender', () => {
  function Sender({
    header,
    onSubmit,
    skill,
    slotConfig,
    value
  }: {
    header?: React.ReactNode;
    onSubmit: (message: string) => void;
    skill?: { title?: React.ReactNode; value?: string };
    slotConfig?: Array<{ props?: { defaultValue?: string }; type?: string }>;
    value?: string;
  }) {
    if (testState.autoSubmitMessage && !testState.submitted) {
      testState.submitted = true;
      queueMicrotask(() => onSubmit(testState.autoSubmitMessage!));
    }
    const contentSlotValue = slotConfig?.find(item => item.type === 'content')?.props?.defaultValue;
    return (
      <div>
        {header}
        {skill?.title}
        {value ?? contentSlotValue}
      </div>
    );
  }
  return { default: Sender };
});

vi.mock('@ant-design/x/es/welcome', () => ({
  default({ description, title }: { description?: React.ReactNode; title?: React.ReactNode }) {
    return (
      <section>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
    );
  }
}));

vi.mock('@ant-design/x-markdown/es', () => ({
  default({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  }
}));

vi.mock('antd', () => ({
  Button({ children, disabled, onClick }: { children?: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
    testState.renderedButtons.push({ children, onClick });
    return (
      <button data-has-click={onClick ? 'true' : 'false'} disabled={disabled} onClick={onClick}>
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
  Flex({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  },
  Progress({ percent }: { percent?: number }) {
    return <span>{percent}</span>;
  },
  Modal({
    children,
    open,
    title
  }: {
    children?: React.ReactNode;
    onCancel?: () => void;
    open?: boolean;
    title?: React.ReactNode;
  }) {
    if (!open) {
      return null;
    }
    return (
      <section>
        <h3>{title}</h3>
        {children}
      </section>
    );
  },
  Popconfirm({
    children,
    cancelText,
    description,
    okButtonProps,
    okText,
    onConfirm,
    title
  }: {
    cancelText?: React.ReactNode;
    children?: React.ReactNode;
    description?: React.ReactNode;
    okButtonProps?: { danger?: boolean };
    okText?: React.ReactNode;
    onConfirm?: () => void;
    title?: React.ReactNode;
  }) {
    testState.renderedPopconfirms.push({ cancelText, description, okButtonProps, okText, onConfirm, title });
    return (
      <span>
        {children}
        <span>{title}</span>
        <span>{description}</span>
        <span>{cancelText}</span>
        <button onClick={onConfirm}>{okText}</button>
      </span>
    );
  },
  Space({ children }: { children?: React.ReactNode }) {
    return <span>{children}</span>;
  },
  Select({
    options,
    placeholder,
    value
  }: {
    options?: Array<{ label: React.ReactNode; value: string }>;
    placeholder?: React.ReactNode;
    value?: string;
  }) {
    const selected = options?.find(option => option.value === value);
    return (
      <span>
        <span>{placeholder}</span>
        <span>{selected?.label}</span>
        {(options ?? []).map(option => (
          <span key={option.value}>{option.label}</span>
        ))}
      </span>
    );
  },
  Spin() {
    return <span>loading</span>;
  },
  Statistic({ suffix, title, value }: { suffix?: React.ReactNode; title?: React.ReactNode; value?: React.ReactNode }) {
    return (
      <div>
        <span>{title}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
    );
  },
  Table<T extends { id?: string }>({
    columns,
    dataSource,
    onRow,
    rowKey
  }: {
    columns?: Array<{
      dataIndex?: keyof T;
      render?: (value: unknown, record: T) => React.ReactNode;
      title?: React.ReactNode;
    }>;
    dataSource?: T[];
    onRow?: (record: T) => { onClick?: () => void };
    rowKey?: keyof T | ((record: T) => string);
  }) {
    return (
      <table>
        <tbody>
          {(dataSource ?? []).map((record, index) => {
            const key = typeof rowKey === 'function' ? rowKey(record) : String(record[rowKey ?? 'id'] ?? index);
            const rowHandlers = onRow?.(record);
            return (
              <tr data-has-row-click={rowHandlers?.onClick ? 'true' : 'false'} key={key}>
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
    Title({ children }: { children?: React.ReactNode }) {
      return <h1>{children}</h1>;
    },
    Paragraph({ children }: { children?: React.ReactNode }) {
      return <p>{children}</p>;
    },
    Link({ children, href }: { children?: React.ReactNode; href?: string }) {
      return <a href={href}>{children}</a>;
    },
    Text({ children }: { children?: React.ReactNode }) {
      return <span>{children}</span>;
    }
  }
}));

const now = '2026-05-01T00:00:00.000Z';

const overview: DashboardOverview = {
  knowledgeBaseCount: 1,
  documentCount: 1,
  readyDocumentCount: 1,
  failedDocumentCount: 0,
  todayQuestionCount: 1,
  activeAlertCount: 0,
  recentFailedJobs: [],
  recentLowScoreTraces: [],
  recentEvalRuns: [],
  topMissingKnowledgeQuestions: []
};

const knowledgeBase: KnowledgeBase = {
  id: 'kb_frontend',
  workspaceId: 'ws_1',
  name: '前端知识库',
  tags: ['frontend'],
  visibility: 'workspace',
  status: 'active',
  documentCount: 1,
  chunkCount: 2,
  readyDocumentCount: 1,
  failedDocumentCount: 0,
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

const chatResponse: ChatResponse = {
  conversationId: 'conv_test',
  answer: '真实 API provider 返回的回答',
  traceId: 'trace_test',
  citations: [
    {
      id: 'cite_test',
      documentId: 'doc_test',
      chunkId: 'chunk_test',
      title: 'Provider Citation',
      quote: 'provider quote'
    }
  ],
  userMessage: {
    id: 'msg_user',
    conversationId: 'conv_test',
    role: 'user',
    content: '如何接入 provider？',
    createdAt: now
  },
  assistantMessage: {
    id: 'msg_assistant',
    conversationId: 'conv_test',
    role: 'assistant',
    content: '真实 API provider 返回的回答',
    createdAt: now
  }
};

function toSdkCitation(citation: ChatResponse['citations'][number]) {
  return {
    sourceId: citation.documentId,
    chunkId: citation.chunkId,
    title: citation.title,
    uri: citation.uri ?? '',
    quote: citation.quote,
    sourceType: 'user-upload' as const,
    trustClass: 'internal' as const,
    score: citation.score
  };
}

const dataset: EvalDataset = {
  id: 'dataset_provider',
  workspaceId: 'ws_1',
  name: 'Provider 评测集',
  tags: ['provider'],
  caseCount: 2,
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

const evalRun: EvalRun = {
  id: 'run_provider',
  workspaceId: 'ws_1',
  datasetId: 'dataset_provider',
  knowledgeBaseIds: ['kb_frontend'],
  status: 'succeeded',
  caseCount: 2,
  completedCaseCount: 2,
  failedCaseCount: 0,
  summary: { totalScore: 91 },
  createdBy: 'user_1',
  createdAt: now
};

const previousEvalRun: EvalRun = {
  ...evalRun,
  id: 'run_previous',
  summary: { totalScore: 88 }
};

const knowledgeDocument: KnowledgeDocument = {
  id: 'doc_failed',
  workspaceId: 'ws_1',
  knowledgeBaseId: 'kb_frontend',
  title: '失败文档',
  filename: 'failed.md',
  sourceType: 'user-upload',
  status: 'failed',
  version: '1',
  chunkCount: 0,
  embeddedChunkCount: 0,
  latestJobId: 'parse',
  latestError: { code: 'parse_failed', message: '解析失败', stage: 'parse' },
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

const processingJob: DocumentProcessingJob = {
  id: 'job_1',
  documentId: knowledgeDocument.id,
  status: 'queued',
  stages: [],
  createdAt: now
};

const documentChunk: DocumentChunk = {
  id: 'chunk_1',
  documentId: knowledgeDocument.id,
  knowledgeBaseId: knowledgeDocument.knowledgeBaseId,
  chunkIndex: 0,
  content: '测试 chunk',
  status: 'ready',
  createdAt: now,
  updatedAt: now
};

const uploadResult: KnowledgeUploadResult = {
  uploadId: 'upload_1',
  knowledgeBaseId: knowledgeDocument.knowledgeBaseId,
  filename: knowledgeDocument.filename ?? 'failed.md',
  size: 12,
  contentType: 'text/markdown',
  objectKey: 'knowledge/kb_frontend/upload_1/failed.md',
  ossUrl: 'oss://mock-bucket/knowledge/kb_frontend/upload_1/failed.md',
  uploadedAt: now
};

const embeddingModel: EmbeddingModelOption = {
  id: 'embed_openai_small',
  name: 'OpenAI Small',
  provider: 'openai',
  dimension: 1536,
  status: 'active'
};

const trace: RagTraceDetail = {
  id: 'trace_provider',
  workspaceId: 'ws_1',
  conversationId: 'conv_test',
  messageId: 'msg_assistant',
  knowledgeBaseIds: ['kb_frontend'],
  question: '观测链路如何展示？',
  answer: '展示 metrics 与 span。',
  status: 'succeeded',
  latencyMs: 432,
  hitCount: 3,
  citationCount: 1,
  createdAt: now,
  citations: [],
  spans: [
    {
      id: 'span_provider',
      traceId: 'trace_provider',
      stage: 'generation',
      name: 'Provider Generation',
      status: 'succeeded',
      latencyMs: 222
    }
  ]
};

function createClient(): KnowledgeFrontendApi {
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>().mockResolvedValue(chatResponse),
    streamChat: vi.fn<KnowledgeFrontendApi['streamChat']>().mockImplementation(async function* () {
      yield { type: 'rag.started', runId: 'trace_real' };
      yield { type: 'answer.delta', runId: 'trace_real', delta: chatResponse.answer };
      yield {
        type: 'answer.completed',
        runId: 'trace_real',
        answer: { text: chatResponse.answer, noAnswer: false, citations: chatResponse.citations.map(toSdkCitation) }
      };
    }),
    createFeedback: vi
      .fn<(messageId: string, input: CreateFeedbackRequest) => Promise<ChatMessage>>()
      .mockResolvedValue({
        id: 'msg_assistant',
        conversationId: 'conv_test',
        role: 'assistant',
        content: '真实 API provider 返回的回答',
        feedback: {
          rating: 'positive'
        },
        createdAt: now
      }),
    getDashboardOverview: vi.fn().mockResolvedValue(overview),
    getDocument: vi.fn().mockResolvedValue(knowledgeDocument),
    getLatestDocumentJob: vi.fn().mockResolvedValue(processingJob),
    getObservabilityMetrics: vi.fn(
      async (): Promise<ObservabilityMetrics> => ({
        traceCount: 9,
        questionCount: 8,
        averageLatencyMs: 321,
        p95LatencyMs: 600,
        p99LatencyMs: 800,
        errorRate: 0.01,
        timeoutRate: 0,
        noAnswerRate: 0.02,
        negativeFeedbackRate: 0.03,
        citationClickRate: 0.4,
        stageLatency: []
      })
    ),
    getTrace: vi.fn(async (): Promise<RagTraceDetail> => trace),
    listEvalDatasets: vi.fn<() => Promise<PageResult<EvalDataset>>>().mockResolvedValue({
      items: [dataset],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listEvalRuns: vi.fn<() => Promise<PageResult<EvalRun>>>().mockResolvedValue({
      items: [evalRun, previousEvalRun],
      total: 2,
      page: 1,
      pageSize: 20
    }),
    listDocuments: vi.fn<() => Promise<PageResult<KnowledgeDocument>>>().mockResolvedValue({
      items: [knowledgeDocument],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listDocumentChunks: vi.fn().mockResolvedValue({ items: [documentChunk], total: 1 }),
    listEvalRunResults: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listKnowledgeBases: vi.fn<() => Promise<PageResult<KnowledgeBase>>>().mockResolvedValue({
      items: [knowledgeBase],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listEmbeddingModels: vi.fn<() => Promise<PageResult<EmbeddingModelOption>>>().mockResolvedValue({
      items: [embeddingModel],
      total: 1,
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
    listTraces: vi.fn(
      async (): Promise<PageResult<RagTrace>> => ({
        items: [trace],
        total: 1,
        page: 1,
        pageSize: 20
      })
    ),
    compareEvalRuns: vi.fn(
      async (): Promise<EvalRunComparison> => ({
        baselineRunId: previousEvalRun.id,
        candidateRunId: evalRun.id,
        totalScoreDelta: 3,
        retrievalScoreDelta: 2,
        generationScoreDelta: 1,
        perMetricDelta: { totalScore: 3 }
      })
    ),
    createDocumentFromUpload: vi.fn().mockResolvedValue({
      document: knowledgeDocument,
      job: processingJob
    }),
    reprocessDocument: vi.fn().mockResolvedValue({
      document: knowledgeDocument,
      job: processingJob
    }),
    deleteDocument: vi.fn().mockResolvedValue({ ok: true }),
    uploadDocument: vi.fn().mockResolvedValue({
      document: knowledgeDocument,
      job: { id: 'job_upload', documentId: knowledgeDocument.id, status: 'queued', stages: [], createdAt: now }
    }),
    uploadKnowledgeFile: vi.fn().mockResolvedValue(uploadResult)
  };
}

let mountedRoot: Root | undefined;
let container: HTMLElement | undefined;

beforeAll(() => {
  installTinyDom();
});

beforeEach(() => {
  testState.autoSubmitMessage = undefined;
  testState.renderedButtons = [];
  testState.renderedPopconfirms = [];
  testState.submitted = false;
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

describe('knowledge production workflow pages', () => {
  it('renders ChatLabPage with an injected API client and shows the answer citation after submit', async () => {
    testState.autoSubmitMessage = '如何接入 provider？';
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(client.streamChat).toHaveBeenCalledWith({
      messages: [{ content: '如何接入 provider？', role: 'user' }],
      metadata: {
        conversationId: expect.any(String),
        debug: true,
        mentions: []
      },
      model: 'knowledge-rag',
      stream: true
    });
    expect(container?.textContent).toContain('新建会话');
    expect(container?.textContent).not.toContain('选择对话知识库');
    expect(container?.textContent).toContain('真实 API provider 返回的回答');
    expect(container?.textContent).toContain('Provider Citation');
    expect(container?.textContent).toContain('copy 真实 API provider 返回的回答');
    expect(container?.textContent).toContain('like');
    expect(container?.textContent).toContain('dislike');
    expect(container?.textContent).toContain('Trace');
  });

  it('renders DocumentsPage document stages and actions from the injected API client', async () => {
    const client = createClient();
    await renderClient(
      <KnowledgeApiProvider client={client}>
        <DocumentsPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(client.listDocuments).toHaveBeenCalledTimes(1);
    expect(client.listEmbeddingModels).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('上传文档');
    expect(container?.textContent).toContain('解析失败');
    expect(container?.textContent).toContain('100');
    expect(container?.textContent).toContain('重新处理');
    expect(container?.textContent).toContain('删除');
    expect(container?.textContent).not.toContain('选择目标知识库');

    const uploadButton = testState.renderedButtons.find(button => button.children === '上传文档');
    await act(async () => {
      uploadButton?.onClick?.();
    });
    await flushEffects();

    expect(container?.textContent).toContain('选择目标知识库');
    expect(container?.textContent).toContain('前端知识库');
    expect(container?.textContent).toContain('选择 Embedding Model');
    expect(container?.textContent).toContain('OpenAI Small');
    expect(container?.textContent).toContain('上传进度');
  });

  it('confirms before deleting a document from DocumentsPage', async () => {
    const client = createClient();
    await renderClient(
      <KnowledgeApiProvider client={client}>
        <DocumentsPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    const latestPopconfirm = testState.renderedPopconfirms.at(-1);
    expect(latestPopconfirm).toMatchObject({
      title: '删除文档？',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true }
    });
    expect(String(latestPopconfirm?.description)).toContain(knowledgeDocument.title);
    expect(client.deleteDocument).not.toHaveBeenCalled();

    await act(async () => {
      latestPopconfirm?.onConfirm?.();
    });
    await flushEffects();

    expect(client.deleteDocument).toHaveBeenCalledWith(knowledgeDocument.id);
    expect(client.listDocuments).toHaveBeenCalledTimes(2);
  });

  it('only defaults the DocumentsPage upload target when exactly one knowledge base is visible', () => {
    expect(resolveDocumentUploadKnowledgeBaseId([{ ...knowledgeBase, id: 'kb_real_user' }])).toBe('kb_real_user');
    expect(
      resolveDocumentUploadKnowledgeBaseId([
        { ...knowledgeBase, id: 'kb_real_user' },
        { ...knowledgeBase, id: 'kb_other' }
      ])
    ).toBeUndefined();
    expect(resolveDocumentUploadKnowledgeBaseId([])).toBeUndefined();
  });

  it('keeps DocumentsPage visible when the document API returns an invalid payload', async () => {
    const client = createClient();
    vi.mocked(client.listDocuments).mockResolvedValueOnce(undefined as unknown as PageResult<KnowledgeDocument>);

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <DocumentsPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(container?.textContent).toContain('文档');
    expect(container?.textContent).toContain('文档列表响应结构不正确');
  });

  it('renders EvalsPage datasets and runs from the injected API client', async () => {
    await renderClient(
      <KnowledgeApiProvider client={createClient()}>
        <EvalsPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(container?.textContent).toContain('Provider 评测集');
    expect(container?.textContent).toContain('run_provider');
    expect(container?.textContent).toContain('run_previous');
    expect(container?.textContent).toContain('91');
    expect(container?.textContent).toContain('总分变化 3');
  });

  it('renders ObservabilityPage metrics and trace spans from the injected API client', async () => {
    await renderClient(
      <KnowledgeApiProvider client={createClient()}>
        <ObservabilityPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(container?.textContent).toContain('9');
    expect(container?.textContent).toContain('321ms');
    expect(container?.textContent).toContain('Provider Generation');
  });
});

function renderClient(element: React.ReactNode) {
  container = document.createElement('div');
  mountedRoot = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });
  return act(async () => {
    mountedRoot?.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
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
