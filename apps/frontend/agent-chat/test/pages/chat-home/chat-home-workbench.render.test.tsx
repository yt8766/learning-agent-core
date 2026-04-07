import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Alert: ({ title, description }: { title?: ReactNode; description?: ReactNode }) => (
    <section>
      <div>{title}</div>
      <div>{description}</div>
    </section>
  ),
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
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
  Dropdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Switch: () => <button>switch</button>,
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
    ({ footer }: { footer?: (node: ReactNode) => ReactNode }) => <div>{footer?.(<button>send</button>)}</div>,
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
  buildSubmitMessage: (input: string) => ({ display: input.trim(), payload: input.trim() }),
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
});
