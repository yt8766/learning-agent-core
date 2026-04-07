import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockUseChatSession = vi.fn();

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    App: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    ConfigProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Layout: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
      Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
      Sider: ({ children }: { children?: ReactNode }) => <aside>{children}</aside>,
      Content: ({ children }: { children?: ReactNode }) => <main>{children}</main>
    }),
    Alert: ({ title, description }: { title?: ReactNode; description?: ReactNode }) => (
      <section>
        <div>{title}</div>
        <div>{description}</div>
      </section>
    ),
    Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
    Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>
    },
    Modal: ({ title, children, open }: { title?: ReactNode; children?: ReactNode; open?: boolean }) =>
      open ? (
        <section>
          <h2>{title}</h2>
          {children}
        </section>
      ) : null
  };
});

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/api/chat-api', () => ({
  buildApprovalsCenterExportUrl: () => '/approvals-export',
  buildBrowserReplayUrl: () => '/replay',
  buildRuntimeCenterExportUrl: () => '/runtime-export',
  exportApprovalsCenter: vi.fn(),
  exportRuntimeCenter: vi.fn(),
  getBrowserReplay: vi.fn()
}));

vi.mock('@/features/chat/chat-message-adapter', () => ({
  buildBubbleItems: () => [{ key: 'bubble-1', content: 'assistant bubble' }]
}));

vi.mock('@/features/runtime-panel/chat-runtime-drawer', () => ({
  ChatRuntimeDrawer: ({ open }: { open: boolean }) => <div>runtime-drawer:{open ? 'open' : 'closed'}</div>,
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
    streamEvents,
    showWorkbench
  }: {
    bubbleItems: Array<{ content: string }>;
    streamEvents: Array<{ summary: string }>;
    showWorkbench: boolean;
  }) => (
    <div>
      workbench:{showWorkbench ? 'open' : 'closed'} / bubbles:{bubbleItems.length} / events:{streamEvents.length}
    </div>
  )
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

  it('renders header, error state, workbench and runtime drawer shell', () => {
    mockUseChatSession.mockReturnValue(createChatSessionOverrides());

    const html = renderToStaticMarkup(<ChatHomePage />);

    expect(html).toContain('Agent Chat');
    expect(html).toContain('覆盖率冲刺');
    expect(html).toContain('打开工作区');
    expect(html).toContain('打开总览面板');
    expect(html).toContain('连接错误');
    expect(html).toContain('请稍后重试');
    expect(html).toContain('chat-home-sidebar');
    expect(html).toContain('workbench:closed / bubbles:1 / events:1');
    expect(html).toContain('runtime-drawer:open');
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
  });
});
