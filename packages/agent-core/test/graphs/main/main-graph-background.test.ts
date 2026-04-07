import { describe, expect, it, vi } from 'vitest';

import { TaskStatus } from '@agent/shared';

import { MainGraphBackgroundRuntime } from '../../../src/graphs/main/background/main-graph-background';

function createTask(overrides: Record<string, unknown> = {}) {
  const now = '2026-04-01T00:00:00.000Z';
  return {
    id: 'task-1',
    runId: 'run-1',
    goal: 'background work',
    context: 'ctx',
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
    status: TaskStatus.QUEUED,
    retryCount: 0,
    maxRetries: 1,
    queueState: {
      mode: 'background',
      backgroundRun: true,
      status: 'queued',
      enqueuedAt: now,
      startedAt: undefined,
      finishedAt: undefined,
      lastTransitionAt: now,
      attempt: 1
    },
    ...overrides
  } as any;
}

function createRuntime(taskList: any[]) {
  const tasks = new Map(taskList.map(task => [task.id, task]));
  const pendingExecutions = new Map<string, any>([['task-1', { approvalId: 'approval-1' }]]);
  const cancelledTasks = new Set<string>();
  const persistAndEmitTask = vi.fn(async () => undefined);
  const persistRuntimeState = vi.fn(async () => undefined);
  const addTrace = vi.fn((task, node, summary, data) => {
    task.trace.push({ node, summary, data });
  });
  const addProgressDelta = vi.fn();
  const markSubgraph = vi.fn((task, subgraphId) => {
    task.lastSubgraph = subgraphId;
  });
  const updateBudgetState = vi.fn((task, overrides) => ({
    stepBudget: task.budgetState?.stepBudget ?? 8,
    stepsConsumed: task.budgetState?.stepsConsumed ?? 1,
    retryBudget: task.budgetState?.retryBudget ?? task.maxRetries ?? 1,
    retriesConsumed: task.budgetState?.retriesConsumed ?? task.retryCount ?? 0,
    sourceBudget: task.budgetState?.sourceBudget ?? 8,
    sourcesConsumed: task.budgetState?.sourcesConsumed ?? 0,
    ...overrides
  }));
  const transitionQueueState = vi.fn((task, status) => {
    task.queueState = {
      ...task.queueState,
      status,
      lastTransitionAt: new Date().toISOString(),
      leaseOwner: undefined,
      leaseExpiresAt: undefined
    };
  });
  const runBootstrapGraph = vi.fn(async (task: any) => {
    if (task.bootstrapStatus) {
      task.status = task.bootstrapStatus;
    }
  });
  const runTaskPipeline = vi.fn(async (task: any) => {
    task.pipelineRan = true;
  });

  const runtime = new MainGraphBackgroundRuntime(
    tasks,
    pendingExecutions,
    cancelledTasks,
    updateBudgetState,
    transitionQueueState,
    addTrace,
    addProgressDelta,
    markSubgraph,
    persistAndEmitTask,
    persistRuntimeState,
    () => runBootstrapGraph,
    () => runTaskPipeline
  );

  return {
    runtime,
    tasks,
    pendingExecutions,
    cancelledTasks,
    persistAndEmitTask,
    persistRuntimeState,
    addTrace,
    addProgressDelta,
    markSubgraph,
    updateBudgetState,
    transitionQueueState,
    runBootstrapGraph,
    runTaskPipeline
  };
}

describe('MainGraphBackgroundRuntime', () => {
  it('filters queued tasks, manages lease lifecycle, and marks runner failures', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T09:00:00.000Z'));

    const queued = createTask({ id: 'task-queued' });
    const leased = createTask({
      id: 'task-leased',
      queueState: {
        ...createTask().queueState,
        leaseExpiresAt: '2026-04-01T09:10:00.000Z'
      }
    });
    const expiredQueued = createTask({
      id: 'task-expired-queued',
      queueState: {
        ...createTask().queueState,
        leaseExpiresAt: '2026-04-01T08:59:00.000Z'
      }
    });
    const expiredRunning = createTask({
      id: 'task-expired-running',
      queueState: {
        ...createTask().queueState,
        status: 'running',
        leaseOwner: 'runner-a',
        leaseExpiresAt: '2026-04-01T08:59:00.000Z'
      }
    });
    const foreground = createTask({
      id: 'task-foreground',
      queueState: {
        ...createTask().queueState,
        backgroundRun: false
      }
    });
    const failedTask = createTask({ id: 'task-failed-runner' });
    const { runtime, addTrace, markSubgraph, addProgressDelta, persistAndEmitTask } = createRuntime([
      queued,
      leased,
      expiredQueued,
      expiredRunning,
      foreground,
      failedTask
    ]);

    expect(
      runtime.listQueuedBackgroundTasks(() => [queued, leased, expiredQueued, expiredRunning, foreground])
    ).toEqual([queued, expiredQueued]);
    expect(
      runtime.listExpiredBackgroundLeases(() => [queued, leased, expiredQueued, expiredRunning, foreground])
    ).toEqual([expiredRunning]);

    expect(await runtime.acquireBackgroundLease('task-leased', 'runner-a', 30_000)).toBeUndefined();
    const acquired = await runtime.acquireBackgroundLease('task-queued', 'runner-a', 30_000);
    expect(acquired?.queueState).toEqual(
      expect.objectContaining({
        leaseOwner: 'runner-a'
      })
    );
    expect(addTrace).toHaveBeenCalledWith(
      queued,
      'background_lease_acquired',
      expect.stringContaining('runner-a'),
      expect.objectContaining({ owner: 'runner-a', ttlMs: 30_000 })
    );
    expect(markSubgraph).toHaveBeenCalledWith(queued, 'background-runner');

    expect(await runtime.heartbeatBackgroundLease('task-queued', 'runner-b', 15_000)).toBeUndefined();
    const heartbeated = await runtime.heartbeatBackgroundLease('task-queued', 'runner-a', 15_000);
    expect(heartbeated?.queueState?.lastHeartbeatAt).toBe('2026-04-01T09:00:00.000Z');

    expect(await runtime.releaseBackgroundLease('task-queued', 'runner-b')).toBeUndefined();
    const released = await runtime.releaseBackgroundLease('task-queued', 'runner-a');
    expect(released?.queueState).toEqual(
      expect.objectContaining({
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        lastHeartbeatAt: undefined
      })
    );

    const failed = await runtime.markBackgroundTaskRunnerFailure('task-failed-runner', 'runner crashed');
    expect(failed).toEqual(
      expect.objectContaining({
        status: TaskStatus.FAILED,
        currentNode: 'background_runner_failed',
        currentStep: 'background_runner_failed',
        result: 'runner crashed'
      })
    );
    expect(addProgressDelta).toHaveBeenCalledWith(failedTask, 'runner crashed');
    expect(await runtime.markBackgroundTaskRunnerFailure('missing-task', 'ignored')).toBeUndefined();
    expect(persistAndEmitTask).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it('requeues expired leases while retry budget remains and fails once exhausted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T10:00:00.000Z'));

    const requeueTask = createTask({
      id: 'task-requeue',
      status: TaskStatus.RUNNING,
      retryCount: 0,
      maxRetries: 1,
      budgetState: { retryBudget: 1, retriesConsumed: 0 },
      queueState: {
        mode: 'background',
        backgroundRun: true,
        status: 'running',
        enqueuedAt: '2026-04-01T09:00:00.000Z',
        startedAt: '2026-04-01T09:01:00.000Z',
        lastTransitionAt: '2026-04-01T09:01:00.000Z',
        attempt: 1,
        leaseOwner: 'runner-1',
        leaseExpiresAt: '2026-04-01T09:59:00.000Z',
        lastHeartbeatAt: '2026-04-01T09:58:30.000Z'
      }
    });
    const failTask = createTask({
      id: 'task-fail',
      status: TaskStatus.RUNNING,
      retryCount: 1,
      maxRetries: 1,
      budgetState: { retryBudget: 1, retriesConsumed: 1 },
      queueState: {
        mode: 'background',
        backgroundRun: true,
        status: 'running',
        enqueuedAt: '2026-04-01T08:00:00.000Z',
        startedAt: '2026-04-01T08:01:00.000Z',
        lastTransitionAt: '2026-04-01T08:01:00.000Z',
        attempt: 2,
        leaseOwner: 'runner-1',
        leaseExpiresAt: '2026-04-01T09:50:00.000Z',
        lastHeartbeatAt: '2026-04-01T09:49:00.000Z'
      }
    });
    const { runtime, updateBudgetState, transitionQueueState, addProgressDelta } = createRuntime([
      requeueTask,
      failTask
    ]);

    const requeued = await runtime.reclaimExpiredBackgroundLease('task-requeue', 'runner-1');
    const failed = await runtime.reclaimExpiredBackgroundLease('task-fail', 'runner-1');

    expect(requeued).toEqual(
      expect.objectContaining({
        id: 'task-requeue',
        status: TaskStatus.QUEUED,
        currentNode: 'background_requeued',
        currentStep: 'queued',
        retryCount: 1,
        queueState: expect.objectContaining({
          status: 'queued',
          attempt: 2,
          leaseOwner: undefined
        }),
        budgetState: expect.objectContaining({
          retryBudget: 1,
          retriesConsumed: 1
        })
      })
    );
    expect(failed).toEqual(
      expect.objectContaining({
        id: 'task-fail',
        status: TaskStatus.FAILED,
        currentNode: 'background_reclaim_failed',
        currentStep: 'background_runner_failed',
        result: expect.stringContaining('retry budget'),
        queueState: expect.objectContaining({
          status: 'failed'
        }),
        budgetState: expect.objectContaining({
          retryBudget: 1,
          retriesConsumed: 2
        })
      })
    );
    expect(updateBudgetState).toHaveBeenCalledTimes(2);
    expect(transitionQueueState).toHaveBeenCalledWith(failTask, 'failed');
    expect(addProgressDelta).toHaveBeenCalledWith(requeueTask, '后台执行 lease 已过期，任务已重新入队等待重试。');
    expect(addProgressDelta).toHaveBeenCalledWith(failTask, '后台执行 lease 已过期，且已耗尽重试预算，任务终止。');

    vi.useRealTimers();
  });

  it('runs bootstrap first and skips pipeline for blocked or approval-waiting tasks', async () => {
    const queuedTask = createTask({ id: 'task-run', status: TaskStatus.QUEUED });
    const waitingTask = createTask({
      id: 'task-waiting',
      status: TaskStatus.QUEUED,
      bootstrapStatus: TaskStatus.WAITING_APPROVAL
    });
    const blockedTask = createTask({
      id: 'task-blocked',
      status: TaskStatus.QUEUED,
      bootstrapStatus: TaskStatus.BLOCKED
    });
    const { runtime, runBootstrapGraph, runTaskPipeline } = createRuntime([queuedTask, waitingTask, blockedTask]);

    await runtime.runBackgroundTask('task-run');
    await runtime.runBackgroundTask('task-waiting');
    await runtime.runBackgroundTask('task-blocked');

    expect(runBootstrapGraph).toHaveBeenCalledTimes(3);
    expect(runTaskPipeline).toHaveBeenCalledTimes(1);
    expect(runTaskPipeline).toHaveBeenCalledWith(
      queuedTask,
      { goal: queuedTask.goal, context: queuedTask.context, constraints: [] },
      { mode: 'initial' }
    );
  });

  it('resets state on retry, cancels tasks and deletes session state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T11:00:00.000Z'));

    const task = createTask({
      id: 'task-ops',
      status: TaskStatus.FAILED,
      sessionId: 'session-1',
      review: { decision: 'blocked' },
      result: 'failure',
      retryCount: 3,
      maxRetries: 3,
      pendingAction: { type: 'approval' },
      pendingApproval: { toolName: 'write_file' },
      queueState: {
        mode: 'foreground',
        backgroundRun: false,
        status: 'failed',
        enqueuedAt: '2026-04-01T10:00:00.000Z',
        startedAt: '2026-04-01T10:01:00.000Z',
        finishedAt: '2026-04-01T10:10:00.000Z',
        lastTransitionAt: '2026-04-01T10:10:00.000Z',
        attempt: 3
      }
    });
    const siblingTask = createTask({
      id: 'task-other',
      sessionId: 'session-1'
    });
    const outsiderTask = createTask({
      id: 'task-keep',
      sessionId: 'session-2'
    });
    const {
      runtime,
      tasks,
      pendingExecutions,
      cancelledTasks,
      persistAndEmitTask,
      persistRuntimeState,
      runTaskPipeline
    } = createRuntime([task, siblingTask, outsiderTask]);

    const retried = await runtime.retryTask('task-ops');

    expect(retried).toEqual(
      expect.objectContaining({
        status: TaskStatus.QUEUED,
        review: undefined,
        result: undefined,
        retryCount: 0,
        maxRetries: 1,
        currentStep: 'queued',
        queueState: expect.objectContaining({
          mode: 'foreground',
          backgroundRun: false,
          status: 'queued',
          attempt: 4
        })
      })
    );
    expect(runTaskPipeline).toHaveBeenCalledWith(task, { goal: task.goal, constraints: [] }, { mode: 'retry' });

    const cancelled = await runtime.cancelTask('task-ops', 'manual stop');

    expect(cancelled).toEqual(
      expect.objectContaining({
        status: TaskStatus.CANCELLED,
        currentNode: 'run_cancelled',
        currentStep: 'cancelled',
        result: '已终止当前执行：manual stop',
        pendingAction: undefined,
        pendingApproval: undefined
      })
    );
    expect(cancelledTasks.has('task-ops')).toBe(true);
    expect(pendingExecutions.has('task-ops')).toBe(false);

    await runtime.deleteSessionState('session-1');

    expect(tasks.has('task-ops')).toBe(false);
    expect(tasks.has('task-other')).toBe(false);
    expect(tasks.has('task-keep')).toBe(true);
    expect(persistAndEmitTask).toHaveBeenCalledTimes(2);
    expect(persistRuntimeState).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
