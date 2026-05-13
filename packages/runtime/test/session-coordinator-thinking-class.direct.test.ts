import { describe, expect, it, vi } from 'vitest';

import { SessionCoordinatorThinking } from '../src/session/coordinator/session-coordinator-thinking';

function makeLlm() {
  return {
    isConfigured: vi.fn().mockReturnValue(false),
    generate: vi.fn()
  } as any;
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'running',
    trace: [{ node: 'decree_received', summary: 'received', at: '2026-01-01T00:00:00.000Z' }],
    currentMinistry: 'gongbu-code',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    ...overrides
  } as any;
}

describe('SessionCoordinatorThinking (direct)', () => {
  describe('buildThoughtChain', () => {
    it('builds chain from task traces', () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const chain = thinking.buildThoughtChain(makeTask());
      expect(chain.length).toBeGreaterThan(0);
    });

    it('includes messageId when provided', () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const chain = thinking.buildThoughtChain(makeTask(), 'msg-1');
      expect(chain[0].messageId).toBe('msg-1');
    });
  });

  describe('buildThinkState', () => {
    it('returns undefined for empty trace', () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      expect(thinking.buildThinkState(makeTask({ trace: [] }))).toBeUndefined();
    });

    it('returns think state for running task', () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const state = thinking.buildThinkState(makeTask());
      expect(state).toBeDefined();
      expect(state!.loading).toBe(true);
    });
  });

  describe('buildThoughtGraph', () => {
    it('builds graph with nodes and edges', () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const checkpoint = { checkpointId: 'cp-1', sessionId: 's1', taskId: 'task-1', traceCursor: 0 } as any;
      const graph = thinking.buildThoughtGraph(makeTask(), checkpoint);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges).toBeDefined();
    });
  });

  describe('buildConversationContext', () => {
    it('returns string context', async () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const session = { id: 's1', channelIdentity: {} } as any;
      const context = await thinking.buildConversationContext(session, undefined, [], 'test query');
      expect(typeof context).toBe('string');
    });
  });

  describe('compressConversationIfNeeded', () => {
    it('returns false when not enough messages', async () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), undefined, undefined);
      const session = {} as any;
      const result = await thinking.compressConversationIfNeeded(session, [], () => {});
      expect(result).toBe(false);
    });

    it('returns false when compression disabled', async () => {
      const thinking = new SessionCoordinatorThinking(makeLlm(), { compressionEnabled: false } as any, undefined);
      const session = {} as any;
      const result = await thinking.compressConversationIfNeeded(
        session,
        Array.from({ length: 20 }, () => ({ content: 'msg', role: 'user' })) as any,
        () => {}
      );
      expect(result).toBe(false);
    });
  });
});
