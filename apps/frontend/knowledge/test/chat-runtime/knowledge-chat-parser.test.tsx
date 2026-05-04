import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/types/api';
import { toKnowledgeBubbleItems } from '@/chat-runtime/knowledge-chat-parser';

describe('toKnowledgeBubbleItems', () => {
  it('maps assistant markdown metadata into Bubble.List items', () => {
    const assistantMessage: ChatMessage = {
      id: 'assistant-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: '## Answer',
      createdAt: '2026-05-04T00:00:00.000Z',
      citations: [
        { id: 'c1', documentId: 'doc-1', chunkId: 'chunk-1', title: 'Doc', quote: 'Excerpt', uri: '/doc', score: 0.91 }
      ],
      traceId: 'trace-1',
      route: {
        reason: 'mentions',
        requestedMentions: ['前端知识库'],
        selectedKnowledgeBaseIds: ['kb_frontend']
      }
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
      text: '## Answer',
      meta: {
        citations: [{ id: 'c1', title: 'Doc', quote: 'Excerpt', uri: '/doc', score: 0.91 }],
        traceId: 'trace-1',
        routeReason: 'mentions',
        feedback: 'like'
      }
    });
  });

  it('marks the active assistant item as loading while the matching stream is still in flight', () => {
    const assistantMessage: ChatMessage = {
      id: 'assistant-2',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Streaming answer',
      createdAt: '2026-05-04T00:00:00.000Z',
      traceId: 'trace-2'
    };

    const items = toKnowledgeBubbleItems({
      messages: [assistantMessage],
      feedbackByMessageId: {},
      streamState: {
        phase: 'answer',
        answerText: 'Streaming answer',
        citations: [],
        events: [],
        runId: 'trace-2'
      },
      isRequesting: true
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'assistant-2',
      role: 'assistant',
      loading: true
    });
  });

  it('does not infer loading from the message id pattern when traceId does not match the active stream', () => {
    const assistantMessage: ChatMessage = {
      id: 'stream_assistant_trace-3',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Completed answer',
      createdAt: '2026-05-04T00:00:00.000Z',
      traceId: 'trace-old'
    };

    const items = toKnowledgeBubbleItems({
      messages: [assistantMessage],
      feedbackByMessageId: {},
      streamState: {
        phase: 'answer',
        answerText: 'New answer',
        citations: [],
        events: [],
        runId: 'trace-3'
      },
      isRequesting: true
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'stream_assistant_trace-3',
      role: 'assistant',
      loading: false
    });
  });
});
