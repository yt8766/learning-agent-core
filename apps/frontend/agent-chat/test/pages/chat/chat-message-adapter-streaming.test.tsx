import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { buildBubbleItems, buildMainThreadMessages } from '@/pages/chat/chat-message-adapter';
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import type { ChatMessageRecord } from '@/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content, className }: { content: string; className?: string }) => (
    <div className={className}>{content}</div>
  )
}));

vi.mock('@ant-design/x', async () => ({
  Think: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <section>
      <div>{title}</div>
      <div>{children}</div>
    </section>
  ),
  ThoughtChain: ({ items }: { items?: Array<{ title?: React.ReactNode; description?: React.ReactNode }> }) => (
    <section>
      {items?.map((item, index) => (
        <article key={index}>
          <div>{item.title}</div>
          <div>{item.description}</div>
        </article>
      ))}
    </section>
  )
}));

const baseResponseSteps: ChatResponseStepsForMessage = {
  messageId: 'direct_reply_task-1',
  status: 'running',
  updatedAt: '2026-05-02T08:30:00.000Z',
  summary: {
    title: '已探索 4 个文件',
    completedCount: 4,
    runningCount: 0,
    blockedCount: 0,
    failedCount: 0
  },
  steps: [
    {
      id: 'step-1',
      sessionId: 'session-1',
      messageId: 'direct_reply_task-1',
      sequence: 0,
      phase: 'explore',
      status: 'completed',
      title: 'Read chat-message-adapter.tsx',
      startedAt: '2026-05-02T08:30:00.000Z',
      completedAt: '2026-05-02T08:30:10.000Z',
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called'
    }
  ]
};

describe('chat-message-adapter direct reply streaming', () => {
  it('keeps direct reply stream text visible while the assistant is running', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '我会先快速查现有链路，然后补最小闭环。',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'running',
      responseStepsByMessageId: { 'direct_reply_task-1': baseResponseSteps },
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('我会先快速查现有链路，然后补最小闭环。');
    expect(html).toContain('已探索 4 个文件');
    expect(html).toContain('hidden');
  });

  it('keeps partial direct reply text after cancellation when no final assistant message exists', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '已经完成到一半的可读回复。',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread).toHaveLength(1);
    expect(mainThread[0]?.content).toBe('已经完成到一半的可读回复。');
  });

  it('keeps direct reply text when a cancellation notice is appended to the thread', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '取消前已经输出的回复。',
        createdAt: '2026-05-02T08:30:00.000Z'
      },
      {
        id: 'event_evt-cancel-1',
        sessionId: 'session-1',
        role: 'system',
        content: '本轮已终止：用户停止当前会话',
        card: {
          type: 'control_notice',
          tone: 'warning',
          label: '本轮已终止'
        },
        createdAt: '2026-05-02T08:31:00.000Z'
      }
    ];

    const mainThread = buildMainThreadMessages(messages);

    expect(mainThread.map(message => message.content)).toEqual(['取消前已经输出的回复。']);
  });

  it('renders completed response steps as a compact collapsed summary header', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '处理完成。',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      responseStepsByMessageId: {
        'direct_reply_task-1': {
          ...baseResponseSteps,
          status: 'completed',
          summary: { ...baseResponseSteps.summary, title: '已处理 1m 13s' }
        }
      },
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('已处理 1m 13s');
    expect(html).toContain('chat-response-steps__chevron');
    expect(html).not.toContain('查看步骤细节');
  });
});
