import { describe, expect, it, vi } from 'vitest';

import { buildCachedBubbleItems } from '@/pages/chat/chat-bubble-items-cache';
import type { BuildBubbleItemsOptions } from '@/pages/chat/chat-message-adapter';
import type { ChatMessageRecord } from '@/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content }: { content: string }) => <div>{content}</div>
}));

const onCopy = () => undefined;
const getAgentLabel = (role?: string) => role ?? 'agent';

function createOptions(messages: ChatMessageRecord[]): BuildBubbleItemsOptions {
  return {
    messages,
    activeStatus: 'running',
    onCopy,
    getAgentLabel
  };
}

describe('chat bubble items cache', () => {
  it('reuses unchanged history bubble items while rebuilding the streaming assistant item', () => {
    const userMessage: ChatMessageRecord = {
      id: 'user-1',
      sessionId: 'session-1',
      role: 'user',
      content: '解释一下流式渲染为什么卡',
      createdAt: '2026-05-04T09:20:00.000Z'
    };
    const firstAssistantMessage: ChatMessageRecord = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '第一段',
      createdAt: '2026-05-04T09:20:01.000Z'
    };
    const nextAssistantMessage: ChatMessageRecord = {
      ...firstAssistantMessage,
      content: '第一段，第二段'
    };

    const first = buildCachedBubbleItems(createOptions([userMessage, firstAssistantMessage]), undefined);
    const second = buildCachedBubbleItems(createOptions([userMessage, nextAssistantMessage]), first.cache);

    expect(second.items).toHaveLength(2);
    expect(second.items[0]).toBe(first.items[0]);
    expect(second.items[1]).not.toBe(first.items[1]);
  });
});
