import { describe, expect, it } from 'vitest';

import { normalizeKnowledgeChatRequest } from '../../src/domains/knowledge/services/knowledge-chat-request.helpers';
import { KnowledgeServiceError } from '../../src/domains/knowledge/services/knowledge-service.error';

describe('normalizeKnowledgeChatRequest', () => {
  it('uses message field when provided', () => {
    const result = normalizeKnowledgeChatRequest({
      message: '  hello world  ',
      knowledgeBaseId: 'kb-1'
    });

    expect(result.message).toBe('hello world');
    expect(result.knowledgeBaseId).toBe('kb-1');
  });

  it('falls back to latest user message from messages array', () => {
    const result = normalizeKnowledgeChatRequest({
      messages: [
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: '  what is AI?  ' }
      ]
    });

    expect(result.message).toBe('what is AI?');
  });

  it('handles user message with content parts array', () => {
    const result = normalizeKnowledgeChatRequest({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'part one' },
            { type: 'text', text: 'part two' }
          ]
        }
      ]
    });

    expect(result.message).toBe('part one\npart two');
  });

  it('throws when no message can be resolved', () => {
    expect(() => normalizeKnowledgeChatRequest({})).toThrow(KnowledgeServiceError);
    expect(() => normalizeKnowledgeChatRequest({ messages: [] })).toThrow(KnowledgeServiceError);
    expect(() => normalizeKnowledgeChatRequest({ messages: [{ role: 'assistant', content: 'no user msg' }] })).toThrow(
      KnowledgeServiceError
    );
  });

  it('uses metadata fields when provided', () => {
    const result = normalizeKnowledgeChatRequest({
      message: 'test',
      conversationId: 'conv-1',
      knowledgeBaseId: 'kb-fallback',
      metadata: {
        conversationId: 'conv-meta',
        knowledgeBaseId: 'kb-meta',
        knowledgeBaseIds: ['kb-1', 'kb-2'],
        mentions: ['@agent']
      }
    });

    expect(result.conversationId).toBe('conv-meta');
    expect(result.knowledgeBaseId).toBe('kb-meta');
    expect(result.knowledgeBaseIds).toEqual(['kb-1', 'kb-2']);
    expect(result.mentions).toEqual(['@agent']);
  });

  it('normalizes knowledgeBaseIds from comma-separated string', () => {
    const result = normalizeKnowledgeChatRequest({
      message: 'test',
      knowledgeBaseIds: 'kb-1, kb-2, , kb-3'
    });

    expect(result.knowledgeBaseIds).toEqual(['kb-1', 'kb-2', 'kb-3']);
  });

  it('passes through array knowledgeBaseIds', () => {
    const result = normalizeKnowledgeChatRequest({
      message: 'test',
      knowledgeBaseIds: ['kb-1', 'kb-2']
    });

    expect(result.knowledgeBaseIds).toEqual(['kb-1', 'kb-2']);
  });
});
