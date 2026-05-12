import { describe, expect, it, vi } from 'vitest';

import { SessionCoordinatorStore } from '../src/session/coordinator/session-coordinator-store';

function makeStore() {
  const mockRepo = {
    load: vi.fn().mockResolvedValue({
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    }),
    save: vi.fn().mockResolvedValue(undefined)
  };
  return new SessionCoordinatorStore(mockRepo as any);
}

describe('session-coordinator-store (direct)', () => {
  describe('listSessions', () => {
    it('returns empty array when no sessions', () => {
      const store = makeStore();
      expect(store.listSessions()).toEqual([]);
    });

    it('returns sessions sorted by updatedAt descending', () => {
      const store = makeStore();
      store.sessions.set('s1', { id: 's1', updatedAt: '2026-01-01T00:00:00Z' } as any);
      store.sessions.set('s2', { id: 's2', updatedAt: '2026-01-02T00:00:00Z' } as any);
      const list = store.listSessions();
      expect(list[0].id).toBe('s2');
      expect(list[1].id).toBe('s1');
    });
  });

  describe('getSession', () => {
    it('returns undefined for unknown session', () => {
      const store = makeStore();
      expect(store.getSession('unknown')).toBeUndefined();
    });

    it('returns session when found', () => {
      const store = makeStore();
      store.sessions.set('s1', { id: 's1' } as any);
      expect(store.getSession('s1')!.id).toBe('s1');
    });
  });

  describe('getMessages', () => {
    it('returns empty array for unknown session', () => {
      const store = makeStore();
      expect(store.getMessages('unknown')).toEqual([]);
    });

    it('returns messages for session', () => {
      const store = makeStore();
      store.messages.set('s1', [{ id: 'm1' }] as any);
      expect(store.getMessages('s1')).toHaveLength(1);
    });
  });

  describe('getEvents', () => {
    it('returns empty array for unknown session', () => {
      const store = makeStore();
      expect(store.getEvents('unknown')).toEqual([]);
    });

    it('returns events for session', () => {
      const store = makeStore();
      store.events.set('s1', [{ id: 'e1' }] as any);
      expect(store.getEvents('s1')).toHaveLength(1);
    });
  });

  describe('getCheckpoint', () => {
    it('returns undefined for unknown session', () => {
      const store = makeStore();
      expect(store.getCheckpoint('unknown')).toBeUndefined();
    });

    it('returns checkpoint for session', () => {
      const store = makeStore();
      store.checkpoints.set('s1', { checkpointId: 'cp-1' } as any);
      expect(store.getCheckpoint('s1')!.checkpointId).toBe('cp-1');
    });
  });

  describe('subscribe', () => {
    it('returns unsubscribe function', () => {
      const store = makeStore();
      const unsub = store.subscribe('s1', () => {});
      expect(typeof unsub).toBe('function');
    });

    it('listener receives events', () => {
      const store = makeStore();
      const received: any[] = [];
      store.subscribe('s1', event => received.push(event));
      store.addEvent('s1', 'node_status', { test: true });
      expect(received).toHaveLength(1);
    });

    it('unsubscribe removes listener', () => {
      const store = makeStore();
      const received: any[] = [];
      const unsub = store.subscribe('s1', event => received.push(event));
      unsub();
      store.addEvent('s1', 'node_status', { test: true });
      expect(received).toHaveLength(0);
    });

    it('cleans up empty subscriber set', () => {
      const store = makeStore();
      const unsub = store.subscribe('s1', () => {});
      unsub();
      expect(store.subscribers.has('s1')).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('creates message with role and content', () => {
      const store = makeStore();
      const msg = store.addMessage('s1', 'user', 'Hello');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
      expect(msg.sessionId).toBe('s1');
      expect(msg.id).toBeDefined();
    });

    it('appends to existing messages', () => {
      const store = makeStore();
      store.addMessage('s1', 'user', 'First');
      store.addMessage('s1', 'assistant', 'Second');
      expect(store.getMessages('s1')).toHaveLength(2);
    });

    it('includes linkedAgent and card', () => {
      const store = makeStore();
      const msg = store.addMessage('s1', 'assistant', 'Reply', { agentId: 'agent-1' } as any, { type: 'card' } as any);
      expect(msg.linkedAgent).toEqual({ agentId: 'agent-1' });
      expect(msg.card).toEqual({ type: 'card' });
    });

    it('includes taskId', () => {
      const store = makeStore();
      const msg = store.addMessage('s1', 'user', 'Hello', undefined, undefined, 'task-1');
      expect(msg.taskId).toBe('task-1');
    });
  });

  describe('mergeAssistantCognitionSnapshot', () => {
    it('returns undefined for unknown message', () => {
      const store = makeStore();
      expect(store.mergeAssistantCognitionSnapshot('s1', 'unknown', {} as any)).toBeUndefined();
    });

    it('returns undefined for non-assistant message', () => {
      const store = makeStore();
      const msg = store.addMessage('s1', 'user', 'Hello');
      expect(store.mergeAssistantCognitionSnapshot('s1', msg.id, {} as any)).toBeUndefined();
    });

    it('merges snapshot into assistant message', () => {
      const store = makeStore();
      const msg = store.addMessage('s1', 'assistant', 'Reply');
      const snapshot = { thinkState: {} } as any;
      const result = store.mergeAssistantCognitionSnapshot('s1', msg.id, snapshot);
      expect(result).toBeDefined();
      expect(result!.cognitionSnapshot).toBe(snapshot);
    });
  });

  describe('appendStreamingMessage', () => {
    it('creates new message when id not found', () => {
      const store = makeStore();
      const msg = store.appendStreamingMessage('s1', 'stream-1', 'Hello', undefined, '2026-01-01T00:00:00Z');
      expect(msg.content).toBe('Hello');
      expect(msg.role).toBe('assistant');
    });

    it('appends token to existing message', () => {
      const store = makeStore();
      store.appendStreamingMessage('s1', 'stream-1', 'Hello', undefined, '2026-01-01T00:00:00Z');
      const msg = store.appendStreamingMessage('s1', 'stream-1', ' World', undefined, '2026-01-01T00:00:00Z');
      expect(msg.content).toBe('Hello World');
    });
  });

  describe('addEvent', () => {
    it('creates event with type and payload', () => {
      const store = makeStore();
      const event = store.addEvent('s1', 'node_status', { nodeId: 'test' });
      expect(event.type).toBe('node_status');
      expect(event.sessionId).toBe('s1');
      expect(event.payload).toEqual({ nodeId: 'test' });
    });

    it('appends to existing events', () => {
      const store = makeStore();
      store.addEvent('s1', 'node_status', {});
      store.addEvent('s1', 'node_progress', {});
      expect(store.getEvents('s1')).toHaveLength(2);
    });

    it('notifies subscribers', () => {
      const store = makeStore();
      const received: any[] = [];
      store.subscribe('s1', event => received.push(event));
      store.addEvent('s1', 'node_status', {});
      expect(received).toHaveLength(1);
    });
  });

  describe('createCheckpoint', () => {
    it('creates checkpoint with task id', () => {
      const store = makeStore();
      const cp = store.createCheckpoint('s1', 'task-1');
      expect(cp.sessionId).toBe('s1');
      expect(cp.taskId).toBe('task-1');
      expect(cp.checkpointId).toBeDefined();
    });

    it('stores checkpoint in map', () => {
      const store = makeStore();
      store.createCheckpoint('s1', 'task-1');
      expect(store.getCheckpoint('s1')).toBeDefined();
    });

    it('initializes arrays', () => {
      const store = makeStore();
      const cp = store.createCheckpoint('s1', 'task-1');
      expect(cp.pendingApprovals).toEqual([]);
      expect(cp.executionSteps).toEqual([]);
      expect(cp.agentStates).toEqual([]);
      expect(cp.externalSources).toEqual([]);
    });
  });

  describe('requireSession', () => {
    it('throws for unknown session', () => {
      const store = makeStore();
      expect(() => store.requireSession('unknown')).toThrow('not found');
    });

    it('returns session when found', () => {
      const store = makeStore();
      store.sessions.set('s1', { id: 's1' } as any);
      expect(store.requireSession('s1').id).toBe('s1');
    });
  });

  describe('requireTaskId', () => {
    it('throws when no currentTaskId', () => {
      const store = makeStore();
      expect(() => store.requireTaskId({ id: 's1' } as any)).toThrow('no active task');
    });

    it('returns currentTaskId when present', () => {
      const store = makeStore();
      expect(store.requireTaskId({ id: 's1', currentTaskId: 'task-1' } as any)).toBe('task-1');
    });
  });

  describe('hydrate', () => {
    it('loads data from repository', async () => {
      const mockRepo = {
        load: vi.fn().mockResolvedValue({
          chatSessions: [],
          chatMessages: [],
          chatEvents: [],
          chatCheckpoints: []
        }),
        save: vi.fn()
      };
      const store = new SessionCoordinatorStore(mockRepo as any);
      await store.hydrate();
      expect(mockRepo.load).toHaveBeenCalled();
      // Since safeParse filters invalid records, and our test data may not match the Zod schemas,
      // just verify the method ran and cleared/maps were reset
      expect(store.listSessions()).toEqual([]);
    });

    it('handles empty snapshot', async () => {
      const store = makeStore();
      await store.hydrate();
      expect(store.listSessions()).toEqual([]);
    });
  });

  describe('persistRuntimeState', () => {
    it('saves current state to repository', async () => {
      const mockRepo = {
        load: vi.fn().mockResolvedValue({}),
        save: vi.fn().mockResolvedValue(undefined)
      };
      const store = new SessionCoordinatorStore(mockRepo as any);
      store.sessions.set('s1', { id: 's1' } as any);
      await store.persistRuntimeState();
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });
});
