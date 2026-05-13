import { describe, expect, it, vi } from 'vitest';

import { buildTaskContextHints } from '../src/session/coordinator/session-coordinator-turns';

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    requireSession: vi.fn().mockReturnValue({
      id: 's1',
      compression: undefined,
      ...overrides
    }),
    getCheckpoint: vi.fn().mockReturnValue(undefined),
    getMessages: vi.fn().mockReturnValue([]),
    listSessions: vi.fn().mockReturnValue([]),
    ...overrides.storeOverrides
  } as any;
}

describe('session-coordinator-turns (direct)', () => {
  describe('buildTaskContextHints', () => {
    it('returns empty hints for session with no messages', () => {
      const store = makeStore();
      const hints = buildTaskContextHints(store, 's1');
      expect(hints).toBeDefined();
      expect(hints.requestedMode).toBeUndefined();
      expect(hints.requestedHints).toBeUndefined();
    });

    it('returns recentTurns from messages', () => {
      const store = makeStore({
        storeOverrides: {
          getMessages: vi.fn().mockReturnValue([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
            { role: 'user', content: 'How are you' }
          ])
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.recentTurns).toBeDefined();
      expect(hints.recentTurns!.length).toBeGreaterThan(0);
    });

    it('filters system messages from recentTurns', () => {
      const store = makeStore({
        storeOverrides: {
          getMessages: vi.fn().mockReturnValue([
            { role: 'system', content: 'System message' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' }
          ])
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.recentTurns).toBeDefined();
      expect(hints.recentTurns!.every(t => t.role !== 'system')).toBe(true);
    });

    it('includes conversationSummary from session compression', () => {
      const store = makeStore({
        compression: { summary: 'Previous conversation summary' }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.conversationSummary).toBe('Previous conversation summary');
    });

    it('includes conversationCompression from session', () => {
      const compression = { summary: 'sum', condensedMessageCount: 5 };
      const store = makeStore({ compression });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.conversationCompression).toBeDefined();
      expect(hints.conversationCompression!.summary).toBe('sum');
    });

    it('detects routing hints from last user message', () => {
      const store = makeStore({
        storeOverrides: {
          getMessages: vi.fn().mockReturnValue([{ role: 'user', content: 'skill:my-test-skill' }])
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.requestedHints?.requestedSkill).toBe('my-test-skill');
    });

    it('includes capabilityAttachments from checkpoint', () => {
      const attachments = [{ id: 'a1', kind: 'skill', displayName: 'test', owner: { ownerType: 'user-attached' } }];
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({ capabilityAttachments: attachments })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.capabilityAttachments).toBeDefined();
      expect(hints.capabilityAttachments).toHaveLength(1);
    });

    it('includes capabilityAugmentations from checkpoint', () => {
      const augmentations = [{ id: 'aug-1', kind: 'connector' }];
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({ capabilityAugmentations: augmentations })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.capabilityAugmentations).toBeDefined();
    });

    it('returns undefined capabilityAttachments when checkpoint has none', () => {
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({ capabilityAttachments: [] })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.capabilityAttachments).toBeUndefined();
    });

    it('passes modelId to preferredModelId', () => {
      const store = makeStore();
      const hints = buildTaskContextHints(store, 's1', { modelId: 'gpt-4' });
      expect(hints.requestedHints?.preferredModelId).toBe('gpt-4');
    });

    it('infers github connector from session attached skill', () => {
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({
            capabilityAttachments: [
              {
                id: 'skill:github-helper',
                kind: 'skill',
                displayName: 'GitHub Helper',
                enabled: true,
                owner: { ownerType: 'user-attached' }
              }
            ]
          })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.requestedHints?.requestedConnectorTemplate).toBe('github-mcp-template');
    });

    it('infers lark connector from session attached connector', () => {
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({
            capabilityAttachments: [
              {
                id: 'connector:lark-mcp',
                kind: 'connector',
                displayName: 'Lark MCP',
                owner: { ownerType: 'user-attached' }
              }
            ]
          })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.requestedHints?.requestedConnectorTemplate).toBe('lark-mcp-template');
    });

    it('returns relatedHistory from cross-session carryover', () => {
      const store = makeStore({
        storeOverrides: {
          listSessions: vi
            .fn()
            .mockReturnValue([{ id: 's2', title: 'Previous Session', compression: { summary: 'old summary' } }]),
          getMessages: vi.fn().mockReturnValue([])
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.relatedHistory).toBeDefined();
      expect(hints.relatedHistory!.some(h => h.includes('Previous Session'))).toBe(true);
    });

    it('includes learningEvaluation notes in relatedHistory', () => {
      const store = makeStore({
        storeOverrides: {
          getCheckpoint: vi.fn().mockReturnValue({
            learningEvaluation: { notes: ['learned something important'] }
          })
        }
      });
      const hints = buildTaskContextHints(store, 's1');
      expect(hints.relatedHistory).toBeDefined();
      expect(hints.relatedHistory!.some(h => h.includes('learned something important'))).toBe(true);
    });
  });
});
