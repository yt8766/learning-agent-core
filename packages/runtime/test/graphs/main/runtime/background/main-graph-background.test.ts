import { describe, expect, it, vi } from 'vitest';

import { MainGraphBackgroundRuntime } from '../../../../../src/graphs/main/runtime/background/main-graph-background';

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'QUEUED',
    currentNode: undefined,
    currentStep: undefined,
    result: undefined,
    review: undefined,
    retryCount: 0,
    maxRetries: 1,
    sessionId: 'session-1',
    queueState: {
      mode: 'foreground',
      backgroundRun: true,
      status: 'queued',
      enqueuedAt: '2026-04-16T00:00:00.000Z',
      attempt: 1
    },
    budgetState: undefined,
    trace: [],
    messages: [],
    updatedAt: '2026-04-16T00:00:00.000Z',
    ...overrides
  } as any;
}

function makeRuntime(overrides: Record<string, any> = {}) {
  const tasks = new Map<string, any>();
  const pendingExecutions = new Map<string, any>();
  const cancelledTasks = new Set<string>();

  return {
    runtime: new MainGraphBackgroundRuntime(
      tasks,
      pendingExecutions,
      cancelledTasks,
      vi.fn().mockReturnValue({ retryBudget: 1, retriesConsumed: 0 }),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined)),
      vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined))
    ),
    tasks,
    pendingExecutions,
    cancelledTasks
  };
}

describe('MainGraphBackgroundRuntime', () => {
  describe('listQueuedBackgroundTasks', () => {
    it('returns tasks with backgroundRun and queued status', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask();
      tasks.set(task.id, task);
      const result = runtime.listQueuedBackgroundTasks(() => [...tasks.values()]);
      expect(result).toHaveLength(1);
    });

    it('excludes tasks without backgroundRun', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: false, status: 'queued' } });
      tasks.set(task.id, task);
      expect(runtime.listQueuedBackgroundTasks(() => [...tasks.values()])).toHaveLength(0);
    });

    it('excludes tasks not in queued status', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, status: 'running' } });
      tasks.set(task.id, task);
      expect(runtime.listQueuedBackgroundTasks(() => [...tasks.values()])).toHaveLength(0);
    });

    it('includes tasks with expired lease', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: {
          backgroundRun: true,
          status: 'queued',
          leaseExpiresAt: '2020-01-01T00:00:00.000Z'
        }
      });
      tasks.set(task.id, task);
      expect(runtime.listQueuedBackgroundTasks(() => [...tasks.values()])).toHaveLength(1);
    });

    it('excludes tasks with active lease', () => {
      const { runtime, tasks } = makeRuntime();
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const task = makeTask({
        queueState: {
          backgroundRun: true,
          status: 'queued',
          leaseExpiresAt: futureDate
        }
      });
      tasks.set(task.id, task);
      expect(runtime.listQueuedBackgroundTasks(() => [...tasks.values()])).toHaveLength(0);
    });

    it('includes tasks without leaseExpiresAt', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: { backgroundRun: true, status: 'queued', leaseExpiresAt: undefined }
      });
      tasks.set(task.id, task);
      expect(runtime.listQueuedBackgroundTasks(() => [...tasks.values()])).toHaveLength(1);
    });
  });

  describe('listExpiredBackgroundLeases', () => {
    it('returns running tasks with expired leases', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: {
          backgroundRun: true,
          status: 'running',
          leaseOwner: 'runner-1',
          leaseExpiresAt: '2020-01-01T00:00:00.000Z'
        }
      });
      tasks.set(task.id, task);
      expect(runtime.listExpiredBackgroundLeases(() => [...tasks.values()])).toHaveLength(1);
    });

    it('excludes non-running tasks', () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: {
          backgroundRun: true,
          status: 'queued',
          leaseOwner: 'runner-1',
          leaseExpiresAt: '2020-01-01T00:00:00.000Z'
        }
      });
      tasks.set(task.id, task);
      expect(runtime.listExpiredBackgroundLeases(() => [...tasks.values()])).toHaveLength(0);
    });
  });

  describe('acquireBackgroundLease', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.acquireBackgroundLease('missing', 'owner', 60000)).toBeUndefined();
    });

    it('returns undefined for non-background task', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: false, status: 'queued' } });
      tasks.set(task.id, task);
      expect(await runtime.acquireBackgroundLease(task.id, 'owner', 60000)).toBeUndefined();
    });

    it('returns undefined for non-queued task', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, status: 'running' } });
      tasks.set(task.id, task);
      expect(await runtime.acquireBackgroundLease(task.id, 'owner', 60000)).toBeUndefined();
    });

    it('returns undefined when lease is still active', async () => {
      const { runtime, tasks } = makeRuntime();
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const task = makeTask({
        queueState: { backgroundRun: true, status: 'queued', leaseExpiresAt: futureDate }
      });
      tasks.set(task.id, task);
      expect(await runtime.acquireBackgroundLease(task.id, 'owner', 60000)).toBeUndefined();
    });

    it('acquires lease for eligible task', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask();
      tasks.set(task.id, task);
      const result = await runtime.acquireBackgroundLease(task.id, 'runner-1', 120000);
      expect(result).toBeDefined();
      expect(task.queueState.leaseOwner).toBe('runner-1');
      expect(task.queueState.leaseExpiresAt).toBeDefined();
      expect(task.queueState.lastHeartbeatAt).toBeDefined();
    });
  });

  describe('heartbeatBackgroundLease', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.heartbeatBackgroundLease('missing', 'owner', 60000)).toBeUndefined();
    });

    it('returns undefined when lease owner does not match', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: { backgroundRun: true, leaseOwner: 'other-runner' }
      });
      tasks.set(task.id, task);
      expect(await runtime.heartbeatBackgroundLease(task.id, 'runner-1', 60000)).toBeUndefined();
    });

    it('extends lease when owner matches', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        queueState: { backgroundRun: true, leaseOwner: 'runner-1' }
      });
      tasks.set(task.id, task);
      const result = await runtime.heartbeatBackgroundLease(task.id, 'runner-1', 120000);
      expect(result).toBeDefined();
      expect(task.queueState.leaseExpiresAt).toBeDefined();
      expect(task.queueState.lastHeartbeatAt).toBeDefined();
    });
  });

  describe('releaseBackgroundLease', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.releaseBackgroundLease('missing', 'owner')).toBeUndefined();
    });

    it('returns undefined when owner does not match', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, leaseOwner: 'other' } });
      tasks.set(task.id, task);
      expect(await runtime.releaseBackgroundLease(task.id, 'runner-1')).toBeUndefined();
    });

    it('clears lease fields when owner matches', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, leaseOwner: 'runner-1' } });
      tasks.set(task.id, task);
      const result = await runtime.releaseBackgroundLease(task.id, 'runner-1');
      expect(result).toBeDefined();
      expect(task.queueState.leaseOwner).toBeUndefined();
      expect(task.queueState.leaseExpiresAt).toBeUndefined();
      expect(task.queueState.lastHeartbeatAt).toBeUndefined();
    });
  });

  describe('reclaimExpiredBackgroundLease', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.reclaimExpiredBackgroundLease('missing', 'owner')).toBeUndefined();
    });

    it('returns undefined for non-running task', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, status: 'queued' } });
      tasks.set(task.id, task);
      expect(await runtime.reclaimExpiredBackgroundLease(task.id, 'owner')).toBeUndefined();
    });

    it('returns undefined when lease is not expired', async () => {
      const { runtime, tasks } = makeRuntime();
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const task = makeTask({
        queueState: { backgroundRun: true, status: 'running', leaseExpiresAt: futureDate }
      });
      tasks.set(task.id, task);
      expect(await runtime.reclaimExpiredBackgroundLease(task.id, 'owner')).toBeUndefined();
    });

    it('re-queues task when retries available', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        status: 'RUNNING',
        queueState: {
          mode: 'foreground',
          backgroundRun: true,
          status: 'running',
          leaseOwner: 'runner-1',
          leaseExpiresAt: '2020-01-01T00:00:00.000Z',
          attempt: 1
        },
        budgetState: { retryBudget: 3, retriesConsumed: 0 }
      });
      tasks.set(task.id, task);
      const result = await runtime.reclaimExpiredBackgroundLease(task.id, 'runner-1');
      expect(result).toBeDefined();
      expect(task.status).toBe('queued');
      expect(task.queueState.status).toBe('queued');
      expect(task.queueState.attempt).toBe(2);
    });

    it('fails task when retries exhausted', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({
        status: 'RUNNING',
        queueState: {
          mode: 'foreground',
          backgroundRun: true,
          status: 'running',
          leaseOwner: 'runner-1',
          leaseExpiresAt: '2020-01-01T00:00:00.000Z',
          attempt: 3
        },
        budgetState: { retryBudget: 1, retriesConsumed: 1 }
      });
      tasks.set(task.id, task);
      const result = await runtime.reclaimExpiredBackgroundLease(task.id, 'runner-1');
      expect(result).toBeDefined();
      expect(task.status).toBe('failed');
    });
  });

  describe('runBackgroundTask', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.runBackgroundTask('missing')).toBeUndefined();
    });

    it('returns undefined for non-queued task', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask({ queueState: { backgroundRun: true, status: 'running' } });
      tasks.set(task.id, task);
      expect(await runtime.runBackgroundTask(task.id)).toBeUndefined();
    });
  });

  describe('markBackgroundTaskRunnerFailure', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.markBackgroundTaskRunnerFailure('missing', 'crash')).toBeUndefined();
    });

    it('marks task as failed', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask();
      tasks.set(task.id, task);
      const result = await runtime.markBackgroundTaskRunnerFailure(task.id, 'OOM crash');
      expect(result).toBeDefined();
      expect(task.status).toBe('failed');
      expect(task.result).toBe('OOM crash');
    });
  });

  describe('retryTask', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.retryTask('missing')).toBeUndefined();
    });

    it('re-queues and runs task pipeline', async () => {
      const { runtime, tasks, pendingExecutions } = makeRuntime();
      const task = makeTask({ status: 'FAILED', sessionId: 'session-1' });
      tasks.set(task.id, task);
      pendingExecutions.set(task.id, { taskId: task.id });

      const result = await runtime.retryTask(task.id);
      expect(result).toBeDefined();
      expect(task.status).toBe('queued');
      expect(task.queueState.status).toBe('queued');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(1);
      expect(pendingExecutions.has(task.id)).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('returns undefined for missing task', async () => {
      const { runtime } = makeRuntime();
      expect(await runtime.cancelTask('missing')).toBeUndefined();
    });

    it('cancels task with reason', async () => {
      const { runtime, tasks, cancelledTasks, pendingExecutions } = makeRuntime();
      const task = makeTask();
      tasks.set(task.id, task);
      pendingExecutions.set(task.id, { taskId: task.id });

      const result = await runtime.cancelTask(task.id, 'user request');
      expect(result).toBeDefined();
      expect(task.status).toBe('cancelled');
      expect(task.result).toContain('user request');
      expect(cancelledTasks.has(task.id)).toBe(true);
      expect(pendingExecutions.has(task.id)).toBe(false);
    });

    it('cancels task without reason', async () => {
      const { runtime, tasks } = makeRuntime();
      const task = makeTask();
      tasks.set(task.id, task);
      const result = await runtime.cancelTask(task.id);
      expect(task.result).toContain('已手动终止');
    });
  });

  describe('deleteSessionState', () => {
    it('removes all tasks for session', async () => {
      const { runtime, tasks, pendingExecutions, cancelledTasks } = makeRuntime();
      const task1 = makeTask({ id: 'task-1', sessionId: 'session-1' });
      const task2 = makeTask({ id: 'task-2', sessionId: 'session-1' });
      const task3 = makeTask({ id: 'task-3', sessionId: 'session-2' });
      tasks.set('task-1', task1);
      tasks.set('task-2', task2);
      tasks.set('task-3', task3);
      pendingExecutions.set('task-1', {});
      cancelledTasks.add('task-2');

      await runtime.deleteSessionState('session-1');

      expect(tasks.has('task-1')).toBe(false);
      expect(tasks.has('task-2')).toBe(false);
      expect(tasks.has('task-3')).toBe(true);
      expect(pendingExecutions.has('task-1')).toBe(false);
      expect(cancelledTasks.has('task-2')).toBe(false);
    });
  });
});
