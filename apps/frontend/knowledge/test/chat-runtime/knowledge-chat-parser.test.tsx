import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/types/api';
import { toKnowledgeBubbleItems } from '@/chat-runtime/knowledge-chat-parser';

describe('toKnowledgeBubbleItems', () => {
  it('maps assistant markdown, citations, trace and loading state into Bubble.List items', () => {
    const assistantMessage: ChatMessage = {
      id: 'assistant-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: '## Answer',
      createdAt: '2026-05-04T00:00:00.000Z',
      citations: [
        { id: 'c1', documentId: 'doc-1', chunkId: 'chunk-1', title: 'Doc', quote: 'Excerpt', uri: '/doc', score: 0.91 }
      ],
      traceId: 'trace-1'
    };

    const items = toKnowledgeBubbleItems({
      messages: [assistantMessage],
      feedbackByMessageId: { 'assistant-1': 'like' },
      streamState: {
        phase: 'answer',
        answerText: '## Answer',
        citations: assistantMessage.citations ?? [],
        events: [],
        runId: 'trace-1'
      },
      isRequesting: false
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'assistant-1',
      role: 'assistant',
      loading: false
    });
    expect(items[0]?.content).toMatchObject({
      kind: 'markdown',
      meta: {
        traceId: 'trace-1'
      }
    });
  });
});
