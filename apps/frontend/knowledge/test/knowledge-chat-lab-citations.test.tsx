import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { ChatLabPage, resolveChatLabKnowledgeBaseId } from '../src/pages/chat-lab/chat-lab-page';
import {
  createChatLabConversation,
  parseKnowledgeMentions,
  removeCurrentKnowledgeMentionToken,
  replaceCurrentKnowledgeMentionToken,
  stripKnowledgeMentions,
  uniqueKnowledgeMentions
} from '../src/pages/chat-lab/chat-lab-helpers';
import type {
  ChatMessage,
  ChatResponse,
  CreateFeedbackRequest,
  KnowledgeBase,
  KnowledgeRagStreamEvent,
  PageResult
} from '../src/types/api';

const testState = vi.hoisted(() => ({
  autoSubmitMessage: undefined as string | undefined,
  renderedSenders: [] as Array<{
    onChange?: (value: string) => void;
    onSubmit?: (message: string) => void;
    skill?: { title?: React.ReactNode; value?: string };
    slotConfig?: Array<{ key?: string; props?: { defaultValue?: string; placeholder?: string }; type?: string }>;
    value?: string;
  }>,
  renderedPopconfirms: [] as Array<{
    cancelText?: React.ReactNode;
    description?: React.ReactNode;
    okButtonProps?: { danger?: boolean };
    okText?: React.ReactNode;
    onConfirm?: () => void;
    title?: React.ReactNode;
  }>,
  renderedSuggestions: [] as Array<{
    items: Array<{ label?: React.ReactNode; value: string }>;
    onSelect?: (value: string, info: Array<{ label?: React.ReactNode; value: string }>) => void;
  }>,
  renderedConversations: [] as Array<{
    items: Array<{ key: string; label: React.ReactNode }>;
    menu?: (conversation: { key: string; label: React.ReactNode }) => {
      items: Array<{ danger?: boolean; key: string; label: React.ReactNode }>;
      onClick?: (info: { domEvent: { stopPropagation: () => void }; key: string }) => void;
    };
    onActiveChange?: (key: string) => void;
  }>,
  useXChatCalls: [] as Array<Record<string, unknown>>,
  useXConversationsCalls: [] as Array<Record<string, unknown>>,
  submitted: false
}));

vi.mock('@ant-design/x', () => {
  const Bubble = {
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
  };
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
  function Conversations({
    items,
    menu,
    onActiveChange
  }: {
    items: Array<{ key: string; label: React.ReactNode }>;
    menu?: (conversation: { key: string; label: React.ReactNode }) => {
      items: Array<{ danger?: boolean; key: string; label: React.ReactNode }>;
      onClick?: (info: { domEvent: { stopPropagation: () => void }; key: string }) => void;
    };
    onActiveChange?: (key: string) => void;
  }) {
    testState.renderedConversations.push({ items, menu, onActiveChange });
    return (
      <nav>
        {items.map(item => {
          const menuConfig = menu?.(item);
          return (
            <div key={item.key}>
              <button onClick={() => onActiveChange?.(item.key)}>{item.label}</button>
              {menuConfig?.items.map(menuItem => (
                <span key={`${item.key}-${menuItem.key}`}>{menuItem.label}</span>
              ))}
            </div>
          );
        })}
      </nav>
    );
  }
  function Suggestion({
    children,
    items,
    onSelect
  }: {
    children?: (props: { onKeyDown: () => void; onTrigger: () => void; open: boolean }) => React.ReactElement;
    items: Array<{ label?: React.ReactNode; value: string }>;
    onSelect?: (value: string, info: Array<{ label?: React.ReactNode; value: string }>) => void;
  }) {
    testState.renderedSuggestions.push({ items, onSelect });
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
  function Sender({
    header,
    onChange,
    onSubmit,
    skill,
    slotConfig,
    value
  }: {
    header?: React.ReactNode;
    onChange?: (value: string) => void;
    onSubmit: (message: string) => void;
    skill?: { title?: React.ReactNode; value?: string };
    slotConfig?: Array<{ key?: string; props?: { defaultValue?: string; placeholder?: string }; type?: string }>;
    value?: string;
  }) {
    testState.renderedSenders.push({ onChange, onSubmit, skill, slotConfig, value });
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
  function Welcome({ description, title }: { description?: React.ReactNode; title?: React.ReactNode }) {
    return (
      <section>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
    );
  }
  return { Actions, Bubble, Conversations, Sender, Suggestion, Welcome };
});

vi.mock('@ant-design/x-sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@ant-design/x-sdk')>();
  return {
    ...actual,
    useXChat: (options: Record<string, unknown>) => {
      testState.useXChatCalls.push(options);
      return actual.useXChat(options as never);
    },
    useXConversations: (options: Record<string, unknown>) => {
      testState.useXConversationsCalls.push(options);
      return actual.useXConversations(options as never);
    }
  };
});

vi.mock('@ant-design/x-markdown', () => ({
  default({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  }
}));

vi.mock('@ant-design/icons', () => ({
  BulbOutlined: () => <span>bulb</span>,
  GlobalOutlined: () => <span>global</span>,
  ThunderboltOutlined: () => <span>quick</span>
}));

vi.mock('antd', () => ({
  Button({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) {
    return <button onClick={onClick}>{children}</button>;
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
  Progress({ percent }: { percent?: number }) {
    return <span>{percent}</span>;
  },
  Select({
    onChange,
    options,
    value
  }: {
    onChange?: (value: string) => void;
    options?: Array<{ label?: React.ReactNode; value?: string }>;
    value?: string;
  }) {
    const selected = options?.find(option => option.value === value);
    return (
      <span>
        <span>{selected?.label ?? value}</span>
        {(options ?? []).map(option => (
          <button key={option.value} onClick={() => option.value && onChange?.(option.value)}>
            {option.label}
          </button>
        ))}
      </span>
    );
  },
  Space({ children }: { children?: React.ReactNode }) {
    return <span>{children}</span>;
  },
  Spin() {
    return <span>loading</span>;
  },
  Switch({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) {
    return <button onClick={() => onChange?.(!checked)}>{checked ? 'on' : 'off'}</button>;
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
  Timeline({ items }: { items?: Array<{ children?: React.ReactNode; content?: React.ReactNode }> }) {
    return (
      <ol>
        {(items ?? []).map((item, index) => (
          <li key={index}>{item.content ?? item.children}</li>
        ))}
      </ol>
    );
  },
  theme: {
    defaultAlgorithm: {}
  },
  Typography: {
    Link({ children, href }: { children?: React.ReactNode; href?: string }) {
      return <a href={href}>{children}</a>;
    },
    Title({ children }: { children?: React.ReactNode }) {
      return <h1>{children}</h1>;
    },
    Text({ children }: { children?: React.ReactNode }) {
      return <span>{children}</span>;
    }
  }
}));

const now = '2026-05-01T00:00:00.000Z';

const chatResponse: ChatResponse = {
  conversationId: 'frontend',
  answer: '引用卡片回答',
  traceId: 'trace_card',
  citations: [
    {
      id: 'cite_card',
      documentId: 'doc_card',
      chunkId: 'chunk_card',
      title: '前端规范',
      quote: '默认使用顶层静态 import，动态导入只用于明确代码分割。',
      score: 0.91,
      uri: 'docs/conventions/project-conventions.md'
    }
  ],
  userMessage: {
    id: 'msg_user',
    conversationId: 'frontend',
    role: 'user',
    content: '动态导入有什么限制？',
    createdAt: now
  },
  assistantMessage: {
    id: 'msg_assistant',
    conversationId: 'frontend',
    role: 'assistant',
    content: '引用卡片回答',
    createdAt: now
  }
};

const knowledgeBase: KnowledgeBase = {
  id: 'kb_real_user',
  workspaceId: 'ws_1',
  name: '真实知识库',
  tags: [],
  visibility: 'workspace',
  status: 'active',
  documentCount: 1,
  chunkCount: 1,
  readyDocumentCount: 1,
  failedDocumentCount: 0,
  createdBy: 'user_1',
  createdAt: now,
  updatedAt: now
};

function createClient(): KnowledgeFrontendApi {
  return {
    chat: vi.fn<KnowledgeFrontendApi['chat']>().mockResolvedValue(chatResponse),
    streamChat: vi
      .fn<KnowledgeFrontendApi['streamChat']>()
      .mockImplementation(async function* (): AsyncIterable<KnowledgeRagStreamEvent> {
        yield { type: 'rag.started', runId: 'trace_card' };
        yield { type: 'planner.started', runId: 'trace_card' };
        yield {
          type: 'planner.completed',
          runId: 'trace_card',
          plan: {
            id: 'plan_card',
            originalQuery: '检索前技术名词',
            rewrittenQuery: 'PreRetrievalPlanner query rewrite',
            queryVariants: ['PreRetrievalPlanner query rewrite'],
            selectedKnowledgeBaseIds: ['kb_real_user'],
            searchMode: 'hybrid',
            selectionReason: 'Selected real knowledge base',
            confidence: 0.86,
            fallbackPolicy: 'search-all-accessible',
            routingDecisions: [],
            diagnostics: {
              planner: 'llm',
              consideredKnowledgeBaseCount: 1,
              rewriteApplied: true,
              fallbackApplied: false
            }
          }
        } as KnowledgeRagStreamEvent;
        yield { type: 'retrieval.started', runId: 'trace_card' };
        yield {
          type: 'retrieval.completed',
          runId: 'trace_card',
          retrieval: {
            hits: [],
            citations: [],
            diagnostics: {
              effectiveSearchMode: 'hybrid',
              executedQueries: [{ query: 'PreRetrievalPlanner query rewrite', mode: 'vector', hitCount: 1 }],
              vectorHitCount: 1,
              keywordHitCount: 0,
              finalHitCount: 1
            }
          }
        } as KnowledgeRagStreamEvent;
        yield { type: 'answer.delta', runId: 'trace_card', delta: '引用卡片' };
        yield { type: 'answer.delta', runId: 'trace_card', delta: '回答' };
        yield {
          type: 'answer.completed',
          runId: 'trace_card',
          answer: { text: chatResponse.answer, noAnswer: false, citations: chatResponse.citations.map(toSdkCitation) }
        };
      }),
    createFeedback: vi
      .fn<(messageId: string, input: CreateFeedbackRequest) => Promise<ChatMessage>>()
      .mockResolvedValue({
        id: 'msg_assistant',
        conversationId: 'frontend',
        role: 'assistant',
        content: '引用卡片回答',
        feedback: { rating: 'positive' },
        createdAt: now
      }),
    listKnowledgeBases: vi.fn<() => Promise<PageResult<KnowledgeBase>>>().mockResolvedValue({
      items: [knowledgeBase],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    listRagModelProfiles: vi.fn<KnowledgeFrontendApi['listRagModelProfiles']>().mockResolvedValue({
      items: [
        {
          id: 'coding-pro',
          label: '用于编程',
          description: '更专业的回答与控制',
          useCase: 'coding',
          enabled: true
        },
        {
          id: 'daily-balanced',
          label: '适合日常工作',
          description: '同样强大，技术细节更少',
          useCase: 'daily',
          enabled: true
        }
      ]
    }),
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
    })
  } as unknown as KnowledgeFrontendApi;
}

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

let mountedRoot: Root | undefined;
let container: HTMLElement | undefined;

beforeAll(() => {
  installTinyDom();
});

beforeEach(() => {
  testState.autoSubmitMessage = undefined;
  testState.renderedSenders = [];
  testState.renderedPopconfirms = [];
  testState.renderedSuggestions = [];
  testState.renderedConversations = [];
  testState.useXChatCalls = [];
  testState.useXConversationsCalls = [];
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

describe('ChatLabPage citations', () => {
  it('renders citation cards with quote, score, uri, feedback actions, and trace link', async () => {
    testState.autoSubmitMessage = '@真实知识库 动态导入有什么限制？';
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();
    await flushEffects();
    await flushEffects();

    expect(client.streamChat).toHaveBeenCalledWith({
      messages: [{ content: '@真实知识库 动态导入有什么限制？', role: 'user' }],
      metadata: {
        conversationId: expect.any(String),
        debug: true,
        mentions: [{ id: 'kb_real_user', label: '真实知识库', type: 'knowledge_base' }],
        reasoningMode: 'deep',
        webSearchMode: 'off'
      },
      model: 'knowledge-rag',
      stream: true
    });
    expect(container?.textContent).toContain('新会话');
    expect(container?.textContent).toContain('重命名');
    expect(container?.textContent).toContain('删除');
    expect(container?.textContent).not.toContain('用于编程');
    expect(container?.textContent).not.toContain('选择对话知识库');
    expect(container?.textContent).toContain('引用卡片回答');
    expect(container?.textContent).toContain('引用来源');
    expect(container?.textContent).toContain('前端规范');
    expect(container?.textContent).toContain('默认使用顶层静态 import');
    expect(container?.textContent).toContain('score 0.91');
    expect(container?.textContent).toContain('docs/conventions/project-conventions.md');
    expect(container?.textContent).toContain('真实知识库');
    expect(container?.textContent).toContain('copy 引用卡片回答');
    expect(container?.textContent).toContain('like');
    expect(container?.textContent).toContain('dislike');
    expect(container?.textContent).toContain('Trace');
    expect(container?.textContent).toContain('Selected real knowledge base');
    expect(container?.textContent).toContain('hybrid');
    expect(container?.textContent).toContain('0.86');
    expect(container?.textContent).toContain('llm');
    expect(container?.textContent).toContain('PreRetrievalPlanner query rewrite');
    expect(container?.textContent).toContain('1 hits');
    expect(testState.useXConversationsCalls).not.toHaveLength(0);
    expect(testState.useXChatCalls).not.toHaveLength(0);
  });

  it('resolves chat knowledge base id from visible real knowledge bases', () => {
    expect(resolveChatLabKnowledgeBaseId([{ ...knowledgeBase, id: 'kb_first' }])).toBe('kb_first');
    expect(resolveChatLabKnowledgeBaseId([])).toBeUndefined();
  });

  it('parses knowledge mentions and creates local conversations', () => {
    expect(parseKnowledgeMentions('@真实知识库 动态导入有什么限制？', [knowledgeBase])).toEqual([
      { id: 'kb_real_user', label: '真实知识库', type: 'knowledge_base' }
    ]);
    expect(stripKnowledgeMentions('@真实知识库 动态导入有什么限制？', [knowledgeBase])).toBe('动态导入有什么限制？');
    expect(createChatLabConversation('动态导入有什么限制？')).toMatchObject({
      messages: [],
      title: '动态导入有什么限制？'
    });
  });

  it('replaces the active @ token with a selected knowledge base mention', () => {
    expect(replaceCurrentKnowledgeMentionToken('@真', '真实知识库')).toBe('@真实知识库 ');
    expect(replaceCurrentKnowledgeMentionToken('请基于 @真', '真实知识库')).toBe('请基于 @真实知识库 ');
    expect(replaceCurrentKnowledgeMentionToken('请基于 @旧 再看 @真', '真实知识库')).toBe(
      '请基于 @旧 再看 @真实知识库 '
    );
    expect(removeCurrentKnowledgeMentionToken('请基于 @真')).toBe('请基于');
    expect(uniqueKnowledgeMentions([...parseKnowledgeMentions('@真实知识库', [knowledgeBase])])).toEqual([
      { id: 'kb_real_user', label: '真实知识库', type: 'knowledge_base' }
    ]);
  });

  it('selects a knowledge base suggestion and sends it through metadata mentions', async () => {
    const client = createClient();

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();

    expect(testState.renderedSuggestions.at(-1)?.items).toEqual([{ label: '真实知识库', value: 'kb_real_user' }]);

    await act(async () => {
      testState.renderedSenders.at(-1)?.onChange?.('@真');
    });
    await flushEffects();

    await act(async () => {
      testState.renderedSuggestions
        .at(-1)
        ?.onSelect?.('kb_real_user', [{ label: '真实知识库', value: 'kb_real_user' }]);
    });
    await flushEffects();

    expect(testState.renderedSenders.at(-1)?.skill).toBeUndefined();
    expect(testState.renderedSenders.at(-1)?.slotConfig).toBeUndefined();
    expect(testState.renderedSenders.at(-1)?.value).toBe('');
    expect(container?.textContent).toContain('真实知识库');

    await act(async () => {
      testState.renderedSenders.at(-1)?.onChange?.('123123 123123 动态导入有什么限制？');
    });
    await flushEffects();

    await act(async () => {
      testState.renderedSenders.at(-1)?.onSubmit?.('123123 123123 动态导入有什么限制？');
    });
    await flushEffects();
    await flushEffects();

    expect(client.streamChat).toHaveBeenCalledWith({
      messages: [{ content: '123123 123123 动态导入有什么限制？', role: 'user' }],
      metadata: {
        conversationId: expect.any(String),
        debug: true,
        mentions: [{ id: 'kb_real_user', label: '真实知识库', type: 'knowledge_base' }],
        reasoningMode: 'deep',
        webSearchMode: 'off'
      },
      model: 'knowledge-rag',
      stream: true
    });
  });

  it('restores backend conversations, loads messages, and sends with selected model profile', async () => {
    const client = createClient();
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [
        {
          id: 'conv_backend',
          userId: 'user_1',
          title: '检索前技术名词',
          activeModelProfileId: 'daily-balanced',
          createdAt: now,
          updatedAt: now
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
    vi.mocked(client.listConversationMessages).mockResolvedValue({
      items: [
        {
          id: 'msg_backend_user',
          conversationId: 'conv_backend',
          userId: 'user_1',
          role: 'user',
          content: '检索前技术名词',
          citations: [],
          createdAt: now
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();
    await flushEffects();
    await flushEffects();

    expect(client.listRagModelProfiles).toHaveBeenCalledTimes(1);
    expect(client.listConversations).toHaveBeenCalledTimes(1);
    expect(client.listConversationMessages).toHaveBeenCalledWith('conv_backend');
    expect(container?.textContent).toContain('检索前技术名词');
    expect(container?.textContent).not.toContain('适合日常工作');

    await act(async () => {
      testState.renderedSenders.at(-1)?.onChange?.('继续解释 query rewrite');
    });
    await flushEffects();

    await act(async () => {
      testState.renderedSenders.at(-1)?.onSubmit?.('继续解释 query rewrite');
    });
    await flushEffects();
    await flushEffects();

    expect(client.streamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ conversationId: 'conv_backend' }),
        model: 'daily-balanced',
        stream: true
      })
    );
  });

  it('shows zero-hit retrieval diagnostics from the stream', async () => {
    testState.autoSubmitMessage = '没有命中的问题';
    const client = createClient();
    vi.mocked(client.streamChat).mockImplementation(async function* (): AsyncIterable<KnowledgeRagStreamEvent> {
      yield { type: 'rag.started', runId: 'trace_zero' };
      yield {
        type: 'retrieval.completed',
        runId: 'trace_zero',
        retrieval: {
          hits: [],
          citations: [],
          diagnostics: {
            effectiveSearchMode: 'none',
            executedQueries: [{ query: '没有命中的问题', mode: 'vector', hitCount: 0 }],
            vectorHitCount: 0,
            keywordHitCount: 0,
            finalHitCount: 0
          }
        }
      } as KnowledgeRagStreamEvent;
      yield {
        type: 'answer.completed',
        runId: 'trace_zero',
        answer: { text: '依据不足。', noAnswer: true, citations: [] }
      };
    });

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();
    await flushEffects();

    expect(container?.textContent).toContain('none');
    expect(container?.textContent).toContain('0 hits');
    expect(container?.textContent).toContain('没有命中的问题');
  });

  it('loads messages when switching restored backend conversations', async () => {
    const client = createClient();
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [
        {
          id: 'conv_first',
          userId: 'user_1',
          title: '第一个会话',
          activeModelProfileId: 'coding-pro',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'conv_second',
          userId: 'user_1',
          title: '第二个会话',
          activeModelProfileId: 'daily-balanced',
          createdAt: now,
          updatedAt: now
        }
      ],
      total: 2,
      page: 1,
      pageSize: 20
    });
    vi.mocked(client.listConversationMessages).mockImplementation(async conversationId => ({
      items: [
        {
          id: `msg_${conversationId}`,
          conversationId,
          userId: 'user_1',
          role: 'user',
          content: conversationId === 'conv_second' ? '第二个会话的历史消息' : '第一个会话的历史消息',
          citations: [],
          createdAt: now
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    }));

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();
    await flushEffects();

    await act(async () => {
      testState.renderedConversations.at(-1)?.onActiveChange?.('conv_second');
    });
    await flushEffects();
    await flushEffects();

    expect(client.listConversationMessages).toHaveBeenCalledWith('conv_second');
    expect(container?.textContent).toContain('第二个会话的历史消息');
    expect(container?.textContent).not.toContain('适合日常工作');
  });

  it('does not let delayed conversation hydration overwrite locally sent messages', async () => {
    const client = createClient();
    const messages = deferred<PageResult<ChatMessage>>();
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [
        {
          id: 'conv_backend',
          userId: 'user_1',
          title: '检索前技术名词',
          activeModelProfileId: 'daily-balanced',
          createdAt: now,
          updatedAt: now
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
    vi.mocked(client.listConversationMessages).mockReturnValue(messages.promise);

    await renderClient(
      <KnowledgeApiProvider client={client}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );
    await flushEffects();
    await flushEffects();

    await act(async () => {
      testState.renderedSenders.at(-1)?.onChange?.('继续解释 query rewrite');
    });
    await act(async () => {
      testState.renderedSenders.at(-1)?.onSubmit?.('继续解释 query rewrite');
    });
    await flushEffects();
    await flushEffects();

    await act(async () => {
      messages.resolve({
        items: [
          {
            id: 'msg_backend_old',
            conversationId: 'conv_backend',
            userId: 'user_1',
            role: 'user',
            content: '检索前技术名词',
            citations: [],
            createdAt: now
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20
      });
      await messages.promise;
    });
    await flushEffects();

    expect(container?.textContent).toContain('检索前技术名词');
    expect(container?.textContent).toContain('继续解释 query rewrite');
    expect(container?.textContent).toContain('引用卡片回答');
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
  vi.stubGlobal('ShadowRoot', class ShadowRoot {});
}
