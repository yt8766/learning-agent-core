/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import {
  formatStreamPhase,
  loadKnowledgeConversationMessages,
  mergeChatMessages,
  summarizeStreamDiagnostics,
  toChatLabConversation,
  toError
} from '../src/pages/chat-lab/chat-lab-diagnostics';

describe('chat-lab-diagnostics', () => {
  describe('formatStreamPhase', () => {
    it('formats planner phase', () => {
      expect(formatStreamPhase('planner')).toBe('正在选库');
    });

    it('formats retrieval phase', () => {
      expect(formatStreamPhase('retrieval')).toBe('正在检索');
    });

    it('formats answer phase', () => {
      expect(formatStreamPhase('answer')).toBe('正在生成');
    });

    it('formats completed phase', () => {
      expect(formatStreamPhase('completed')).toBe('已完成');
    });

    it('formats error phase', () => {
      expect(formatStreamPhase('error')).toBe('生成失败');
    });

    it('formats idle phase', () => {
      expect(formatStreamPhase('idle')).toBe('准备中');
    });

    it('formats undefined phase', () => {
      expect(formatStreamPhase(undefined as any)).toBe('准备中');
    });
  });

  describe('toChatLabConversation', () => {
    it('maps ChatConversation to ChatLabConversation', () => {
      const result = toChatLabConversation({
        id: 'conv-1',
        title: 'Test Conversation',
        activeModelProfileId: 'model-1',
        createdAt: '2026-05-01',
        updatedAt: '2026-05-02'
      } as any);

      expect(result).toEqual({
        id: 'conv-1',
        title: 'Test Conversation',
        activeModelProfileId: 'model-1',
        persisted: true,
        messages: [],
        createdAt: '2026-05-01',
        updatedAt: '2026-05-02'
      });
    });
  });

  describe('loadKnowledgeConversationMessages', () => {
    it('loads messages from API', async () => {
      const messages = [{ id: 'msg-1', content: 'Hello' }];
      const api = {
        listConversationMessages: vi.fn().mockResolvedValue({ items: messages })
      };

      const result = await loadKnowledgeConversationMessages(api as any, 'conv-1');

      expect(api.listConversationMessages).toHaveBeenCalledWith('conv-1');
      expect(result).toEqual(messages);
    });
  });

  describe('mergeChatMessages', () => {
    it('merges backend and current messages sorted by createdAt', () => {
      const backend = [
        { id: 'msg-1', content: 'first', createdAt: '2026-05-01T00:00:00Z' },
        { id: 'msg-3', content: 'third', createdAt: '2026-05-03T00:00:00Z' }
      ];
      const current = [{ id: 'msg-2', content: 'second', createdAt: '2026-05-02T00:00:00Z' }];

      const result = mergeChatMessages(backend as any, current as any);

      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('backend messages override current messages with same ID', () => {
      const backend = [{ id: 'msg-1', content: 'updated', createdAt: '2026-05-01T00:00:00Z' }];
      const current = [{ id: 'msg-1', content: 'original', createdAt: '2026-05-01T00:00:00Z' }];

      const result = mergeChatMessages(backend as any, current as any);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('updated');
    });

    it('handles empty arrays', () => {
      expect(mergeChatMessages([], [])).toEqual([]);
    });
  });

  describe('summarizeStreamDiagnostics', () => {
    it('returns undefined when no plan and no retrieval diagnostics', () => {
      expect(summarizeStreamDiagnostics([])).toBeUndefined();
    });

    it('summarizes planner completed event', () => {
      const events = [
        {
          type: 'planner.completed' as const,
          plan: {
            confidence: 0.85,
            searchMode: 'hybrid',
            selectionReason: 'best match',
            diagnostics: { planner: 'fast' }
          }
        }
      ];

      const result = summarizeStreamDiagnostics(events as any);

      expect(result?.confidence).toBe('0.85');
      expect(result?.searchMode).toBe('hybrid');
      expect(result?.selectionReason).toBe('best match');
      expect(result?.planner).toBe('fast');
    });

    it('summarizes retrieval completed event with diagnostics', () => {
      const events = [
        {
          type: 'retrieval.completed' as const,
          retrieval: {
            hits: [{ id: 'h1' }, { id: 'h2' }],
            diagnostics: {
              effectiveSearchMode: 'semantic',
              finalHitCount: 2,
              executedQueries: [{ query: 'test query', mode: 'semantic', hitCount: 2 }]
            }
          }
        }
      ];

      const result = summarizeStreamDiagnostics(events as any);

      expect(result?.retrievalMode).toBe('semantic');
      expect(result?.finalHitCount).toBe(2);
      expect(result?.executedQuery).toBe('test query · semantic · 2');
    });

    it('uses last planner event when multiple exist', () => {
      const events = [
        {
          type: 'planner.completed' as const,
          plan: {
            confidence: 0.5,
            searchMode: 'keyword',
            selectionReason: 'first',
            diagnostics: {}
          }
        },
        {
          type: 'planner.completed' as const,
          plan: {
            confidence: 0.9,
            searchMode: 'hybrid',
            selectionReason: 'better',
            diagnostics: {}
          }
        }
      ];

      const result = summarizeStreamDiagnostics(events as any);

      expect(result?.confidence).toBe('0.90');
    });

    it('handles executed queries with string format', () => {
      const events = [
        {
          type: 'retrieval.completed' as const,
          retrieval: {
            hits: [],
            diagnostics: {
              executedQueries: ['simple query']
            }
          }
        }
      ];

      const result = summarizeStreamDiagnostics(events as any);

      expect(result?.executedQuery).toBe('simple query · query · 0');
    });

    it('handles retrieval with no diagnostics but with hits', () => {
      const events = [
        {
          type: 'retrieval.completed' as const,
          retrieval: {
            hits: [{ id: 'h1' }],
            diagnostics: {}
          }
        }
      ];

      const result = summarizeStreamDiagnostics(events as any);

      expect(result?.finalHitCount).toBe(1);
    });
  });

  describe('toError', () => {
    it('returns Error as-is', () => {
      const error = new Error('test');
      expect(toError(error)).toBe(error);
    });

    it('wraps non-Error in Error', () => {
      const result = toError('string error');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('string error');
    });

    it('wraps number in Error', () => {
      const result = toError(42);
      expect(result.message).toBe('42');
    });
  });
});
