import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { buildBubbleItems, buildMainThreadMessages } from '@/features/chat/chat-message-adapter';
import type { ChatMessageRecord, ChatThinkState } from '@/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({
    content,
    className,
    components
  }: {
    content: string;
    className?: string;
    components?: Record<string, React.ComponentType<{ children?: React.ReactNode }>>;
  }) => {
    const Sup = components?.sup;
    const parts = content.split(/(<sup>\s*\d+\s*<\/sup>)/g).filter(Boolean);
    return (
      <div className={className}>
        {parts.map((part, index) => {
          const match = part.match(/^<sup>\s*(\d+)\s*<\/sup>$/i);
          if (match && Sup) {
            return <Sup key={index}>{match[1]}</Sup>;
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </div>
    );
  }
}));

vi.mock('@ant-design/x', async () => {
  const actual = await vi.importActual<typeof import('@ant-design/x')>('@ant-design/x');
  return {
    ...actual,
    Sources: ({
      title,
      items
    }: {
      title?: React.ReactNode;
      items?: Array<{ title: React.ReactNode; description?: React.ReactNode }>;
    }) => (
      <div>
        <div>{title}</div>
        {items?.map((item, index) => (
          <article key={index}>
            <div>{item.title}</div>
            <div>{item.description}</div>
          </article>
        ))}
      </div>
    )
  };
});

describe('chat-message-adapter cognition rendering', () => {
  it('会把绑定到 progress stream 的 Think 渲染到主聊天线程里，但不再把运行态战报混进正文', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'chat_msg_user_1',
        sessionId: 'session-1',
        role: 'user',
        content: '请帮我分析这个问题',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'progress_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '正在分析中...',
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    const thinkState: ChatThinkState = {
      messageId: 'progress_stream_task-1',
      title: '已思考',
      content: '先判断问题类型，再选择执行路径。',
      loading: true,
      blink: true,
      thinkingDurationMs: 1800
    };

    const items = buildBubbleItems({
      messages,
      activeStatus: 'running',
      agentThinking: true,
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent',
      thinkState,
      thoughtItems: [],
      cognitionTargetMessageId: thinkState.messageId,
      cognitionExpanded: true,
      cognitionDurationLabel: '2s',
      cognitionCountLabel: '1 条推理'
    });

    const assistantItem = items.find(item => item.key === 'progress_stream_task-1');
    const html = renderToStaticMarkup(<>{assistantItem?.content}</>);

    expect(html).toContain('思考中');
    expect(html).toContain('先判断问题类型，再选择执行路径。');
    expect(html).not.toContain('正在分析中');
  });

  it('在正式 assistant 消息落库前，progress stream 只作为思考锚点，不直接展示运行态正文', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'chat_msg_user_1',
        sessionId: 'session-1',
        role: 'user',
        content: '帮我分析这个问题',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'progress_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '这是正在流式输出的回复',
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread.map(message => message.id)).toContain('progress_stream_task-1');
    expect(mainThread.find(message => message.id === 'progress_stream_task-1')?.content).toBe('');
  });

  it('正式 assistant 消息已经存在时，会隐藏重复的 progress stream 回复', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'progress_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '这是正在流式输出的回复',
        createdAt: '2026-03-28T00:00:01.000Z'
      },
      {
        id: 'assistant_final_1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '这是最终回复',
        createdAt: '2026-03-28T00:00:02.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread.map(message => message.id)).not.toContain('progress_stream_task-1');
    expect(mainThread.map(message => message.id)).toContain('assistant_final_1');
  });

  it('聊天记录里有来源引用时会渲染 Sources 卡片', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'chat_msg_user_1',
        sessionId: 'session-1',
        role: 'user',
        content: '帮我总结这些资料',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是结合来源的最终回复。',
        createdAt: '2026-03-28T00:00:00.500Z'
      },
      {
        id: 'checkpoint_sources_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已收集 2 条来源证据。',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'web',
              sourceUrl: 'https://example.com/a',
              trustClass: 'high',
              summary: '来源 A'
            },
            {
              id: 'source-2',
              sourceType: 'document',
              trustClass: 'internal',
              summary: '来源 B'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });

    const assistantItem = items.find(item => item.key === 'assistant-1');
    const html = renderToStaticMarkup(<>{assistantItem?.content}</>);

    expect(html).toContain('来源引用');
    expect(html).toContain('网页引用');
    expect(html).toContain('文档引用');
    expect(html).toContain('来源 A');
    expect(html).toContain('来源 B');
  });

  it('assistant 已经包含引用来源段落时，不再重复渲染 evidence_digest 卡片', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: ['结论', '这个规划方向基本正确。', '', '引用来源', '1. Playwright 官方文档（playwright.dev）'].join(
          '\n'
        ),
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'checkpoint_sources_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已收集 1 条来源引用。',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'web',
              sourceUrl: 'https://playwright.dev/',
              trustClass: 'official',
              summary: 'Playwright 官方文档'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread).toHaveLength(1);
    expect(mainThread[0]?.id).toBe('assistant-1');
  });

  it('会把来源引用挂到最后一条 assistant 回复下方，而不是单独作为新消息', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是最终回复正文。',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'checkpoint_sources_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已收集 1 条来源引用。',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'web',
              sourceUrl: 'https://example.com/a',
              trustClass: 'official',
              summary: 'Example 官方资料'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });

    expect(items).toHaveLength(1);
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);
    expect(html).toContain('这是最终回复正文。');
    expect(html).toContain('来源引用');
    expect(html).toContain('Example 官方资料');
  });

  it('assistant 正文里出现 sup 引用时会直接渲染 inline Sources，且不再重复渲染来源引用卡', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是最终回复<sup>1</sup>',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'checkpoint_sources_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已收集 1 条来源引用。',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'web',
              sourceUrl: 'https://example.com/a',
              trustClass: 'official',
              summary: 'Example 官方资料'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });

    const html = renderToStaticMarkup(<>{items[0]?.content}</>);
    expect(html).toContain('这是最终回复');
    expect(html).toContain('Example 官方资料');
    expect(html).not.toContain('来源引用');
  });

  it('没有 assistant 正文时，不单独渲染 evidence_digest 卡片', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'checkpoint_sources_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已收集 1 条来源引用。',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'web',
              sourceUrl: 'https://example.com/a',
              trustClass: 'official',
              summary: 'Example 官方资料'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });

    expect(items).toHaveLength(0);
  });

  it('不会把历史 skill 建议卡继续放进主线程', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'checkpoint_skill_search_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '旧的 skill 建议',
        card: {
          type: 'skill_suggestions',
          capabilityGapDetected: true,
          status: 'auto-installed',
          safetyNotes: [],
          suggestions: [
            {
              id: 'skill-1',
              kind: 'remote-skill',
              displayName: 'find-skills',
              summary: '帮助检索技能',
              score: 0.9,
              availability: 'installable-remote',
              reason: '检测到能力缺口',
              requiredCapabilities: [],
              installState: {
                receiptId: 'receipt-1',
                status: 'installed'
              }
            }
          ]
        },
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread).toEqual([]);
  });

  it('不会把 worker_dispatch 和 skill_reuse 再放进主线程', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'checkpoint_dispatch_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '当前执行路线已经确认',
        card: {
          type: 'worker_dispatch',
          currentMinistry: '工部',
          currentWorker: 'code-worker',
          usedInstalledSkills: ['find-skills'],
          usedCompanyWorkers: ['reviewer']
        },
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'checkpoint_skill_reuse_task-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已复用既有技能和公司专员。',
        card: {
          type: 'skill_reuse',
          reusedSkills: ['repo-analysis'],
          usedInstalledSkills: ['find-skills'],
          usedCompanyWorkers: ['reviewer']
        },
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread).toEqual([]);
  });

  it('新一轮空 assistant 占位不会被折叠进上一轮 assistant，保证主线程立刻出现新的回复位', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        content: '先回答上一轮',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '上一轮已经答完。',
        createdAt: '2026-03-28T00:00:01.000Z'
      },
      {
        id: 'user-2',
        sessionId: 'session-1',
        role: 'user',
        content: '继续下一轮',
        createdAt: '2026-03-28T00:00:02.000Z'
      },
      {
        id: 'pending_assistant_session-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-03-28T00:00:03.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages, 'pending_assistant_session-1');

    expect(mainThread.map(message => message.id)).toEqual([
      'user-1',
      'assistant-1',
      'user-2',
      'pending_assistant_session-1'
    ]);
  });

  it('当前轮 assistant 还没有 token 时，会先渲染可见的回复占位文案', () => {
    const items = buildBubbleItems({
      messages: [
        {
          id: 'user-1',
          sessionId: 'session-1',
          role: 'user',
          content: '继续说',
          createdAt: '2026-03-28T00:00:00.000Z'
        },
        {
          id: 'pending_assistant_session-1',
          sessionId: 'session-1',
          role: 'assistant',
          content: '',
          createdAt: '2026-03-28T00:00:01.000Z'
        }
      ],
      activeStatus: 'running',
      agentThinking: true,
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent',
      cognitionTargetMessageId: 'pending_assistant_session-1',
      thinkState: {
        messageId: 'pending_assistant_session-1',
        title: '正在准备回复',
        content: '正在整理上下文',
        loading: true,
        blink: true,
        thinkingDurationMs: 800
      },
      thoughtItems: []
    });

    const assistantItem = items.find(item => item.key === 'pending_assistant_session-1');
    const html = renderToStaticMarkup(<>{assistantItem?.content}</>);

    expect(html).toContain('正在生成回复...');
    expect(html).toContain('思考中');
    expect(html).toContain('正在整理上下文');
  });

  it('正式 assistant 内容已经到达后，会隐藏 pending assistant 占位，避免先分裂后合并', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        content: '继续说',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'pending_assistant_session-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-03-28T00:00:01.000Z'
      },
      {
        id: 'assistant-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是正式回复正文。',
        createdAt: '2026-03-28T00:00:02.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages, 'pending_assistant_session-1');

    expect(mainThread.map(message => message.id)).toEqual(['user-1', 'assistant-2']);
  });
});
