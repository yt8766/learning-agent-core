import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let useStateOverride:
  | ((actualUseState: (initialState?: unknown) => unknown, initialState?: unknown) => unknown)
  | null = null;
const renderedButtons: Array<{ children?: ReactNode; onClick?: () => void | Promise<void> }> = [];
const renderedDropdownMenus: Array<Record<string, unknown>> = [];
const renderedSenders: Array<Record<string, unknown>> = [];
const renderedSegmentedControls: Array<{
  value?: string;
  onChange?: (value: string) => void;
}> = [];

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
  Segmented: (props: {
    options?: Array<{ label?: ReactNode; value?: string }>;
    value?: string;
    onChange?: (value: string) => void;
  }) => {
    renderedSegmentedControls.push({ value: props.value, onChange: props.onChange });
    return (
      <div>
        mode:{props.value}
        {(props.options ?? []).map(option => (
          <button key={option.value}>{option.label}</button>
        ))}
      </div>
    );
  },
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>
  }
}));

vi.mock('@ant-design/x', () => ({
  Bubble: {
    List: ({ items }: { items: Array<{ content?: ReactNode }> }) => (
      <div>
        bubbles:{items.length}
        {items.map((item, index) => (
          <div key={index}>{item.content}</div>
        ))}
      </div>
    )
  },
  Sender: Object.assign(
    (props: Record<string, unknown>) => {
      renderedSenders.push(props);
      return (
        <div>
          <span>{props.placeholder as ReactNode}</span>
          {(props.footer as ((node: ReactNode) => ReactNode) | undefined)?.(<button>send</button>)}
        </div>
      );
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
    renderedSenders.length = 0;
    renderedSegmentedControls.length = 0;
    renderedSegmentedControls.length = 0;
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
        chatMode="quick"
        onChatModeChange={vi.fn()}
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    expect(html).toContain('mission-control');
    expect(html).toContain('使用快速模式开始对话');
    expect(html).toContain('快速模式');
    expect(html).toContain('专家模式');
    expect(html).toContain('给 Agent Chat 发送消息');
    expect(html).toContain('更多建议');
    expect(html).not.toContain('Frontline Workspace');
    expect(html).not.toContain('Frontline Workspace');
    expect(html).not.toContain('切换模型');
    expect(html).not.toContain('自动选择');
  });

  it('routes empty and composer mode controls through the shared chat mode handler', () => {
    const onChatModeChange = vi.fn();

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'idle'
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
        chatMode="quick"
        onChatModeChange={onChatModeChange}
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    renderedSegmentedControls[0]?.onChange?.('expert');
    renderedSegmentedControls[1]?.onChange?.('expert');

    expect(onChatModeChange).toHaveBeenCalledWith('expert');
    expect(onChatModeChange).toHaveBeenCalledTimes(2);
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
              currentWorker: 'gongbu-code',
              externalSources: [{ id: 'source-1' }, { id: 'source-2' }, { id: 'source-3' }],
              reusedMemories: ['memory-1'],
              reusedRules: ['rule-1'],
              reusedSkills: ['repo-analysis'],
              usedInstalledSkills: ['find-skills'],
              usedCompanyWorkers: ['repo-reviewer'],
              connectorRefs: ['github-mcp'],
              learningEvaluation: {
                score: 0.91,
                confidence: 'high',
                notes: ['已形成可复用经验'],
                recommendedCandidateIds: ['candidate-1'],
                autoConfirmCandidateIds: [],
                sourceSummary: {
                  externalSourceCount: 3,
                  internalSourceCount: 2,
                  reusedMemoryCount: 1,
                  reusedRuleCount: 1,
                  reusedSkillCount: 1
                }
              },
              skillSearch: {
                capabilityGapDetected: true,
                status: 'suggested',
                safetyNotes: [],
                suggestions: [],
                mcpRecommendation: {
                  kind: 'connector',
                  summary: '需要浏览器连接器',
                  reason: '当前缺少网页检查能力',
                  connectorTemplateId: 'browser-mcp-template'
                }
              }
            },
            sendMessage: vi.fn(),
            cancelActiveSession: vi.fn(),
            hasMessages: true
          } as any
        }
        chatMode="quick"
        onChatModeChange={vi.fn()}
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
    expect(html).toContain('Workspace Vault');
    expect(html).toContain('Workspace signals: 9 项');
    expect(html).toContain('Evidence readiness: 3 条来源');
    expect(html).toContain('Reuse readiness: 5 项复用');
    expect(html).toContain('Skill draft readiness: 1 个候选');
    expect(html).toContain('Capability gap: 待补强');
    expect(html).toContain('Capability gap · 需要浏览器连接器');
    expect(html).not.toContain('learning_summary');
    expect(html).toContain('Workspace Vault');
    expect(html).toContain('Workspace signals: 9 项');
    expect(html).toContain('Evidence readiness: 3 条来源');
    expect(html).toContain('Reuse readiness: 5 项复用');
    expect(html).toContain('Skill draft readiness: 1 个候选');
    expect(html).toContain('Capability gap: 待补强');
    expect(html).toContain('Capability gap · 需要浏览器连接器');
    expect(html).not.toContain('learning_summary');
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

  it('renders the conversation anchor rail and scrolls to an anchor when selected', () => {
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn(() => ({ scrollIntoView }));

    vi.stubGlobal('document', { getElementById });

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
                id: 'user-1',
                role: 'user',
                content: '请帮我整理当前任务'
              },
              {
                id: 'assistant-1',
                role: 'assistant',
                content: '已经给出结论'
              },
              {
                id: 'evidence-1',
                role: 'assistant',
                content: '',
                card: {
                  type: 'evidence_digest',
                  sources: []
                }
              }
            ],
            pendingApprovals: [],
            checkpoint: undefined,
            sendMessage: vi.fn(),
            cancelActiveSession: vi.fn(),
            hasMessages: true
          } as any
        }
        chatMode="quick"
        onChatModeChange={vi.fn()}
        showWorkbench={false}
        bubbleItems={[
          { key: 'user-1', content: 'user bubble' } as any,
          { key: 'assistant-1', content: 'assistant bubble' } as any
        ]}
        streamEvents={[]}
      />
    );

    expect(html).toContain('当前对话定位');
    expect(html).toContain('chatx-anchor-rail');
    expect(html).toContain('chatx-message-anchor-user-1');
    expect(html).toContain('chatx-message-anchor-assistant-1');
    expect(html).toContain('请帮我整理当前任务');
    expect(html).toContain('已经给出结论');
    expect(html).not.toContain('Evidence digest');

    renderedButtons.find(button => button.children === '已经给出结论')?.onClick?.();

    expect(getElementById).toHaveBeenCalledWith('chatx-message-anchor-assistant-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });

    vi.unstubAllGlobals();
  });

  it('renders the conversation anchor rail and scrolls to an anchor when selected', () => {
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn(() => ({ scrollIntoView }));

    vi.stubGlobal('document', { getElementById });

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
                id: 'user-1',
                role: 'user',
                content: '请帮我整理当前任务'
              },
              {
                id: 'assistant-1',
                role: 'assistant',
                content: '已经给出结论'
              },
              {
                id: 'evidence-1',
                role: 'assistant',
                content: '',
                card: {
                  type: 'evidence_digest',
                  sources: []
                }
              }
            ],
            pendingApprovals: [],
            checkpoint: undefined,
            sendMessage: vi.fn(),
            cancelActiveSession: vi.fn(),
            hasMessages: true
          } as any
        }
        chatMode="quick"
        onChatModeChange={vi.fn()}
        showWorkbench={false}
        bubbleItems={[
          { key: 'user-1', content: 'user bubble' } as any,
          { key: 'assistant-1', content: 'assistant bubble' } as any
        ]}
        streamEvents={[]}
      />
    );

    expect(html).toContain('当前对话定位');
    expect(html).toContain('chatx-anchor-rail');
    expect(html).toContain('chatx-message-anchor-user-1');
    expect(html).toContain('chatx-message-anchor-assistant-1');
    expect(html).toContain('请帮我整理当前任务');
    expect(html).toContain('已经给出结论');
    expect(html).not.toContain('Evidence digest');

    renderedButtons.find(button => button.children === '已经给出结论')?.onClick?.();

    expect(getElementById).toHaveBeenCalledWith('chatx-message-anchor-assistant-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });

    vi.unstubAllGlobals();
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
        chatMode="quick"
        onChatModeChange={vi.fn()}
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
        chatMode="quick"
        onChatModeChange={vi.fn()}
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
    renderedSenders.length = 0;

    useStateOverride = (actualUseState, initial) => {
      if (initial === '') {
        return ['给我一个实现方案', vi.fn()];
      }
      if (initial === null) {
        return [null, vi.fn()];
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
        chatMode="expert"
        onChatModeChange={vi.fn()}
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

  it('returns to quick mode when a quick action is selected from expert mode', () => {
    const onChatModeChange = vi.fn();

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'idle'
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
        chatMode="expert"
        onChatModeChange={onChatModeChange}
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    (renderedDropdownMenus[0]?.onClick as ((info: { key: string }) => void) | undefined)?.({ key: '审查风险' });

    expect(onChatModeChange).toHaveBeenCalledWith('quick');
  });

  it('returns to quick mode when a quick action is selected from expert mode', () => {
    const onChatModeChange = vi.fn();

    renderToStaticMarkup(
      <ChatHomeWorkbench
        chat={
          {
            activeSession: {
              id: 'session-1',
              status: 'idle'
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
        chatMode="expert"
        onChatModeChange={onChatModeChange}
        showWorkbench={false}
        bubbleItems={[]}
        streamEvents={[]}
      />
    );

    (renderedDropdownMenus[0]?.onClick as ((info: { key: string }) => void) | undefined)?.({ key: '审查风险' });

    expect(onChatModeChange).toHaveBeenCalledWith('quick');
  });
});
