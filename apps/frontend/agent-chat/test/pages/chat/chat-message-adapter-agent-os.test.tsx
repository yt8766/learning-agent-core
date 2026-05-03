import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import { buildBubbleItems } from '@/pages/chat/chat-message-adapter';
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

describe('chat-message-adapter inline Agent OS display modes', () => {
  it('keeps ordinary answer-only replies on the thinking display path', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-answer',
        sessionId: 'session-1',
        role: 'assistant',
        content: '<think>用户问 Docker 概念，需要简洁解释。</think>镜像是模板，容器是运行实例。',
        createdAt: '2026-05-03T10:00:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      responseStepsByMessageId: {
        'assistant-answer': {
          messageId: 'assistant-answer',
          status: 'completed',
          displayMode: 'answer_only',
          updatedAt: '2026-05-03T10:00:01.000Z',
          summary: {
            title: '已思考',
            completedCount: 1,
            runningCount: 0,
            blockedCount: 0,
            failedCount: 0
          },
          steps: [],
          agentOsGroups: []
        }
      },
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('已思考');
    expect(html).not.toContain('已处理');
    expect(html).not.toContain('chat-response-steps--agent-os');
  });

  it('renders execution runs as one inline Agent OS entry without a separate thinking entry', () => {
    const responseSteps: ChatResponseStepsForMessage = {
      messageId: 'assistant-execution',
      status: 'completed',
      displayMode: 'agent_execution',
      updatedAt: '2026-05-03T10:00:01.000Z',
      summary: {
        title: '已处理 2 个动作',
        completedCount: 2,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      steps: [],
      agentOsGroups: [
        {
          kind: 'thinking',
          title: '思考',
          status: 'completed',
          steps: []
        },
        {
          kind: 'execution',
          title: '执行',
          status: 'completed',
          steps: []
        }
      ]
    };
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-execution',
        sessionId: 'session-1',
        role: 'assistant',
        content: '<think>这段思考应该并入 Agent OS。</think>已完成 chat 步骤展示收束。',
        createdAt: '2026-05-03T10:00:00.000Z'
      }
    ];

    const items = buildBubbleItems({
      messages,
      responseStepsByMessageId: { 'assistant-execution': responseSteps },
      cognitionTargetMessageId: 'assistant-execution',
      thinkState: {
        title: '已思考',
        content: '这段思考应该并入 Agent OS。',
        loading: false
      },
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent'
    });
    const html = renderToStaticMarkup(<>{items[0]?.content}</>);

    expect(html).toContain('已处理 2 个动作');
    expect(html).not.toContain('这段思考应该并入 Agent OS。');
    expect(html.match(/已思考/g)?.length ?? 0).toBe(0);
  });
});
