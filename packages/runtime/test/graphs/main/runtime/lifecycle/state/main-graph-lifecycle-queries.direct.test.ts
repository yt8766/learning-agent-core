import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock heavy dependencies
vi.mock('../../../../../../src/graphs/main/runtime/lifecycle/learning/main-graph-lifecycle-learning', () => ({
  createLifecycleDocumentLearningJob: vi.fn(),
  createLifecycleResearchLearningJob: vi.fn(),
  enqueueLifecycleTaskLearning: vi.fn(),
  getLifecycleLearningJob: vi.fn(),
  listLifecycleLearningJobs: vi.fn(),
  listLifecycleLearningQueue: vi.fn(),
  listLifecycleRules: vi.fn(),
  processLifecycleLearningQueue: vi.fn(),
  scanLifecycleLearningConflicts: vi.fn(),
  updateLifecycleLearningConflictStatus: vi.fn()
}));

vi.mock('../../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-background', () => ({
  acquireLifecycleBackgroundLease: vi.fn(),
  cancelLifecycleTask: vi.fn(),
  deleteLifecycleSessionState: vi.fn(),
  heartbeatLifecycleBackgroundLease: vi.fn(),
  isLifecycleWorkerEnabled: vi.fn(),
  listExpiredLifecycleBackgroundLeases: vi.fn(),
  listLifecycleTaskTraces: vi.fn(),
  listLifecycleWorkers: vi.fn(),
  listQueuedLifecycleBackgroundTasks: vi.fn(),
  markLifecycleBackgroundTaskRunnerFailure: vi.fn(),
  reclaimExpiredLifecycleBackgroundLease: vi.fn(),
  registerLifecycleWorker: vi.fn(),
  releaseLifecycleBackgroundLease: vi.fn(),
  retryLifecycleTask: vi.fn(),
  runLifecycleBackgroundTask: vi.fn(),
  setLifecycleWorkerEnabled: vi.fn()
}));

import { MainGraphLifecycleQueries } from '../../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-queries';
import {
  listLifecycleWorkers,
  registerLifecycleWorker,
  setLifecycleWorkerEnabled,
  isLifecycleWorkerEnabled,
  listQueuedLifecycleBackgroundTasks,
  acquireLifecycleBackgroundLease,
  heartbeatLifecycleBackgroundLease,
  releaseLifecycleBackgroundLease,
  listExpiredLifecycleBackgroundLeases,
  reclaimExpiredLifecycleBackgroundLease,
  runLifecycleBackgroundTask,
  markLifecycleBackgroundTaskRunnerFailure,
  listLifecycleTaskTraces,
  retryLifecycleTask,
  cancelLifecycleTask,
  deleteLifecycleSessionState
} from '../../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-background';
import {
  scanLifecycleLearningConflicts,
  processLifecycleLearningQueue,
  updateLifecycleLearningConflictStatus,
  listLifecycleRules,
  createLifecycleDocumentLearningJob,
  createLifecycleResearchLearningJob,
  getLifecycleLearningJob,
  listLifecycleLearningJobs,
  listLifecycleLearningQueue,
  enqueueLifecycleTaskLearning
} from '../../../../../../src/graphs/main/runtime/lifecycle/learning/main-graph-lifecycle-learning';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: 'running',
    goal: 'test',
    updatedAt: '2026-05-10T00:00:00.000Z',
    approvals: [],
    messages: [],
    agentStates: [],
    activeInterrupt: undefined,
    ...overrides
  };
}

function makeParams(overrides: Record<string, unknown> = {}): any {
  return {
    tasks: new Map(),
    learningJobs: new Map(),
    learningQueue: new Map(),
    pendingExecutions: new Map(),
    workerRegistry: {},
    backgroundRuntime: {},
    learningFlow: { ensureCandidates: vi.fn().mockReturnValue([]), confirmCandidates: vi.fn() },
    learningJobsRuntime: { processQueuedLearningJobs: vi.fn() },
    runtimeStateRepository: {},
    ...overrides
  };
}

// Concrete subclass to test abstract class
class TestableLifecycleQueries extends MainGraphLifecycleQueries {
  public initCalled = false;
  public bgDeps: any;

  protected async initialize(): Promise<void> {
    this.initCalled = true;
  }

  protected getBackgroundLifecycleDeps() {
    return (
      this.bgDeps ?? {
        workerRegistry: this.params.workerRegistry,
        backgroundRuntime: this.params.backgroundRuntime,
        listTasks: () => this.listTasks(),
        initialize: () => this.initialize()
      }
    );
  }

  protected async persistAndEmitTask(): Promise<void> {}
  protected async handleInterruptTimeout(): Promise<any> {
    return undefined;
  }
}

describe('MainGraphLifecycleQueries (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTask', () => {
    it('returns task by id', () => {
      const task = makeTask();
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.getTask('task-1')).toBe(task);
    });

    it('returns undefined for missing task', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.getTask('missing')).toBeUndefined();
    });
  });

  describe('listTasks', () => {
    it('returns tasks sorted by updatedAt descending', () => {
      const t1 = makeTask({ id: 't1', updatedAt: '2026-01-01T00:00:00Z' });
      const t2 = makeTask({ id: 't2', updatedAt: '2026-01-03T00:00:00Z' });
      const t3 = makeTask({ id: 't3', updatedAt: '2026-01-02T00:00:00Z' });
      const params = makeParams({
        tasks: new Map([
          ['t1', t1],
          ['t2', t2],
          ['t3', t3]
        ])
      });
      const queries = new TestableLifecycleQueries(params);
      const list = queries.listTasks();
      expect(list[0].id).toBe('t2');
      expect(list[1].id).toBe('t3');
      expect(list[2].id).toBe('t1');
    });
  });

  describe('listPendingApprovals', () => {
    it('returns tasks with pending approvals', () => {
      const task = makeTask({ approvals: [{ decision: 'pending' }] });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.listPendingApprovals()).toHaveLength(1);
    });

    it('excludes tasks without pending approvals', () => {
      const task = makeTask({ approvals: [{ decision: 'approved' }] });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.listPendingApprovals()).toHaveLength(0);
    });
  });

  describe('worker delegation', () => {
    it('delegates listWorkers', () => {
      vi.mocked(listLifecycleWorkers).mockReturnValue([{ id: 'w1' }] as any);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listWorkers();
      expect(listLifecycleWorkers).toHaveBeenCalled();
    });

    it('delegates registerWorker', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      queries.registerWorker({ id: 'w1' } as any);
      expect(registerLifecycleWorker).toHaveBeenCalled();
    });

    it('delegates setWorkerEnabled', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      queries.setWorkerEnabled('w1', true);
      expect(setLifecycleWorkerEnabled).toHaveBeenCalled();
    });

    it('delegates isWorkerEnabled', () => {
      vi.mocked(isLifecycleWorkerEnabled).mockReturnValue(true);
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.isWorkerEnabled('w1')).toBe(true);
    });
  });

  describe('background task delegation', () => {
    it('delegates listQueuedBackgroundTasks', () => {
      vi.mocked(listQueuedLifecycleBackgroundTasks).mockReturnValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listQueuedBackgroundTasks();
      expect(listQueuedLifecycleBackgroundTasks).toHaveBeenCalled();
    });

    it('delegates acquireBackgroundLease', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.acquireBackgroundLease('t1', 'owner', 1000);
      expect(acquireLifecycleBackgroundLease).toHaveBeenCalled();
    });

    it('delegates heartbeatBackgroundLease', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.heartbeatBackgroundLease('t1', 'owner', 1000);
      expect(heartbeatLifecycleBackgroundLease).toHaveBeenCalled();
    });

    it('delegates releaseBackgroundLease', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.releaseBackgroundLease('t1', 'owner');
      expect(releaseLifecycleBackgroundLease).toHaveBeenCalled();
    });

    it('delegates listExpiredBackgroundLeases', () => {
      vi.mocked(listExpiredLifecycleBackgroundLeases).mockReturnValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listExpiredBackgroundLeases();
      expect(listExpiredLifecycleBackgroundLeases).toHaveBeenCalled();
    });

    it('delegates reclaimExpiredBackgroundLease', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.reclaimExpiredBackgroundLease('t1', 'owner');
      expect(reclaimExpiredLifecycleBackgroundLease).toHaveBeenCalled();
    });

    it('delegates runBackgroundTask', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.runBackgroundTask('t1');
      expect(runLifecycleBackgroundTask).toHaveBeenCalled();
    });

    it('delegates markBackgroundTaskRunnerFailure', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.markBackgroundTaskRunnerFailure('t1', 'reason');
      expect(markLifecycleBackgroundTaskRunnerFailure).toHaveBeenCalled();
    });
  });

  describe('task data accessors', () => {
    it('delegates listTaskTraces', () => {
      vi.mocked(listLifecycleTaskTraces).mockReturnValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listTaskTraces('t1');
      expect(listLifecycleTaskTraces).toHaveBeenCalled();
    });

    it('getTaskAgents returns agent states', () => {
      const task = makeTask({ agentStates: [{ agentId: 'a1' }] });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.getTaskAgents('task-1')).toEqual([{ agentId: 'a1' }]);
    });

    it('getTaskAgents returns empty for missing task', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.getTaskAgents('missing')).toEqual([]);
    });

    it('getTaskMessages returns messages', () => {
      const task = makeTask({ messages: [{ id: 'm1' }] });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.getTaskMessages('task-1')).toEqual([{ id: 'm1' }]);
    });

    it('getTaskMessages returns empty for missing task', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.getTaskMessages('missing')).toEqual([]);
    });

    it('getTaskPlan returns plan', () => {
      const task = makeTask({ plan: { steps: [] } });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.getTaskPlan('task-1')).toEqual({ steps: [] });
    });

    it('getTaskPlan returns undefined for missing task', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.getTaskPlan('missing')).toBeUndefined();
    });

    it('getTaskReview returns review', () => {
      const task = makeTask({ review: { decision: 'pass' } });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      expect(queries.getTaskReview('task-1')).toEqual({ decision: 'pass' });
    });

    it('getTaskReview returns undefined for missing task', () => {
      const queries = new TestableLifecycleQueries(makeParams());
      expect(queries.getTaskReview('missing')).toBeUndefined();
    });
  });

  describe('retry and cancel', () => {
    it('delegates retryTask', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.retryTask('t1');
      expect(retryLifecycleTask).toHaveBeenCalled();
    });

    it('delegates cancelTask', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.cancelTask('t1', 'reason');
      expect(cancelLifecycleTask).toHaveBeenCalled();
    });

    it('delegates deleteSessionState', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.deleteSessionState('s1');
      expect(deleteLifecycleSessionState).toHaveBeenCalled();
    });
  });

  describe('learning delegation', () => {
    it('delegates ensureLearningCandidates', () => {
      const task = makeTask();
      const params = makeParams();
      const queries = new TestableLifecycleQueries(params);
      queries.ensureLearningCandidates(task);
      expect(params.learningFlow.ensureCandidates).toHaveBeenCalledWith(task);
    });

    it('confirmLearning returns undefined for missing task', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      const result = await queries.confirmLearning('missing');
      expect(result).toBeUndefined();
    });

    it('confirmLearning updates and persists task', async () => {
      const task = makeTask();
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      const result = await queries.confirmLearning('task-1', ['c1']);
      expect(result).toBe(task);
      expect(params.learningFlow.confirmCandidates).toHaveBeenCalled();
    });

    it('delegates scanLearningConflicts', async () => {
      vi.mocked(scanLifecycleLearningConflicts).mockResolvedValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.scanLearningConflicts();
      expect(scanLifecycleLearningConflicts).toHaveBeenCalled();
    });

    it('delegates processLearningQueue', async () => {
      vi.mocked(processLifecycleLearningQueue).mockResolvedValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.processLearningQueue(5);
      expect(processLifecycleLearningQueue).toHaveBeenCalled();
    });

    it('delegates processQueuedLearningJobs', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.processQueuedLearningJobs(5);
      expect(queries.params.learningJobsRuntime.processQueuedLearningJobs).toHaveBeenCalledWith(5);
    });

    it('delegates updateLearningConflictStatus', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.updateLearningConflictStatus('c1', 'resolved');
      expect(updateLifecycleLearningConflictStatus).toHaveBeenCalled();
    });

    it('delegates listRules', async () => {
      vi.mocked(listLifecycleRules).mockResolvedValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.listRules();
      expect(listLifecycleRules).toHaveBeenCalled();
    });

    it('delegates createDocumentLearningJob', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.createDocumentLearningJob({} as any);
      expect(createLifecycleDocumentLearningJob).toHaveBeenCalled();
    });

    it('delegates createResearchLearningJob', async () => {
      const queries = new TestableLifecycleQueries(makeParams());
      await queries.createResearchLearningJob({} as any);
      expect(createLifecycleResearchLearningJob).toHaveBeenCalled();
    });

    it('delegates getLearningJob', () => {
      vi.mocked(getLifecycleLearningJob).mockReturnValue(undefined);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.getLearningJob('j1');
      expect(getLifecycleLearningJob).toHaveBeenCalled();
    });

    it('delegates listLearningJobs', () => {
      vi.mocked(listLifecycleLearningJobs).mockReturnValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listLearningJobs();
      expect(listLifecycleLearningJobs).toHaveBeenCalled();
    });

    it('delegates listLearningQueue', () => {
      vi.mocked(listLifecycleLearningQueue).mockReturnValue([]);
      const queries = new TestableLifecycleQueries(makeParams());
      queries.listLearningQueue();
      expect(listLifecycleLearningQueue).toHaveBeenCalled();
    });

    it('delegates enqueueTaskLearning', () => {
      const task = makeTask();
      const queries = new TestableLifecycleQueries(makeParams());
      queries.enqueueTaskLearning(task, 'feedback');
      expect(enqueueLifecycleTaskLearning).toHaveBeenCalled();
    });
  });

  describe('sweepInterruptTimeouts', () => {
    it('returns empty when no timed out tasks', async () => {
      const task = makeTask({ activeInterrupt: undefined });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      const result = await queries.sweepInterruptTimeouts();
      expect(result).toEqual([]);
    });

    it('handles timed out interrupts', async () => {
      const task = makeTask({
        activeInterrupt: {
          status: 'pending',
          timeoutMinutes: 1,
          createdAt: '2020-01-01T00:00:00.000Z'
        }
      });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      // handleInterruptTimeout returns undefined in our test subclass
      const result = await queries.sweepInterruptTimeouts();
      expect(result).toEqual([]);
    });

    it('includes tasks where handleInterruptTimeout returns a result', async () => {
      const task = makeTask({
        activeInterrupt: {
          status: 'pending',
          timeoutMinutes: 1,
          createdAt: '2020-01-01T00:00:00.000Z'
        }
      });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      // Override handleInterruptTimeout to return a task
      (queries as any).handleInterruptTimeout = vi.fn().mockResolvedValue(task);
      const result = await queries.sweepInterruptTimeouts();
      expect(result).toHaveLength(1);
    });

    it('skips non-pending interrupts', async () => {
      const task = makeTask({
        activeInterrupt: {
          status: 'resolved',
          timeoutMinutes: 1,
          createdAt: '2020-01-01T00:00:00.000Z'
        }
      });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      const result = await queries.sweepInterruptTimeouts();
      expect(result).toEqual([]);
    });

    it('skips interrupts without timeoutMinutes', async () => {
      const task = makeTask({
        activeInterrupt: {
          status: 'pending',
          createdAt: '2020-01-01T00:00:00.000Z'
        }
      });
      const params = makeParams({ tasks: new Map([['task-1', task]]) });
      const queries = new TestableLifecycleQueries(params);
      const result = await queries.sweepInterruptTimeouts();
      expect(result).toEqual([]);
    });
  });
});
