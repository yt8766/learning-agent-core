import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let useStateOverride:
  | ((actualUseState: (initialState?: unknown) => unknown, initialState?: unknown) => unknown)
  | null = null;
const mockUseChatSession = vi.fn();
const renderedAlerts: Array<Record<string, unknown>> = [];
const renderedModals: Array<Record<string, unknown>> = [];
const renderedSenders: Array<Record<string, unknown>> = [];
const buildBubbleItemsMock = vi.fn((_: Record<string, unknown>) => [{ key: 'bubble-1', content: 'assistant bubble' }]);

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const actualUseState = actual.useState as unknown as (initialState?: unknown) => unknown;

  return {
    ...actual,
    useState: ((initialState?: unknown) => {
      if (useStateOverride) {
        return useStateOverride(actualUseState, initialState);
      }
      return actualUseState(initialState);
    }) as typeof actual.useState
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    App: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    ConfigProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Layout: Object.assign(
      ({ children, className }: { children?: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      ),
      {
        Header: ({ children, className }: { children?: ReactNode; className?: string }) => (
          <header className={className}>{children}</header>
        ),
        Sider: ({
          children,
          className,
          width,
          collapsedWidth
        }: {
          children?: ReactNode;
          className?: string;
          width?: number;
          collapsedWidth?: number;
        }) => (
          <aside className={className} data-width={width} data-collapsed-width={collapsedWidth}>
            {children}
          </aside>
        ),
        Content: ({ children, className }: { children?: ReactNode; className?: string }) => (
          <main className={className}>{children}</main>
        )
      }
    ),
    Alert: (props: { title?: ReactNode; description?: ReactNode; onClose?: () => void }) => {
      renderedAlerts.push(props);
      return (
        <section>
          <div>{props.title}</div>
          <div>{props.description}</div>
        </section>
      );
    },
    Space: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>
    },
    Modal: Object.assign(
      ({
        title,
        children,
        open,
        onCancel,
        onOk
      }: {
        title?: ReactNode;
        children?: ReactNode;
        open?: boolean;
        onCancel?: () => void;
        onOk?: () => void;
      }) =>
        (() => {
          renderedModals.push({ title, children, open, onCancel, onOk });
          return open ? (
            <section>
              <h2>{title}</h2>
              {children}
            </section>
          ) : null;
        })(),
      {
        confirm: vi.fn()
      }
    )
  };
});

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Bubble: {
    List: ({ items, className }: { items: Array<{ key: string; content: ReactNode }>; className?: string }) => (
      <div className={className}>
        {items.map(item => (
          <article key={item.key}>{item.content}</article>
        ))}
      </div>
    )
  },
  Sender: (props: Record<string, unknown>) => {
    renderedSenders.push(props);
    const footer = props.footer as ((actionNode: ReactNode) => ReactNode) | undefined;
    return (
      <section className={String(props.className ?? '')}>
        <div>{String(props.placeholder ?? '')}</div>
        {footer?.(<button type="button">发送</button>)}
      </section>
    );
  }
}));

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content, className }: { content: string; className?: string }) => (
    <div className={className}>{content}</div>
  )
}));

vi.mock('@/pages/chat/chat-message-adapter', () => ({
  buildBubbleItems: (options: Record<string, unknown>) => buildBubbleItemsMock(options)
}));

vi.mock('@/hooks/use-chat-session', () => ({
  formatSessionTime: (value?: string) => value ?? '--',
  getSessionStatusLabel: (status?: string) => status ?? '--',
  useChatSession: () => mockUseChatSession()
}));

vi.mock('@/pages/chat-home/chat-home-helpers', () => ({
  buildEventSummary: () => 'assistant replied',
  getAgentLabel: () => '工部',
  getErrorCopy: () => ({
    title: '连接错误',
    description: '请稍后重试'
  })
}));

vi.mock('@/pages/chat-home/chat-home-sidebar', () => ({
  ChatHomeSidebar: () => <div>chat-home-sidebar</div>
}));

vi.mock('@/pages/chat-home/chat-home-workbench-thoughts', () => ({
  buildThoughtItems: () => [{ key: 'thought-1', title: '文书科', description: '整理上下文' }],
  buildThoughtItemsFromFields: () => [{ key: 'thought-1', title: '文书科', description: '整理上下文' }]
}));

vi.mock('@/pages/chat-home/chat-home-anchor-rail', () => ({
  ConversationAnchorRail: ({ anchors }: { anchors: Array<{ label: string }> }) => (
    <nav>conversation-anchor-rail:{anchors.length}</nav>
  )
}));

vi.mock('@/pages/chat-home/chat-home-anchor-rail-helpers', () => ({
  dedupeMessagesById: <T extends { id: string }>(messages: T[]) => messages,
  buildConversationAnchors: () => [
    { id: 'anchor-user', messageId: 'msg-user', label: '用户问题' },
    { id: 'anchor-assistant', messageId: 'bubble-1', label: '助手回答' }
  ]
}));

import { ChatHomePage } from '@/pages/chat-home/chat-home-page';

describe('ChatHomePage shell', () => {
  function createChatSessionOverrides(overrides: Record<string, unknown> = {}) {
    return {
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '覆盖率冲刺',
        status: 'running'
      },
      hasMessages: true,
      messages: [],
      events: [
        {
          id: 'evt-1',
          type: 'assistant_message',
          at: '2026-04-01T12:00:00.000Z',
          payload: { summary: 'assistant replied' }
        }
      ],
      checkpoint: {
        updatedAt: '2026-04-01T12:00:00.000Z',
        thinkState: {
          loading: true,
          messageId: 'msg-1',
          thinkingDurationMs: 2000
        },
        thoughtChain: [{ messageId: 'msg-1', thinkingDurationMs: 2000 }],
        pendingApprovals: [{ intent: 'enable_connector' }],
        resolvedWorkflow: { displayName: '通用协同流' }
      },
      pendingApprovals: [{ intent: 'enable_connector' }],
      showRightPanel: true,
      error: 'provider timeout',
      loading: false,
      isRequesting: false,
      sendMessage: vi.fn(),
      cancelActiveSession: vi.fn(),
      deleteActiveSession: vi.fn(),
      setShowRightPanel: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      installSuggestedSkill: vi.fn(),
      regenerateMessage: vi.fn(),
      submitMessageFeedback: vi.fn(),
      refreshSessionDetail: vi.fn(),
      ...overrides
    };
  }

  beforeEach(() => {
    renderedAlerts.length = 0;
    renderedModals.length = 0;
    renderedSenders.length = 0;
    buildBubbleItemsMock.mockClear();
    useStateOverride = null;
  });

  it('renders the Agent Chat + Codex active conversation shell with error state', () => {
    mockUseChatSession.mockReturnValue(createChatSessionOverrides());

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('chatx-agent-codex');
    expect(html).toContain('is-sidebar-expanded');
    expect(html).toContain('Agent Chat');
    expect(html).toContain('aria-label="对话主区域"');
    expect(html).toContain('覆盖率冲刺');
    expect(html).toContain('running');
    expect(html).not.toContain('回到当前会话');
    expect(html).not.toContain('分享当前会话');
    expect(html).toContain('连接错误');
    expect(html).toContain('请稍后重试');
    expect(html).toContain('chat-home-sidebar');
    expect(html).toContain('assistant bubble');
    expect(html).toContain('给 Agent Chat 发送消息');
  });

  it('guides pending tool approvals through natural-language confirmation in the composer', () => {
    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        checkpoint: {
          pendingApprovals: [],
          activeInterrupt: {
            id: 'interrupt-1',
            status: 'pending',
            mode: 'blocking',
            source: 'tool',
            kind: 'tool-approval',
            resumeStrategy: 'approval-recovery',
            payload: {
              requiredConfirmationPhrase: '确认执行'
            },
            createdAt: '2026-05-05T10:00:00.000Z'
          },
          approvalCursor: 0,
          learningCursor: 0,
          agentStates: [],
          createdAt: '2026-05-05T10:00:00.000Z',
          updatedAt: '2026-05-05T10:00:00.000Z'
        }
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('回复「确认执行」继续，或输入取消 / 修改要求');
    expect(renderedSenders[0]?.placeholder).toBe('回复「确认执行」继续，或输入取消 / 修改要求');
  });

  it('marks the shell as collapsed when the sidebar starts collapsed', () => {
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 4) {
        return [true, vi.fn()];
      }
      return actualUseState(initial);
    };

    mockUseChatSession.mockReturnValue(createChatSessionOverrides());

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('chatx-agent-codex');
    expect(html).toContain('is-sidebar-collapsed');
  });

  it('renders the empty conversation entry without quick or expert mode controls', () => {
    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        activeSessionId: '',
        activeSession: null,
        hasMessages: false,
        events: [],
        checkpoint: undefined,
        pendingApprovals: [],
        showRightPanel: false,
        error: ''
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('你今天想搞定什么？');
    expect(html).toContain('给 Agent Chat 发送消息');
    expect(html).not.toContain('使用快速模式开始对话');
    expect(html).not.toContain('使用专家模式开始对话');
    expect(html).not.toContain('快速模式');
    expect(html).not.toContain('专家模式');
    expect(html).not.toContain('聊天模式');
    expect(html).not.toContain('连接错误');
  });

  it('does not expose expert mode when stale state selects it', () => {
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 5) {
        return ['expert', vi.fn()];
      }
      return actualUseState(initial);
    };

    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        activeSessionId: '',
        activeSession: null,
        hasMessages: false,
        events: [],
        checkpoint: undefined,
        pendingApprovals: [],
        showRightPanel: false,
        error: ''
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('你今天想搞定什么？');
    expect(html).not.toContain('使用专家模式开始对话');
    expect(html).not.toContain('快速模式');
    expect(html).not.toContain('专家模式');
  });

  it('renders composer controls with left toggles and one right-side send action', () => {
    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        activeSessionId: '',
        activeSession: null,
        hasMessages: false,
        events: [],
        checkpoint: undefined,
        pendingApprovals: [],
        showRightPanel: false,
        error: ''
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('深度思考');
    expect(html).not.toContain('智能搜索');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="上传文件"');
    expect(html.match(/chatx-sender-footer__right/g)).toHaveLength(1);
    expect(html.match(/<button type="button">发送<\/button>/g)).toHaveLength(1);
    expect(html).not.toContain('♧');
  });

  it('submits quick composer input as a direct reply payload', () => {
    const chat = createChatSessionOverrides({
      activeSessionId: '',
      activeSession: null,
      hasMessages: false,
      events: [],
      checkpoint: undefined,
      pendingApprovals: [],
      showRightPanel: false,
      error: ''
    });
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const sender = renderedSenders[0] as { onSubmit?: (value: string) => void };
    sender.onSubmit?.('给我一个实现方案');

    expect(chat.sendMessage).toHaveBeenCalledWith({
      display: '给我一个实现方案',
      payload: '给我一个实现方案'
    });
  });

  it('ignores stale expert mode state and submits direct reply payloads', () => {
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 5) {
        return ['expert', vi.fn()];
      }
      return actualUseState(initial);
    };
    const chat = createChatSessionOverrides({
      activeSessionId: '',
      activeSession: null,
      hasMessages: false,
      events: [],
      checkpoint: undefined,
      pendingApprovals: [],
      showRightPanel: false,
      error: ''
    });
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const sender = renderedSenders[0] as { onSubmit?: (value: string) => void };
    sender.onSubmit?.('给我一个实现方案');

    expect(chat.sendMessage).toHaveBeenCalledWith({
      display: '给我一个实现方案',
      payload: '给我一个实现方案'
    });
  });

  it('connects the sender loading cancel action to the active session cancellation', () => {
    const chat = createChatSessionOverrides();
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const sender = renderedSenders[0] as { onCancel?: () => void; loading?: boolean };
    expect(sender.loading).toBe(true);
    expect(typeof sender.onCancel).toBe('function');

    sender.onCancel?.();

    expect(chat.cancelActiveSession).toHaveBeenCalledWith('用户停止当前会话');
  });

  it('forwards assistant regenerate and feedback actions into buildBubbleItems', () => {
    const chat = createChatSessionOverrides();
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const latestCall = buildBubbleItemsMock.mock.calls.at(-1);
    expect(latestCall).toBeDefined();
    const options = latestCall?.[0] as unknown as {
      onRegenerate?: (message: unknown) => void;
      onMessageFeedback?: (message: unknown, feedback: unknown) => void;
    };
    const message = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '镜像是模板，容器是实例。'
    };
    const feedback = { rating: 'helpful' };

    expect(typeof options.onRegenerate).toBe('function');
    expect(typeof options.onMessageFeedback).toBe('function');

    options.onRegenerate?.(message);
    options.onMessageFeedback?.(message, feedback);

    expect(chat.regenerateMessage).toHaveBeenCalledWith(message);
    expect(chat.submitMessageFeedback).toHaveBeenCalledWith(message, feedback);
  });

  it('filters workflow command prefixes from the active session title', () => {
    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        activeSession: {
          id: 'session-1',
          title: '/plan 你是谁',
          status: 'failed'
        }
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('你是谁');
    expect(html).not.toContain('/plan 你是谁');
  });

  it('dismisses the error alert with the current error value', () => {
    const dismissedErrorSetter = vi.fn();
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 5) {
        return ['', dismissedErrorSetter];
      }
      return actualUseState(initial);
    };

    mockUseChatSession.mockReturnValue(createChatSessionOverrides());

    renderToStaticMarkup(<ChatHomePage />);

    const alert = renderedAlerts[0] as { onClose?: () => void };
    alert.onClose?.();

    expect(dismissedErrorSetter).toHaveBeenCalledWith('provider timeout');
  });

  it('cancels and submits approval feedback through the modal callbacks', () => {
    const feedbackIntentSetter = vi.fn();
    const feedbackDraftSetter = vi.fn();
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 1) {
        return ['enable_connector', feedbackIntentSetter];
      }
      if (stateCallIndex === 2) {
        return ['  先补测试  ', feedbackDraftSetter];
      }
      return actualUseState(initial);
    };

    const chat = createChatSessionOverrides();
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const modal = renderedModals[0] as {
      open?: boolean;
      onCancel?: () => void;
      onOk?: () => void;
    };

    expect(modal.open).toBe(true);

    modal.onCancel?.();
    expect(feedbackIntentSetter).toHaveBeenCalledWith('');
    expect(feedbackDraftSetter).toHaveBeenCalledWith('');

    modal.onOk?.();
    expect(chat.updateApproval).toHaveBeenCalledWith('enable_connector', false, '先补测试');
    expect(feedbackIntentSetter).toHaveBeenCalledWith('');
    expect(feedbackDraftSetter).toHaveBeenCalledWith('');
  });
});
