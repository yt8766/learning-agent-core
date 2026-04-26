import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let useStateOverride:
  | ((actualUseState: (initialState?: unknown) => unknown, initialState?: unknown) => unknown)
  | null = null;
const mockUseChatSession = vi.fn();
const renderedButtons: Array<{ children?: ReactNode; onClick?: () => void | Promise<void> }> = [];
const renderedAlerts: Array<Record<string, unknown>> = [];
const renderedModals: Array<Record<string, unknown>> = [];
const mockModalConfirm = vi.fn();
const mockExportApprovalsCenter = vi.fn();
const mockExportRuntimeCenter = vi.fn();
const mockGetBrowserReplay = vi.fn();
const mockStreamReportSchema = vi.fn();
const runtimeDrawerProps: Array<Record<string, unknown>> = [];

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
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void | Promise<void> }) => {
      renderedButtons.push({ children, onClick });
      return <button>{children}</button>;
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
        confirm: (config: Record<string, unknown>) => mockModalConfirm(config)
      }
    )
  };
});

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/api/chat-api', () => ({
  buildApprovalsCenterExportUrl: () => '/approvals-export',
  buildBrowserReplayUrl: () => '/replay',
  buildRuntimeCenterExportUrl: () => '/runtime-export',
  exportApprovalsCenter: (...args: unknown[]) => mockExportApprovalsCenter(...args),
  exportRuntimeCenter: (...args: unknown[]) => mockExportRuntimeCenter(...args),
  getBrowserReplay: (...args: unknown[]) => mockGetBrowserReplay(...args),
  streamReportSchema: (...args: unknown[]) => mockStreamReportSchema(...args)
}));

vi.mock('@/features/chat/chat-message-adapter', () => ({
  buildBubbleItems: () => [{ key: 'bubble-1', content: 'assistant bubble' }]
}));

vi.mock('@/features/runtime-panel/chat-runtime-drawer', () => ({
  ChatRuntimeDrawer: (props: Record<string, unknown>) => {
    runtimeDrawerProps.push(props);
    return <div>runtime-drawer:{props.open ? 'open' : 'closed'}</div>;
  },
  getRuntimeDrawerExportFilters: () => ({ executionMode: 'plan', interactionKind: 'plan-question' })
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

vi.mock('@/pages/chat-home/chat-home-workbench', () => ({
  buildThoughtItems: () => [{ key: 'thought-1', title: '文书科', description: '整理上下文' }],
  ChatHomeWorkbench: ({
    bubbleItems,
    chatMode,
    streamEvents,
    showWorkbench
  }: {
    bubbleItems: Array<{ content: string }>;
    chatMode: 'quick' | 'expert';
    onChatModeChange: (chatMode: 'quick' | 'expert') => void;
    streamEvents: Array<{ summary: string }>;
    showWorkbench: boolean;
  }) => (
    <div>
      workbench:{showWorkbench ? 'open' : 'closed'} / mode:{chatMode} / can-change:yes / bubbles:
      {bubbleItems.length} / events:{streamEvents.length}
    </div>
  )
}));

import { ChatHomePage } from '@/pages/chat-home/chat-home-page';

describe('ChatHomePage shell', () => {
  function findRenderedButton(label: string) {
    return renderedButtons.find(button => button.children === label);
  }

  function createChatSessionOverrides(overrides: Record<string, unknown> = {}) {
    return {
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '覆盖率冲刺',
        status: 'running'
      },
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
      deleteActiveSession: vi.fn(),
      setShowRightPanel: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      installSuggestedSkill: vi.fn(),
      refreshSessionDetail: vi.fn(),
      ...overrides
    };
  }

  beforeEach(() => {
    renderedButtons.length = 0;
    renderedAlerts.length = 0;
    renderedModals.length = 0;
    runtimeDrawerProps.length = 0;
    mockModalConfirm.mockReset();
    mockExportApprovalsCenter.mockReset();
    mockExportRuntimeCenter.mockReset();
    mockGetBrowserReplay.mockReset();
    mockStreamReportSchema.mockReset();
    useStateOverride = null;
  });

  it('renders header, error state, workbench and runtime drawer shell', () => {
    mockUseChatSession.mockReturnValue(createChatSessionOverrides());

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('class="chatx-layout is-sidebar-expanded"');
    expect(html).toContain('class="chatx-header__actions"');
    expect(html).toContain('Agent Chat');
    expect(html).toContain('覆盖率冲刺');
    expect(html).toContain('打开工作区');
    expect(html).toContain('打开总览面板');
    expect(html).toContain('连接错误');
    expect(html).toContain('请稍后重试');
    expect(html).toContain('chat-home-sidebar');
    expect(html).toContain('workbench:closed / mode:quick / can-change:yes / bubbles:1 / events:1');
    expect(html).toContain('runtime-drawer:open');
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

    expect(html).toContain('class="chatx-layout is-sidebar-collapsed"');
    expect(html).toContain('data-width="108"');
    expect(html).toContain('data-collapsed-width="108"');
  });

  it('hides dismissible error card when there is no current error and keeps runtime drawer closed', () => {
    mockUseChatSession.mockReturnValue(
      createChatSessionOverrides({
        activeSessionId: '',
        activeSession: null,
        events: [],
        checkpoint: undefined,
        pendingApprovals: [],
        showRightPanel: false,
        error: ''
      })
    );

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('开始新会话');
    expect(html).not.toContain('连接错误');
    expect(html).toContain('runtime-drawer:closed');
    expect(findRenderedButton('刷新当前会话')).toBeUndefined();
    expect(findRenderedButton('删除会话')).toBeUndefined();
  });

  it('wires header buttons to refresh, confirm deletion and open the right panel', async () => {
    const chat = createChatSessionOverrides();
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    await findRenderedButton('刷新当前会话')?.onClick?.();
    expect(chat.refreshSessionDetail).toHaveBeenCalled();

    await findRenderedButton('打开总览面板')?.onClick?.();
    expect(chat.setShowRightPanel).toHaveBeenCalledWith(true);

    await findRenderedButton('删除会话')?.onClick?.();
    expect(mockModalConfirm).toHaveBeenCalledTimes(1);
    const config = mockModalConfirm.mock.calls[0]?.[0] as { onOk?: () => Promise<void>; title?: string };
    expect(config.title).toBe('删除当前会话？');
    await config.onOk?.();
    expect(chat.deleteActiveSession).toHaveBeenCalled();
  });

  it('routes runtime drawer actions to export, replay and share handlers', async () => {
    const chat = createChatSessionOverrides();
    const clipboardWriteText = vi.fn(async () => undefined);
    mockUseChatSession.mockReturnValue(chat);
    mockExportRuntimeCenter.mockResolvedValue({
      filename: 'runtime.json',
      mimeType: 'application/json',
      content: '{"runtime":true}'
    });
    mockExportApprovalsCenter.mockResolvedValue({
      filename: 'approvals.json',
      mimeType: 'application/json',
      content: '{"approvals":true}'
    });
    mockGetBrowserReplay.mockResolvedValue({ replay: true });

    const previousClipboard = navigator.clipboard;
    const previousBlob = globalThis.Blob;
    const previousDocument = globalThis.document;
    const previousUrl = globalThis.URL;
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const click = vi.fn();
    const createElement = vi.fn(() => ({ href: '', download: '', click }));
    const createObjectURL = vi.fn(() => 'blob:chat-home');
    const revokeObjectURL = vi.fn();
    const blobMock = vi.fn(function BlobMock(this: Record<string, unknown>, parts: unknown[], options: unknown) {
      this.parts = parts;
      this.options = options;
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true
    });
    Object.defineProperty(globalThis, 'Blob', {
      value: blobMock,
      configurable: true
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement,
        body: { appendChild, removeChild }
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'URL', {
      value: {
        createObjectURL,
        revokeObjectURL
      },
      configurable: true
    });

    renderToStaticMarkup(<ChatHomePage />);

    const drawer = runtimeDrawerProps[0] as {
      onExportRuntime?: () => Promise<void>;
      onExportApprovals?: () => Promise<void>;
      onDownloadReplay?: () => Promise<void>;
      onCopyShareLinks?: () => Promise<void>;
    };

    await drawer.onExportRuntime?.();
    await drawer.onExportApprovals?.();
    await drawer.onDownloadReplay?.();
    await drawer.onCopyShareLinks?.();

    expect(mockExportRuntimeCenter).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(mockExportApprovalsCenter).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(mockGetBrowserReplay).toHaveBeenCalledWith('session-1');
    expect(clipboardWriteText).toHaveBeenCalledWith(
      ['当前运行视角链接', 'runtime: /runtime-export', 'approvals: /approvals-export', 'replay: /replay'].join('\n')
    );
    expect(blobMock).toHaveBeenCalled();
    expect(createElement).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:chat-home');

    Object.defineProperty(navigator, 'clipboard', { value: previousClipboard, configurable: true });
    Object.defineProperty(globalThis, 'Blob', { value: previousBlob, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: previousDocument, configurable: true });
    Object.defineProperty(globalThis, 'URL', { value: previousUrl, configurable: true });
  });

  it('routes runtime drawer close, learning confirmation and recover callbacks back into chat actions', async () => {
    const chat = createChatSessionOverrides();
    mockUseChatSession.mockReturnValue(chat);

    renderToStaticMarkup(<ChatHomePage />);

    const drawer = runtimeDrawerProps[0] as {
      onClose?: () => void;
      onConfirmLearning?: () => Promise<void>;
      onRecover?: () => Promise<void>;
    };

    drawer.onClose?.();
    await drawer.onConfirmLearning?.();
    await drawer.onRecover?.();

    expect(chat.setShowRightPanel).toHaveBeenCalledWith(false);
    expect(chat.submitLearningConfirmation).toHaveBeenCalled();
    expect(chat.recoverActiveSession).toHaveBeenCalled();
  });

  it('dismisses the error alert with the current error value', () => {
    const dismissedErrorSetter = vi.fn();
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 7) {
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
