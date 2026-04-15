import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let useStateOverride:
  | ((actualUseState: (initialState?: unknown) => unknown, initialState?: unknown) => unknown)
  | null = null;
const renderedButtons: Array<{ children?: ReactNode; onClick?: () => void | Promise<void> }> = [];
const renderedDropdownMenus: Array<Record<string, unknown>> = [];
const renderedSwitches: Array<Record<string, unknown>> = [];
const renderedSenders: Array<Record<string, unknown>> = [];

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

vi.mock('antd', () => ({
  Alert: ({ title, description }: { title?: ReactNode; description?: ReactNode }) => (
    <section>
      <div>{title}</div>
      <div>{description}</div>
    </section>
  ),
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void | Promise<void> }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children}</button>;
  },
  Collapse: ({ items }: { items?: Array<{ key: string; label: ReactNode; children: ReactNode }> }) => (
    <div>
      {(items ?? []).map(item => (
        <section key={item.key}>
          <h3>{item.label}</h3>
          <div>{item.children}</div>
        </section>
      ))}
    </div>
  ),
  Dropdown: ({ children, menu }: { children?: ReactNode; menu?: Record<string, unknown> }) => {
    if (menu) {
      renderedDropdownMenus.push(menu);
    }
    return <div>{children}</div>;
  },
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Switch: (props: Record<string, unknown>) => {
    renderedSwitches.push(props);
    return <button>switch</button>;
  },
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>
  }
}));

vi.mock('@ant-design/x', () => ({
  Bubble: {
    List: ({ items }: { items: Array<{ content?: string }> }) => <div>bubbles:{items.length}</div>
  },
  Sender: Object.assign(
    (props: Record<string, unknown>) => {
      renderedSenders.push(props);
      return <div>{(props.footer as ((node: ReactNode) => ReactNode) | undefined)?.(<button>send</button>)}</div>;
    },
    {
      Switch: ({
        checkedChildren,
        unCheckedChildren
      }: {
        checkedChildren?: ReactNode;
        unCheckedChildren?: ReactNode;
      }) => <button>{checkedChildren ?? unCheckedChildren}</button>
    }
  )
}));

vi.mock('@/pages/chat-home/chat-home-helpers', () => ({
  CHAT_ROLE_CONFIG: {},
  EVENT_LABELS: {},
  buildEventSummary: () => 'event-summary',
  buildProjectContextSnapshot: () => ({
    objective: '整理当前上下文',
    latestOutcome: '已经形成一轮结论',
    evidenceCount: 3,
    skillCount: 2,
    connectorCount: 1,
    currentWorker: 'gongbu-code'
  }),
  humanizeOperationalCopy: (value: string) => value
}));

vi.mock('@/pages/chat-home/chat-home-mission-control', () => ({
  SessionMissionControl: () => <div>mission-control</div>
}));

vi.mock('@/pages/chat-home/chat-home-submit', () => ({
  buildSubmitMessage: (input: string, prefixes: string[] = []) => ({
    display: input.trim(),
    payload: prefixes.length ? `/${prefixes.join('-')} ${input.trim()}` : input.trim()
  }),
  stripLeadingWorkflowCommand: (input: string) => input.replace(/^\/\S+\s*/, '')
}));

vi.mock('@/pages/chat-home/chat-home-workbench-sections', () => ({
  buildWorkbenchSectionState: () => ({
    runningHint: '当前正在执行中',
    compressionHint: '上下文压缩已触发',
    llmFallbackNotes: ['fallback note'],
    workbenchItems: [
      {
        key: 'cabinet',
        label: '情报柜',
        children: <div>section-body</div>
      }
    ]
  }),
  ChatHomeApprovalActions: () => <div>approval-actions</div>
}));

import { ChatHomeWorkbench } from '@/pages/chat-home/chat-home-workbench';

describe('chat-home-workbench component', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
    renderedDropdownMenus.length = 0;
    renderedSwitches.length = 0;
    renderedSenders.length = 0;
    useStateOverride = null;
  });

  it('renders empty frontline entry and mission control before a conversation starts', () => {
    const html = renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'running'
            },
            activeSessionId: 'session-1',
            messages: [],
            pendingApprovals: [],
            checkpoint: undefined,
            sendMessage: vi.fn(),
            cancelActiveSession: vi.fn(),
            hasMessages: false
          } as any
        }
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    expect(html).toContain('mission-control');
    expect(html).toContain('Frontline Workspace');
    expect(html).toContain('直接输入你的目标');
    expect(html).toContain('更多建议');
    expect(html).toContain('计划模式');
  });

  it('renders workspace shell, alerts, sections and follow-up actions when workbench is open', () => {
    const html = renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'completed'
            },
            activeSessionId: 'session-1',
            messages: [
              {
                id: 'assistant-1',
                role: 'assistant',
                content: '已经给出结论'
              }
            ],
            pendingApprovals: [],
            checkpoint: {
              currentWorker: 'gongbu-code'
            },
            sendMessage: vi.fn(),
            cancelActiveSession: vi.fn(),
            hasMessages: true
          } as any
        }
        showWorkbench
        bubbleItems={[{ key: 'bubble-1', content: 'assistant bubble' } as any]}
        streamEvents={[{ id: 'evt-1', summary: 'event-summary' } as any]}
      />
    );

    expect(html).toContain('bubbles:1');
    expect(html).toContain('Current Workspace');
    expect(html).toContain('整理当前上下文');
    expect(html).toContain('已经形成一轮结论');
    expect(html).toContain('3 条来源');
    expect(html).toContain('2 个技能');
    expect(html).toContain('1 个连接器');
    expect(html).toContain('gongbu-code');
    expect(html).toContain('继续深挖');
    expect(html).toContain('生成执行任务');
    expect(html).toContain('复制工作区摘要');
    expect(html).toContain('当前正在执行中');
    expect(html).toContain('上下文压缩已触发');
    expect(html).toContain('fallback note');
    expect(html).toContain('情报柜');
    expect(html).toContain('section-body');
    expect(html).toContain('approval-actions');
  });

  it('routes workspace follow-up actions and summary copy through the expected chat handlers', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const clipboardWriteText = vi.fn(async () => undefined);
    const previousClipboard = navigator.clipboard;

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true
    });

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'completed'
            },
            activeSessionId: 'session-1',
            messages: [
              {
                id: 'assistant-1',
                role: 'assistant',
                content: '已经给出结论'
              }
            ],
            pendingApprovals: [],
            checkpoint: {
              currentWorker: 'gongbu-code'
            },
            sendMessage,
            cancelActiveSession: vi.fn(),
            hasMessages: true
          } as any
        }
        showWorkbench
        bubbleItems={[{ key: 'bubble-1', content: 'assistant bubble' } as any]}
        streamEvents={[{ id: 'evt-1', summary: 'event-summary' } as any]}
      />
    );

    await renderedButtons.find(button => button.children === '继续深挖')?.onClick?.();
    await renderedButtons.find(button => button.children === '复制工作区摘要')?.onClick?.();

    expect(sendMessage).toHaveBeenCalledWith({
      display: '请基于刚才的结论继续深挖最关键的风险、假设和下一步',
      payload: '/qa 请基于刚才的结论继续深挖最关键的风险、假设和下一步'
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(
      [
        '当前目标：整理当前上下文',
        '最新结论：已经形成一轮结论',
        '来源数：3',
        '技能数：2',
        '连接器数：1',
        '当前执行者：gongbu-code'
      ].join('\n')
    );

    Object.defineProperty(navigator, 'clipboard', { value: previousClipboard, configurable: true });
  });

  it('submits sender payloads for direct mode, plan mode and cancel actions', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const cancelActiveSession = vi.fn(async () => undefined);

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'running'
            },
            activeSessionId: 'session-1',
            messages: [],
            pendingApprovals: [],
            checkpoint: undefined,
            sendMessage,
            cancelActiveSession,
            hasMessages: false
          } as any
        }
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    const sender = renderedSenders[0] as {
      onSubmit?: (value: string) => void;
      onCancel?: () => void;
    };

    sender.onSubmit?.('直接回答这个问题');
    sender.onCancel?.();

    expect(sendMessage).toHaveBeenCalledWith({
      display: '直接回答这个问题',
      payload: '直接回答这个问题'
    });
    expect(cancelActiveSession).toHaveBeenCalled();

    renderedButtons.length = 0;
    renderedDropdownMenus.length = 0;
    renderedSwitches.length = 0;
    renderedSenders.length = 0;

    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 1) {
        return ['给我一个实现方案', vi.fn()];
      }
      if (stateCallIndex === 2) {
        return [null, vi.fn()];
      }
      if (stateCallIndex === 3) {
        return [true, vi.fn()];
      }
      return actualUseState(initial);
    };

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-2',
              status: 'idle'
            },
            activeSessionId: 'session-2',
            messages: [],
            pendingApprovals: [],
            checkpoint: undefined,
            sendMessage,
            cancelActiveSession,
            hasMessages: false
          } as any
        }
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    const planSender = renderedSenders[0] as {
      onSubmit?: (value: string) => void;
    };
    planSender.onSubmit?.('给我一个实现方案');

    expect(sendMessage).toHaveBeenLastCalledWith({
      display: '给我一个实现方案',
      payload: '/plan 给我一个实现方案'
    });
  });
});
