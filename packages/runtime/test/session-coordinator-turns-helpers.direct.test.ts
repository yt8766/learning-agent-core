import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/session/coordinator/session-coordinator-routing-hints', () => ({
  deriveRequestedHints: vi.fn().mockReturnValue(null),
  deriveSessionTitle: vi.fn(),
  generateSessionTitleFromSummary: vi.fn(),
  shouldDeriveSessionTitle: vi.fn(),
  shouldGenerateSessionTitle: vi.fn()
}));

import { buildTaskContextHints } from '../src/session/coordinator/session-coordinator-turns';

function makeStore(overrides: Record<string, unknown> = {}): any {
  return {
    requireSession: vi.fn().mockReturnValue({
      id: 'session-1',
      compression: undefined,
      title: 'Test Session'
    }),
    getCheckpoint: vi.fn().mockReturnValue(null),
    getMessages: vi.fn().mockReturnValue([]),
    listSessions: vi.fn().mockReturnValue([]),
    ...overrides
  };
}

describe('buildTaskContextHints (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty hints for simple session', () => {
    const store = makeStore();
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result).toBeDefined();
    expect(result.requestedHints).toBeUndefined();
  });

  it('returns recent turns from messages', () => {
    const store = makeStore({
      getMessages: vi.fn().mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' }
      ])
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.recentTurns).toBeDefined();
    expect(result.recentTurns!.length).toBe(3);
  });

  it('filters system messages from recent turns', () => {
    const store = makeStore({
      getMessages: vi.fn().mockReturnValue([
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ])
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.recentTurns!.every(t => t.role !== 'system')).toBe(true);
  });

  it('returns capabilityAttachments from checkpoint', () => {
    const store = makeStore({
      getCheckpoint: vi.fn().mockReturnValue({
        capabilityAttachments: [
          { id: 'cap-1', kind: 'skill', owner: { ownerType: 'user-attached' }, enabled: true, displayName: 'Test' }
        ]
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.capabilityAttachments).toBeDefined();
    expect(result.capabilityAttachments!.length).toBe(1);
  });

  it('returns capabilityAugmentations from checkpoint', () => {
    const store = makeStore({
      getCheckpoint: vi.fn().mockReturnValue({
        capabilityAugmentations: [{ id: 'aug-1', owner: { ownerType: 'user-attached' } }]
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.capabilityAugmentations).toBeDefined();
  });

  it('returns conversationSummary from session compression', () => {
    const store = makeStore({
      requireSession: vi.fn().mockReturnValue({
        id: 'session-1',
        compression: { summary: 'Previous conversation summary' },
        title: 'Test'
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.conversationSummary).toBe('Previous conversation summary');
  });

  it('returns conversationCompression from session', () => {
    const store = makeStore({
      requireSession: vi.fn().mockReturnValue({
        id: 'session-1',
        compression: {
          summary: 'Summary',
          focuses: ['focus1'],
          keyDeliverables: ['deliverable1'],
          risks: ['risk1'],
          nextActions: ['action1'],
          supportingFacts: ['fact1'],
          confirmedPreferences: ['pref1'],
          openLoops: ['loop1'],
          previewMessages: [{ role: 'user', content: 'preview' }]
        },
        title: 'Test'
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.conversationCompression).toBeDefined();
    expect(result.conversationCompression!.focuses).toEqual(['focus1']);
  });

  it('returns relatedHistory from checkpoint context', () => {
    const store = makeStore({
      getCheckpoint: vi.fn().mockReturnValue({
        context: 'structured context data',
        learningEvaluation: { notes: ['note1'] }
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.relatedHistory).toBeDefined();
    expect(result.relatedHistory!.length).toBeGreaterThan(0);
  });

  it('includes cross-session carryover in relatedHistory', () => {
    const store = makeStore({
      listSessions: vi
        .fn()
        .mockReturnValue([{ id: 'other-session', title: 'Other', compression: { summary: 'Previous summary' } }])
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.relatedHistory).toBeDefined();
  });

  it('includes carryover from messages when no compression', () => {
    const store = makeStore({
      listSessions: vi.fn().mockReturnValue([{ id: 'other-session', title: 'Other', compression: undefined }]),
      getMessages: vi.fn().mockImplementation((id: string) => {
        if (id === 'other-session') {
          return [{ role: 'user', content: 'Previous message' }];
        }
        return [];
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.relatedHistory).toBeDefined();
  });

  it('uses modelId from options', () => {
    const store = makeStore();
    const result = buildTaskContextHints(store as any, 'session-1', { modelId: 'glm-5' });
    expect(result.requestedHints?.preferredModelId).toBe('glm-5');
  });

  it('handles checkpoint with empty capabilityAttachments', () => {
    const store = makeStore({
      getCheckpoint: vi.fn().mockReturnValue({
        capabilityAttachments: []
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.capabilityAttachments).toBeUndefined();
  });

  it('handles checkpoint with empty capabilityAugmentations', () => {
    const store = makeStore({
      getCheckpoint: vi.fn().mockReturnValue({
        capabilityAugmentations: []
      })
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.capabilityAugmentations).toBeUndefined();
  });

  it('filters empty content from recent turns', () => {
    const store = makeStore({
      getMessages: vi.fn().mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' },
        { role: 'user', content: '   ' }
      ])
    });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.recentTurns!.length).toBe(1);
  });

  it('limits recent turns to last 6', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }));
    const store = makeStore({ getMessages: vi.fn().mockReturnValue(messages) });
    const result = buildTaskContextHints(store as any, 'session-1');
    expect(result.recentTurns!.length).toBe(6);
  });
});
