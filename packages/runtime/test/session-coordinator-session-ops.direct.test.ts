import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskStatus } from '@agent/core';

vi.mock('../src/session/coordinator/session-coordinator-sync', () => ({
  syncCoordinatorTask: vi.fn()
}));

vi.mock('../src/session/coordinator/session-coordinator-learning', () => ({
  autoConfirmLearningIfNeeded: vi.fn(),
  runLearningConfirmation: vi.fn()
}));

import {
  recoverSession,
  recoverSessionToCheckpoint,
  cancelSessionRun,
  deleteSessionState,
  finishSessionCancellation,
  syncSessionTask
} from '../src/session/coordinator/session-coordinator-session-ops';

function makeStore(overrides: Record<string, unknown> = {}): any {
  const sessions = new Map([
    [
      'session-1',
      { id: 'session-1', status: 'idle', title: 'Test', currentTaskId: 'task-1', updatedAt: '2026-01-01T00:00:00Z' }
    ]
  ]);
  const checkpoints = new Map([
    [
      'session-1',
      {
        checkpointId: 'cp-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        graphState: { status: TaskStatus.COMPLETED, currentStep: 'delivery' },
        traceCursor: 10,
        messageCursor: 5,
        approvalCursor: 3,
        learningCursor: 2,
        recoverability: 'safe',
        updatedAt: '2026-01-01T00:00:00Z',
        pendingApproval: undefined,
        pendingApprovals: []
      }
    ]
  ]);
  return {
    sessions,
    messages: new Map(),
    events: new Map(),
    checkpoints,
    subscribers: new Map(),
    requireSession: vi.fn((id: string) => sessions.get(id)),
    requireTaskId: vi.fn(() => 'task-1'),
    getCheckpoint: vi.fn((id: string) => checkpoints.get(id)),
    addEvent: vi.fn(),
    addMessage: vi.fn(),
    persistRuntimeState: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function makeOrchestrator(overrides: Record<string, unknown> = {}): any {
  return {
    getTask: vi.fn().mockReturnValue({ id: 'task-1', status: TaskStatus.RUNNING }),
    cancelTask: vi.fn().mockResolvedValue({ id: 'task-1', status: TaskStatus.CANCELLED }),
    deleteSessionState: vi.fn().mockResolvedValue(undefined),
    ensureLearningCandidates: vi.fn(),
    ...overrides
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    orchestrator: makeOrchestrator(),
    store: makeStore(),
    thinking: {},
    ...overrides
  };
}

describe('session-coordinator-session-ops (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncSessionTask', () => {
    it('delegates to syncCoordinatorTask', async () => {
      const { syncCoordinatorTask } = await import('../src/session/coordinator/session-coordinator-sync');
      const deps = makeDeps();
      syncSessionTask(deps as any, 'session-1', { id: 'task-1' } as any);
      expect(syncCoordinatorTask).toHaveBeenCalled();
    });
  });

  describe('recoverSession', () => {
    it('recovers session with task', async () => {
      const deps = makeDeps();
      const result = await recoverSession(deps as any, 'session-1');
      expect(result).toBeDefined();
      expect(deps.store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'session_started',
        expect.objectContaining({ recovered: true })
      );
      expect(deps.store.persistRuntimeState).toHaveBeenCalled();
    });

    it('recovers session when task not found', async () => {
      const deps = makeDeps({ orchestrator: makeOrchestrator({ getTask: vi.fn().mockReturnValue(undefined) }) });
      const result = await recoverSession(deps as any, 'session-1');
      expect(result).toBeDefined();
    });
  });

  describe('recoverSessionToCheckpoint', () => {
    it('recovers to checkpoint', async () => {
      const deps = makeDeps();
      const result = await recoverSessionToCheckpoint(deps as any, 'session-1', { checkpointCursor: 5 });
      expect(result).toBeDefined();
      expect(deps.store.addEvent).toHaveBeenCalled();
    });

    it('throws when checkpoint not found', async () => {
      const store = makeStore({ checkpoints: new Map() });
      await expect(recoverSessionToCheckpoint({ store } as any, 'session-1', {})).rejects.toThrow(
        'Checkpoint for session session-1 not found'
      );
    });

    it('throws when checkpointId does not match', async () => {
      const deps = makeDeps();
      await expect(recoverSessionToCheckpoint(deps as any, 'session-1', { checkpointId: 'wrong-id' })).rejects.toThrow(
        'not available'
      );
    });

    it('uses default cursor when not provided', async () => {
      const deps = makeDeps();
      const result = await recoverSessionToCheckpoint(deps as any, 'session-1', {});
      expect(result).toBeDefined();
    });

    it('sets waiting_approval status when graph is waiting', async () => {
      const store = makeStore();
      const checkpoint = store.checkpoints.get('session-1');
      checkpoint.graphState.status = TaskStatus.WAITING_APPROVAL;
      checkpoint.pendingApproval = { intent: 'write_file' };
      const result = await recoverSessionToCheckpoint({ store } as any, 'session-1', {});
      expect(result.status).toBe('waiting_approval');
    });
  });

  describe('cancelSessionRun', () => {
    it('cancels run with task', async () => {
      const deps = makeDeps();
      const result = await cancelSessionRun(deps as any, 'session-1', { reason: 'user cancelled' });
      expect(result).toBeDefined();
    });

    it('cancels when no task id found', async () => {
      const store = makeStore();
      store.requireSession.mockReturnValue({ id: 'session-1', status: 'running', currentTaskId: undefined });
      store.getCheckpoint.mockReturnValue(undefined);
      const result = await cancelSessionRun(
        { orchestrator: makeOrchestrator(), store, thinking: {} } as any,
        'session-1'
      );
      expect(result.status).toBe('cancelled');
    });

    it('cancels when orchestrator returns no task', async () => {
      const deps = makeDeps({ orchestrator: makeOrchestrator({ cancelTask: vi.fn().mockResolvedValue(undefined) }) });
      const result = await cancelSessionRun(deps as any, 'session-1');
      expect(result).toBeDefined();
    });

    it('gets task id from checkpoint when session has none', async () => {
      const store = makeStore();
      store.requireSession.mockReturnValue({ id: 'session-1', status: 'running', currentTaskId: undefined });
      const deps = makeDeps({ store });
      const result = await cancelSessionRun(deps as any, 'session-1');
      expect(result).toBeDefined();
    });

    it('handles cancelled task without reason', async () => {
      const deps = makeDeps();
      const result = await cancelSessionRun(deps as any, 'session-1', undefined);
      expect(result).toBeDefined();
    });
  });

  describe('finishSessionCancellation', () => {
    it('cancels active session', async () => {
      const store = makeStore();
      const session = { id: 'session-1', status: 'running', updatedAt: '2026-01-01T00:00:00Z' };
      const result = await finishSessionCancellation(store, 'session-1', session as any, 'test reason');
      expect(result.status).toBe('cancelled');
      expect(store.addEvent).toHaveBeenCalled();
      expect(store.addMessage).toHaveBeenCalled();
    });

    it('does not change completed session', async () => {
      const store = makeStore();
      const session = { id: 'session-1', status: 'completed', updatedAt: '2026-01-01T00:00:00Z' };
      await finishSessionCancellation(store, 'session-1', session as any);
      expect(session.status).toBe('completed');
    });

    it('does not change failed session', async () => {
      const store = makeStore();
      const session = { id: 'session-1', status: 'failed', updatedAt: '2026-01-01T00:00:00Z' };
      await finishSessionCancellation(store, 'session-1', session as any);
      expect(session.status).toBe('failed');
    });

    it('does not change cancelled session', async () => {
      const store = makeStore();
      const session = { id: 'session-1', status: 'cancelled', updatedAt: '2026-01-01T00:00:00Z' };
      await finishSessionCancellation(store, 'session-1', session as any);
      expect(session.status).toBe('cancelled');
    });

    it('cancels without reason', async () => {
      const store = makeStore();
      const session = { id: 'session-1', status: 'idle', updatedAt: '2026-01-01T00:00:00Z' };
      await finishSessionCancellation(store, 'session-1', session as any);
      expect(store.addMessage).toHaveBeenCalledWith('session-1', 'system', '已手动终止当前执行。', undefined);
    });
  });

  describe('deleteSessionState', () => {
    it('deletes all session data', async () => {
      const deps = makeDeps();
      await deleteSessionState(deps as any, 'session-1');
      expect(deps.orchestrator.deleteSessionState).toHaveBeenCalledWith('session-1');
      expect(deps.store.sessions.has('session-1')).toBe(false);
      expect(deps.store.persistRuntimeState).toHaveBeenCalled();
    });
  });
});
