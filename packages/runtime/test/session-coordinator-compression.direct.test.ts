import { describe, expect, it, vi } from 'vitest';

import { compressConversationIfNeeded } from '../src/session/coordinator/session-coordinator-compression';

function makeLlm(isConfigured = false) {
  return {
    isConfigured: vi.fn().mockReturnValue(isConfigured),
    generate: vi.fn()
  } as any;
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    channelIdentity: {},
    compression: undefined,
    ...overrides
  } as any;
}

function makeMessages(count: number, charCount = 100) {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(charCount),
    createdAt: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`
  })) as any;
}

describe('session-coordinator-compression (direct)', () => {
  describe('compressConversationIfNeeded', () => {
    it('returns false when compression is disabled', async () => {
      const result = await compressConversationIfNeeded(
        makeLlm(),
        { compressionEnabled: false } as any,
        makeSession(),
        makeMessages(20),
        () => {}
      );
      expect(result).toBe(false);
    });

    it('returns false when not enough messages', async () => {
      const result = await compressConversationIfNeeded(makeLlm(), {}, makeSession(), makeMessages(5), () => {});
      expect(result).toBe(false);
    });

    it('returns false when nextCondensedCount <= condensedCount', async () => {
      const session = makeSession({
        compression: { condensedMessageCount: 20 }
      });
      const result = await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(10), () => {});
      expect(result).toBe(false);
    });

    it('compresses when message count exceeds threshold', async () => {
      const session = makeSession();
      const onCompacted = vi.fn();
      const result = await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(20), onCompacted);
      expect(result).toBe(true);
      expect(session.compression).toBeDefined();
      expect(onCompacted).toHaveBeenCalled();
    });

    it('compresses when character count exceeds threshold', async () => {
      const session = makeSession();
      const onCompacted = vi.fn();
      // Need enough messages so nextCondensedCount > condensedCount (0)
      // and totalCharacterCount >= 3600
      const result = await compressConversationIfNeeded(
        makeLlm(),
        { compressionMessageThreshold: 100 },
        session,
        makeMessages(10, 500),
        onCompacted
      );
      expect(result).toBe(true);
    });

    it('stores compression metadata on session', async () => {
      const session = makeSession();
      await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(20), () => {});
      expect(session.compression).toBeDefined();
      expect(session.compression.summary).toBeDefined();
      expect(session.compression.source).toBeDefined();
      expect(session.compression.condensedMessageCount).toBeDefined();
      expect(session.compression.trigger).toBeDefined();
    });

    it('sets updatedAt on session after compression', async () => {
      const session = makeSession();
      const before = session.updatedAt;
      await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(20), () => {});
      expect(session.updatedAt).toBeDefined();
    });

    it('uses heuristic source when llm not configured', async () => {
      const session = makeSession();
      await compressConversationIfNeeded(makeLlm(false), {}, session, makeMessages(20), () => {});
      expect(session.compression.source).toBe('heuristic');
    });

    it('respects compressionKeepRecentMessages', async () => {
      const session = makeSession();
      await compressConversationIfNeeded(
        makeLlm(),
        { compressionKeepRecentMessages: 3 },
        session,
        makeMessages(20),
        () => {}
      );
      expect(session.compression).toBeDefined();
    });

    it('passes onCompacted payload with expected fields', async () => {
      const session = makeSession();
      const payload: any[] = [];
      await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(20), p => payload.push(p));
      expect(payload).toHaveLength(1);
      expect(payload[0]).toHaveProperty('summary');
      expect(payload[0]).toHaveProperty('condensedMessageCount');
      expect(payload[0]).toHaveProperty('trigger');
      expect(payload[0]).toHaveProperty('source');
    });

    it('derives long-flow profile for review-related input', async () => {
      const session = makeSession();
      await compressConversationIfNeeded(makeLlm(), {}, session, makeMessages(20), () => {}, '请审查这段代码');
      expect(session.compression.compressionProfile).toBe('long-flow');
    });

    it('derives light-chat profile for quick input', async () => {
      const session = makeSession();
      await compressConversationIfNeeded(
        makeLlm(),
        { compressionMessageThreshold: 2 },
        session,
        makeMessages(20),
        () => {},
        '简单问答'
      );
      expect(session.compression).toBeDefined();
      expect(session.compression.compressionProfile).toBe('light-chat');
    });
  });
});
