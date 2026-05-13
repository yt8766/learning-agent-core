import { describe, expect, it, vi } from 'vitest';

import { emitNodeStatusEvent } from '../src/session/session-node-events';

function makeStore() {
  return {
    addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00Z' })
  } as any;
}

function makeCheckpoint() {
  return {} as any;
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    currentMinistry: 'gongbu-code',
    ...overrides
  } as any;
}

describe('session-node-events (direct)', () => {
  describe('emitNodeStatusEvent', () => {
    it('returns undefined when nodeId is empty', () => {
      const store = makeStore();
      const result = emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint: makeCheckpoint(),
        nodeId: '',
        phase: 'start'
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when nodeId is whitespace', () => {
      const store = makeStore();
      const result = emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint: makeCheckpoint(),
        nodeId: '   ',
        phase: 'start'
      });
      expect(result).toBeUndefined();
    });

    it('emits node_status event for start phase', () => {
      const store = makeStore();
      const checkpoint = makeCheckpoint();
      const result = emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint,
        nodeId: 'research',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          taskId: 'task-1',
          nodeId: 'research',
          nodeLabel: '户部调研',
          phase: 'start'
        })
      );
      expect(result).toBeDefined();
    });

    it('emits node_progress event for progress phase', () => {
      const store = makeStore();
      const checkpoint = makeCheckpoint();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint,
        nodeId: 'execute',
        phase: 'progress',
        progressPercent: 50
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_progress',
        expect.objectContaining({
          nodeId: 'execute',
          phase: 'progress',
          progressPercent: 50
        })
      );
    });

    it('resolves node label from NODE_LABELS map', () => {
      const store = makeStore();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint: makeCheckpoint(),
        nodeId: 'entry_router',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          nodeLabel: '通政司接旨'
        })
      );
    });

    it('uses getMinistryDisplayName for unknown nodeId', () => {
      const store = makeStore();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask({ currentMinistry: 'hubu-search' }),
        checkpoint: makeCheckpoint(),
        nodeId: 'custom_node',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          nodeLabel: '户部处理中'
        })
      );
    });

    it('falls back to replacing underscores for unknown nodeId without ministry', () => {
      const store = makeStore();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask({ currentMinistry: undefined }),
        checkpoint: makeCheckpoint(),
        nodeId: 'custom_node',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          nodeLabel: 'custom node'
        })
      );
    });

    it('sets checkpoint.streamStatus', () => {
      const store = makeStore();
      const checkpoint = makeCheckpoint();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint,
        nodeId: 'research',
        phase: 'start',
        detail: 'Researching...',
        progressPercent: 25
      });
      expect(checkpoint.streamStatus).toBeDefined();
      expect(checkpoint.streamStatus.nodeId).toBe('research');
      expect(checkpoint.streamStatus.detail).toBe('Researching...');
      expect(checkpoint.streamStatus.progressPercent).toBe(25);
    });

    it('updates checkpoint.updatedAt', () => {
      const store = makeStore();
      const checkpoint = makeCheckpoint();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask(),
        checkpoint,
        nodeId: 'research',
        phase: 'start'
      });
      expect(checkpoint.updatedAt).toBe('2026-01-01T00:00:00Z');
    });

    it('includes worker and specialist in payload', () => {
      const store = makeStore();
      emitNodeStatusEvent(store, 'session-1', {
        task: makeTask({ currentWorker: 'worker-1', specialistLead: { displayName: 'Lead Specialist' } }),
        checkpoint: makeCheckpoint(),
        nodeId: 'research',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          worker: 'worker-1',
          specialist: 'Lead Specialist'
        })
      );
    });
  });
});
