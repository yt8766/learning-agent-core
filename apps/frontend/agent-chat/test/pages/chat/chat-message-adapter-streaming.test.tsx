import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { buildBubbleItems, buildMainThreadMessages } from '@/pages/chat/chat-message-adapter';
import type { ChatResponseStepsForMessage } from '@/utils/chat-response-step-projections';
import type { ChatMessageRecord } from '@/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({
    content,
    className,
    streaming
  }: {
    content: string;
    className?: string;
    streaming?: Record<string, unknown>;
  }) => (
    <div className={className} data-streaming={JSON.stringify(streaming ?? null)}>
      {content}
    </div>
  )
}));

vi.mock('@ant-design/x', async () => ({
  Sources: ({ items }: { items?: Array<{ title: React.ReactNode }> }) => (
    <div>
      {items?.map((item, index) => (
        <span key={index}>{item.title}</span>
      ))}
    </div>
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
    expect(html).not.toContain('<ol class="chat-response-steps__list" hidden');
  });

  it('keeps the running cognition summary clickable when only runtime thinking state exists', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '正在处理。',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      cognitionTargetMessageId: 'direct_reply_task-1',
      cognitionExpanded: false,
      thinkState: {
        messageId: 'direct_reply_task-1',
        title: '正在思考',
        content: '',
        loading: true,
        blink: true,
        thinkingDurationMs: 12000
      },
      onToggleCognition: () => undefined,
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('思考中（用时 12s）');
    expect(html).toContain('chatx-inline-think__action');
    expect(html).toContain('⌄');
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

  it('does not keep completed assistant markdown in streaming mode only because thinking state lags', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '最终回复已经落地。',
        createdAt: '2026-05-02T08:30:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      agentThinking: true,
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('最终回复已经落地。');
    expect(html).toContain('data-streaming="null"');
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
    expect(html.indexOf('已处理 1m 13s')).toBeLessThan(html.indexOf('处理完成。'));
  });
});
