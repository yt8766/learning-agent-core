/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./knowledge-conversations', () => ({
  toKnowledgeConversationData: vi.fn((conv: any) => ({
    key: conv.id,
    label: conv.title
  }))
}));

import { createKnowledgeChatActions } from '@/chat-runtime/knowledge-chat-actions';

function createMockApi(overrides: Record<string, any> = {}) {
  return {
    listConversations: vi.fn().mockResolvedValue({
      items: [
        { id: 'conv-1', title: 'First conversation' },
        { id: 'conv-2', title: 'Second conversation' }
      ]
    }),
    listConversationMessages: vi.fn().mockResolvedValue({
      items: [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there' }
      ]
    }),
    createFeedback: vi.fn().mockResolvedValue({ success: true }),
    ...overrides
  };
}

describe('createKnowledgeChatActions', () => {
  describe('listConversations', () => {
    it('returns mapped conversations', async () => {
      const api = createMockApi();
      const actions = createKnowledgeChatActions({ api: api as any });

      const result = await actions.listConversations();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('conv-1');
      expect(result[0].label).toBe('First conversation');
      expect(api.listConversations).toHaveBeenCalled();
    });

    it('handles empty conversations', async () => {
      const api = createMockApi({
        listConversations: vi.fn().mockResolvedValue({ items: [] })
      });
      const actions = createKnowledgeChatActions({ api: api as any });

      const result = await actions.listConversations();

      expect(result).toHaveLength(0);
    });
  });

  describe('listMessages', () => {
    it('returns messages for a conversation', async () => {
      const api = createMockApi();
      const actions = createKnowledgeChatActions({ api: api as any });

      const result = await actions.listMessages('conv-1');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(api.listConversationMessages).toHaveBeenCalledWith('conv-1');
    });

    it('handles empty messages', async () => {
      const api = createMockApi({
        listConversationMessages: vi.fn().mockResolvedValue({ items: [] })
      });
      const actions = createKnowledgeChatActions({ api: api as any });

      const result = await actions.listMessages('conv-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('createFeedback', () => {
    it('creates feedback for a message', async () => {
      const api = createMockApi();
      const actions = createKnowledgeChatActions({ api: api as any });

      const result = await actions.createFeedback('msg-1', {
        category: 'helpful',
        rating: 'positive'
      });

      expect(api.createFeedback).toHaveBeenCalledWith('msg-1', {
        category: 'helpful',
        rating: 'positive'
      });
      expect(result).toEqual({ success: true });
    });

    it('creates negative feedback', async () => {
      const api = createMockApi();
      const actions = createKnowledgeChatActions({ api: api as any });

      await actions.createFeedback('msg-2', {
        category: 'not_helpful',
        rating: 'negative'
      });

      expect(api.createFeedback).toHaveBeenCalledWith('msg-2', {
        category: 'not_helpful',
        rating: 'negative'
      });
    });
  });
});
