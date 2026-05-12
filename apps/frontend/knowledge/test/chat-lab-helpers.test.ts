import { describe, expect, it } from 'vitest';

import {
  createChatLabConversation,
  deriveConversationTitle,
  parseKnowledgeMentions,
  removeCurrentKnowledgeMentionToken,
  replaceCurrentKnowledgeMentionToken,
  resolveChatLabKnowledgeBaseId,
  stripKnowledgeMentions,
  uniqueKnowledgeMentions
} from '../src/pages/chat-lab/chat-lab-helpers';

const knowledgeBases = [
  { id: 'kb-1', name: 'Frontend' },
  { id: 'kb-2', name: 'Backend' },
  { id: 'kb-3', name: 'DevOps' }
];

describe('chat-lab-helpers', () => {
  describe('parseKnowledgeMentions', () => {
    it('finds mentions in message', () => {
      const result = parseKnowledgeMentions('Tell me about @Frontend and @Backend', knowledgeBases);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'knowledge_base', id: 'kb-1', label: 'Frontend' });
      expect(result[1]).toEqual({ type: 'knowledge_base', id: 'kb-2', label: 'Backend' });
    });

    it('returns empty when no mentions', () => {
      expect(parseKnowledgeMentions('No mentions here', knowledgeBases)).toEqual([]);
    });

    it('does not match partial names', () => {
      const result = parseKnowledgeMentions('@Front', knowledgeBases);
      expect(result).toEqual([]);
    });
  });

  describe('stripKnowledgeMentions', () => {
    it('removes mentions from message', () => {
      expect(stripKnowledgeMentions('Tell me about @Frontend code', knowledgeBases)).toBe('Tell me about code');
    });

    it('removes multiple mentions', () => {
      expect(stripKnowledgeMentions('@Frontend and @Backend', knowledgeBases)).toBe('and');
    });

    it('collapses whitespace', () => {
      expect(stripKnowledgeMentions('  @Frontend   code  ', knowledgeBases)).toBe('code');
    });
  });

  describe('replaceCurrentKnowledgeMentionToken', () => {
    it('replaces partial mention at end', () => {
      expect(replaceCurrentKnowledgeMentionToken('Tell me about @Fro', 'Frontend')).toBe('Tell me about @Frontend ');
    });

    it('appends mention when no partial token', () => {
      expect(replaceCurrentKnowledgeMentionToken('Tell me', 'Frontend')).toBe('Tell me @Frontend ');
    });

    it('appends mention when message is empty', () => {
      expect(replaceCurrentKnowledgeMentionToken('', 'Frontend')).toBe('@Frontend ');
    });
  });

  describe('removeCurrentKnowledgeMentionToken', () => {
    it('removes partial mention token at end', () => {
      expect(removeCurrentKnowledgeMentionToken('Tell me about @Fro')).toBe('Tell me about');
    });

    it('returns message as-is when no mention token', () => {
      expect(removeCurrentKnowledgeMentionToken('Tell me')).toBe('Tell me');
    });
  });

  describe('uniqueKnowledgeMentions', () => {
    it('deduplicates by ID', () => {
      const result = uniqueKnowledgeMentions([
        { type: 'knowledge_base', id: 'kb-1', label: 'Frontend' },
        { type: 'knowledge_base', id: 'kb-1', label: 'Frontend Dup' },
        { type: 'knowledge_base', id: 'kb-2', label: 'Backend' }
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Frontend Dup');
    });

    it('falls back to label as key when no ID', () => {
      const result = uniqueKnowledgeMentions([
        { type: 'knowledge_base', label: 'KB A' },
        { type: 'knowledge_base', label: 'KB A' },
        { type: 'knowledge_base', label: 'KB B' }
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe('createChatLabConversation', () => {
    it('creates conversation with default title', () => {
      const conv = createChatLabConversation();

      expect(conv.title).toBe('新会话');
      expect(conv.messages).toEqual([]);
      expect(conv.id).toBeTruthy();
      expect(conv.createdAt).toBeTruthy();
      expect(conv.updatedAt).toBeTruthy();
    });

    it('creates conversation with seed message as title', () => {
      const conv = createChatLabConversation('How to use RAG?');

      expect(conv.title).toBe('How to use RAG?');
    });
  });

  describe('deriveConversationTitle', () => {
    it('returns default for empty message', () => {
      expect(deriveConversationTitle()).toBe('新会话');
      expect(deriveConversationTitle('')).toBe('新会话');
      expect(deriveConversationTitle('   ')).toBe('新会话');
    });

    it('truncates long messages', () => {
      const long = 'This is a very long message that should be truncated';
      const result = deriveConversationTitle(long);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(21);
    });

    it('keeps short messages', () => {
      expect(deriveConversationTitle('Short')).toBe('Short');
    });

    it('normalizes whitespace', () => {
      expect(deriveConversationTitle('  Multiple   spaces  ')).toBe('Multiple spaces');
    });
  });

  describe('resolveChatLabKnowledgeBaseId', () => {
    it('returns first knowledge base ID', () => {
      expect(resolveChatLabKnowledgeBaseId(knowledgeBases)).toBe('kb-1');
    });

    it('returns undefined when empty', () => {
      expect(resolveChatLabKnowledgeBaseId([])).toBeUndefined();
    });
  });
});
