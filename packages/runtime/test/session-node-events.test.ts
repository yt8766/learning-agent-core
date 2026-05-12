import { describe, expect, it, vi } from 'vitest';

import { emitNodeStatusEvent } from '../src/session/session-node-events';

describe('session-node-events', () => {
  describe('emitNodeStatusEvent', () => {
    it('returns undefined when nodeId is empty', () => {
      const store = { addEvent: vi.fn() };
      const checkpoint = {} as any;
      const task = { id: 'task-1' } as any;
      const result = emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: '',
        phase: 'start'
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when nodeId is whitespace', () => {
      const store = { addEvent: vi.fn() };
      const checkpoint = {} as any;
      const task = { id: 'task-1' } as any;
      const result = emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: '   ',
        phase: 'start'
      });
      expect(result).toBeUndefined();
    });

    it('emits node_status event for start phase', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1', currentMinistry: 'hubu-search' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'research',
        phase: 'start',
        detail: 'starting research'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          taskId: 'task-1',
          nodeId: 'research',
          nodeLabel: '户部调研',
          phase: 'start',
          detail: 'starting research'
        })
      );
    });

    it('emits node_progress event for progress phase', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'execute',
        phase: 'progress',
        detail: '50% done'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_progress',
        expect.objectContaining({
          phase: 'progress'
        })
      );
    });

    it('sets streamStatus on checkpoint', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1', currentMinistry: 'gongbu-code' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'execute',
        phase: 'start',
        detail: 'executing',
        progressPercent: 50
      });
      expect(checkpoint.streamStatus).toBeDefined();
      expect(checkpoint.streamStatus.nodeId).toBe('execute');
      expect(checkpoint.streamStatus.nodeLabel).toBe('工部执行');
      expect(checkpoint.streamStatus.progressPercent).toBe(50);
      expect(checkpoint.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('resolves node label from NODE_LABELS map', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
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

    it('uses ministry display name when nodeId not in NODE_LABELS', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1', currentMinistry: 'xingbu-review' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'custom_node',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          nodeLabel: '刑部处理中'
        })
      );
    });

    it('falls back to nodeId with underscores replaced when no ministry', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1' } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'my_custom_node',
        phase: 'end'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          nodeLabel: 'my custom node'
        })
      );
    });

    it('includes worker and specialist in payload', () => {
      const store = { addEvent: vi.fn().mockReturnValue({ at: '2026-01-01T00:00:00.000Z' }) };
      const checkpoint = {} as any;
      const task = { id: 'task-1', currentWorker: 'worker-1', specialistLead: { displayName: 'Expert' } } as any;
      emitNodeStatusEvent(store as any, 'session-1', {
        task,
        checkpoint,
        nodeId: 'execute',
        phase: 'start'
      });
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'node_status',
        expect.objectContaining({
          worker: 'worker-1',
          specialist: 'Expert'
        })
      );
    });
  });
});
