import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGraphInvoke = vi.fn();
const mockGraphCompile = vi.fn(() => ({ invoke: mockGraphInvoke }));
const mockCreateLearningGraph = vi.fn(() => ({ compile: mockGraphCompile }));

vi.mock('../src/graphs/learning/learning.graph', () => ({
  createLearningGraph: (...args: unknown[]) => mockCreateLearningGraph(...args)
}));

vi.mock('@agent/core', () => ({
  TaskStatus: {
    QUEUED: 'queued',
    RUNNING: 'running',
    WAITING_APPROVAL: 'waiting_approval',
    BLOCKED: 'blocked',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    FAILED: 'failed'
  }
}));

import {
  autoConfirmLearningIfNeeded,
  runLearningConfirmation
} from '../src/session/coordinator/session-coordinator-learning';

function makeStore(overrides: Record<string, unknown> = {}) {
  const session = {
    id: 'session-1',
    status: 'active',
    updatedAt: '',
    ...overrides
  };
  return {
    requireSession: vi.fn(() => session),
    addEvent: vi.fn(),
    persistRuntimeState: vi.fn().mockResolvedValue(undefined),
    _session: session
  };
}

function makeOrchestrator(confirmResult?: any) {
  return {
    confirmLearning: vi.fn().mockResolvedValue(confirmResult)
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    status: 'running',
    updatedAt: '2026-01-01T00:00:00Z',
    learningCandidates: [
      { id: 'c1', status: 'pending_confirmation' },
      { id: 'c2', status: 'pending_confirmation' },
      { id: 'c3', status: 'confirmed' }
    ],
    ...overrides
  };
}

describe('session-coordinator-learning (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autoConfirmLearningIfNeeded', () => {
    it('returns early when no candidates are pending_confirmation', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({
        learningCandidates: [{ id: 'c1', status: 'confirmed' }]
      });

      await autoConfirmLearningIfNeeded(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });

    it('returns early when learningCandidates is undefined', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({ learningCandidates: undefined });

      await autoConfirmLearningIfNeeded(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });

    it('selects preferredCandidateIds that are also pending', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({
        learningEvaluation: {
          autoConfirmCandidateIds: ['c1']
        },
        learningCandidates: [
          { id: 'c1', status: 'pending_confirmation' },
          { id: 'c2', status: 'pending_confirmation' }
        ]
      });
      mockGraphInvoke.mockResolvedValue({});

      await autoConfirmLearningIfNeeded(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).toHaveBeenCalled();
    });

    it('returns early when preferredCandidateIds exist but none are pending', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({
        learningEvaluation: {
          autoConfirmCandidateIds: ['nonexistent']
        },
        learningCandidates: [{ id: 'c1', status: 'pending_confirmation' }]
      });

      // preferredCandidateIds.filter(id => pendingIds.includes(id)) = [] (empty array)
      // Empty array is truthy (not nullish), so ?? does not fall back to pendingCandidateIds
      // The selectedCandidateIds is empty, so returns early
      await autoConfirmLearningIfNeeded(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });

    it('returns early when no selectedCandidateIds after filtering', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({
        learningEvaluation: {
          autoConfirmCandidateIds: ['nonexistent']
        },
        learningCandidates: [{ id: 'c1', status: 'confirmed' }]
      });

      await autoConfirmLearningIfNeeded(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });
  });

  describe('runLearningConfirmation', () => {
    it('returns early when no candidateIds and task has no learningCandidates', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({ learningCandidates: undefined });

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });

    it('returns early when candidateIds is empty array and task has no candidates', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({ learningCandidates: undefined });

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, []);
      expect(mockCreateLearningGraph).not.toHaveBeenCalled();
    });

    it('uses task learningCandidate ids when candidateIds is undefined', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any);
      expect(mockCreateLearningGraph).toHaveBeenCalled();
      expect(mockGraphInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          candidateIds: ['c1', 'c2', 'c3'],
          autoConfirmed: false
        })
      );
    });

    it('passes explicit candidateIds and autoConfirmed flag', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1'], true);
      expect(mockGraphInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateIds: ['c1'],
          autoConfirmed: true
        })
      );
    });

    it('sets session status to completed when task is not failed', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({ status: 'completed' });
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      expect(store._session.status).toBe('completed');
    });

    it('sets session status to failed when task status is failed', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask({ status: 'failed' });
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      expect(store._session.status).toBe('failed');
    });

    it('adds learning_confirmed event', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1', 'c2'], true);
      expect(store.addEvent).toHaveBeenCalledWith('session-1', 'learning_confirmed', {
        taskId: 'task-1',
        candidateIds: ['c1', 'c2'],
        autoConfirmed: true
      });
    });

    it('persists runtime state after confirmation', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      expect(store.persistRuntimeState).toHaveBeenCalled();
    });

    it('updates session updatedAt timestamp', async () => {
      const orchestrator = makeOrchestrator();
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockResolvedValue({});

      const before = new Date().toISOString();
      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      const after = new Date().toISOString();

      expect(store._session.updatedAt >= before).toBe(true);
      expect(store._session.updatedAt <= after).toBe(true);
    });

    it('updates task from confirmed result when orchestrator returns task', async () => {
      const confirmedTask = {
        learningCandidates: [
          { id: 'c1', status: 'confirmed' },
          { id: 'c2', status: 'pending_confirmation' }
        ],
        updatedAt: '2026-05-10T12:00:00Z'
      };
      let capturedConfirmHandler: ((state: any) => Promise<any>) | undefined;
      mockCreateLearningGraph.mockImplementation((handlers: any) => {
        capturedConfirmHandler = handlers.confirm;
        return { compile: mockGraphCompile };
      });
      mockGraphInvoke.mockImplementation(async (state: any) => {
        if (capturedConfirmHandler) {
          return capturedConfirmHandler(state);
        }
        return state;
      });

      const orchestrator = makeOrchestrator(confirmedTask);
      const store = makeStore();
      const task = makeTask();

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      // The confirm handler overwrites task.learningCandidates from confirmedTask
      expect(task.learningCandidates).toEqual(confirmedTask.learningCandidates);
      expect(task.updatedAt).toBe('2026-05-10T12:00:00Z');
    });

    it('does not update task when orchestrator returns null', async () => {
      const orchestrator = makeOrchestrator(null);
      const store = makeStore();
      const task = makeTask();
      const originalCandidates = task.learningCandidates;
      mockGraphInvoke.mockResolvedValue({});

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1']);
      expect(task.learningCandidates).toBe(originalCandidates);
    });

    it('filters confirmed candidates correctly in graph confirm handler', async () => {
      let capturedConfirmHandler: ((state: any) => Promise<any>) | undefined;
      mockCreateLearningGraph.mockImplementation((handlers: any) => {
        capturedConfirmHandler = handlers.confirm;
        return { compile: mockGraphCompile };
      });

      const confirmedTask = {
        learningCandidates: [
          { id: 'c1', status: 'confirmed' },
          { id: 'c2', status: 'pending_confirmation' }
        ],
        updatedAt: '2026-05-10T12:00:00Z'
      };
      const orchestrator = makeOrchestrator(confirmedTask);
      const store = makeStore();
      const task = makeTask();
      mockGraphInvoke.mockImplementation(async (state: any) => {
        if (capturedConfirmHandler) {
          return capturedConfirmHandler(state);
        }
        return state;
      });

      await runLearningConfirmation(orchestrator as any, store as any, 'session-1', task as any, ['c1', 'c2']);

      // The confirm handler should have been called
      expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-1', ['c1', 'c2']);
    });
  });
});
