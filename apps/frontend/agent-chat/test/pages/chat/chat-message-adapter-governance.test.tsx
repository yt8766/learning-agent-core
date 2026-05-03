import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { buildBubbleItems } from '@/pages/chat/chat-message-adapter';
import type { ChatMessageRecord, ChatThinkState } from '@/types/chat';

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
  ),
  Sources: ({ title, items }: { title?: React.ReactNode; items?: Array<{ title: React.ReactNode }> }) => (
    <div>
      <span>{title}</span>
      {items?.map(item => (
        <span key={String(item.title)}>{item.title}</span>
      ))}
    </div>
  )
}));

describe('chat-message-adapter governance summary', () => {
  it('folds completed runtime cognition into a quiet inline summary row', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        content: '请分析这个问题',
        createdAt: '2026-04-26T00:00:00.000Z'
      },
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是最终回复。',
        createdAt: '2026-04-26T00:00:01.000Z'
      }
    ];
    const thinkState: ChatThinkState = {
      messageId: 'assistant-1',
      title: '已思考',
      content: '先判断问题类型，再选择执行路径。',
      loading: false,
      blink: false,
      thinkingDurationMs: 2000
    };

    const items = buildBubbleItems({
      messages,
      activeStatus: 'completed',
      onCopy: () => undefined,
      getAgentLabel: role => role ?? 'agent',
      thinkState,
      thoughtItems: [{ key: 'thought-1', title: '分析', description: '用现有上下文判断。' }],
      cognitionTargetMessageId: 'assistant-1',
      cognitionExpanded: false,
      cognitionDurationLabel: '约 2 秒',
      cognitionCountLabel: '1 条推理'
    });

    const assistantItem = items.find(item => item.key === 'assistant-1');
    const html = renderToStaticMarkup(<>{assistantItem?.content}</>);

    expect(html).toContain('chatx-inline-think');
    expect(html).not.toContain('chatx-governance-summary');
    expect(html).toContain('先判断问题类型，再选择执行路径');
    expect(html).not.toContain('已思考（用时约 2 秒）');
    expect(html).not.toContain('ThoughtChain timeline');
  });
});
