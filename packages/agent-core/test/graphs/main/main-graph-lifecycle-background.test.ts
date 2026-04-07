import { describe, expect, it, vi } from 'vitest';

import {
  acquireLifecycleBackgroundLease,
  cancelLifecycleTask,
  deleteLifecycleSessionState,
  heartbeatLifecycleBackgroundLease,
  isLifecycleWorkerEnabled,
  listExpiredLifecycleBackgroundLeases,
  listLifecycleTaskTraces,
  listLifecycleWorkers,
  listQueuedLifecycleBackgroundTasks,
  markLifecycleBackgroundTaskRunnerFailure,
  reclaimExpiredLifecycleBackgroundLease,
  registerLifecycleWorker,
  releaseLifecycleBackgroundLease,
  retryLifecycleTask,
  runLifecycleBackgroundTask,
  setLifecycleWorkerEnabled
} from '../../../src/graphs/main/lifecycle/main-graph-lifecycle-background';

describe('main-graph lifecycle background helpers', () => {
  it('delegates worker registry operations', () => {
    const list = vi.fn(() => [{ id: 'worker-1' }]);
    const register = vi.fn();
    const setEnabled = vi.fn();
    const isEnabled = vi.fn(() => true);
    const workerRegistry = {
      list,
      register,
      setEnabled,
      isEnabled
    } as any;

    expect(listLifecycleWorkers(workerRegistry)).toEqual([{ id: 'worker-1' }]);

    const worker = { id: 'worker-2', name: 'Background Worker' };
    registerLifecycleWorker(workerRegistry, worker as any);
    setLifecycleWorkerEnabled(workerRegistry, 'worker-2', false);

    expect(register).toHaveBeenCalledWith(worker);
    expect(setEnabled).toHaveBeenCalledWith('worker-2', false);
    expect(isLifecycleWorkerEnabled(workerRegistry, 'worker-2')).toBe(true);
    expect(isEnabled).toHaveBeenCalledWith('worker-2');
  });

  it('lists queued tasks, expired leases and task traces through the runtime', () => {
    const listQueuedBackgroundTasks = vi.fn(() => [{ id: 'task-queued' }]);
    const listExpiredBackgroundLeases = vi.fn(() => [{ id: 'task-expired' }]);
    const backgroundRuntime = {
      listQueuedBackgroundTasks,
      listExpiredBackgroundLeases
    } as any;
    const listTasks = vi.fn(() => [{ id: 'task-queued' }, { id: 'task-expired' }]);
    const tasks = new Map([
      ['task-1', { id: 'task-1', trace: [{ node: 'planner', summary: 'queued' }] }],
      ['task-2', { id: 'task-2' }]
    ]) as any;

    expect(listQueuedLifecycleBackgroundTasks(backgroundRuntime, listTasks)).toEqual([{ id: 'task-queued' }]);
    expect(listQueuedBackgroundTasks).toHaveBeenCalledWith(listTasks);

    expect(listExpiredLifecycleBackgroundLeases(backgroundRuntime, listTasks)).toEqual([{ id: 'task-expired' }]);
    expect(listExpiredBackgroundLeases).toHaveBeenCalledWith(listTasks);

    expect(listLifecycleTaskTraces(tasks, 'task-1')).toEqual([{ node: 'planner', summary: 'queued' }]);
    expect(listLifecycleTaskTraces(tasks, 'missing')).toEqual([]);
  });

  it('initializes before delegating mutating runtime operations', async () => {
    const initialize = vi.fn(async () => undefined);
    const backgroundRuntime = {
      acquireBackgroundLease: vi.fn(async () => ({ id: 'task-1', leaseOwner: 'runner-a' })),
      heartbeatBackgroundLease: vi.fn(async () => ({ id: 'task-1', heartbeat: true })),
      releaseBackgroundLease: vi.fn(async () => ({ id: 'task-1', released: true })),
      reclaimExpiredBackgroundLease: vi.fn(async () => ({ id: 'task-1', reclaimed: true })),
      runBackgroundTask: vi.fn(async () => ({ id: 'task-1', status: 'running' })),
      markBackgroundTaskRunnerFailure: vi.fn(async () => ({ id: 'task-1', status: 'failed' })),
      retryTask: vi.fn(async () => ({ id: 'task-1', status: 'queued' })),
      cancelTask: vi.fn(async () => ({ id: 'task-1', status: 'cancelled' })),
      deleteSessionState: vi.fn(async () => undefined)
    } as any;
    const deps = {
      workerRegistry: {} as any,
      backgroundRuntime,
      listTasks: vi.fn(() => []),
      initialize
    };

    await expect(acquireLifecycleBackgroundLease(deps as any, 'task-1', 'runner-a', 30_000)).resolves.toEqual({
      id: 'task-1',
      leaseOwner: 'runner-a'
    });
    await expect(heartbeatLifecycleBackgroundLease(deps as any, 'task-1', 'runner-a', 30_000)).resolves.toEqual({
      id: 'task-1',
      heartbeat: true
    });
    await expect(releaseLifecycleBackgroundLease(deps as any, 'task-1', 'runner-a')).resolves.toEqual({
      id: 'task-1',
      released: true
    });
    await expect(reclaimExpiredLifecycleBackgroundLease(deps as any, 'task-1', 'runner-a')).resolves.toEqual({
      id: 'task-1',
      reclaimed: true
    });
    await expect(runLifecycleBackgroundTask(deps as any, 'task-1')).resolves.toEqual({
      id: 'task-1',
      status: 'running'
    });
    await expect(markLifecycleBackgroundTaskRunnerFailure(deps as any, 'task-1', 'runner crashed')).resolves.toEqual({
      id: 'task-1',
      status: 'failed'
    });
    await expect(retryLifecycleTask(deps as any, 'task-1')).resolves.toEqual({
      id: 'task-1',
      status: 'queued'
    });
    await expect(cancelLifecycleTask(deps as any, 'task-1', 'manual stop')).resolves.toEqual({
      id: 'task-1',
      status: 'cancelled'
    });

    await deleteLifecycleSessionState(deps as any, 'session-1');

    expect(initialize).toHaveBeenCalledTimes(9);
    expect(backgroundRuntime.acquireBackgroundLease).toHaveBeenCalledWith('task-1', 'runner-a', 30_000);
    expect(backgroundRuntime.heartbeatBackgroundLease).toHaveBeenCalledWith('task-1', 'runner-a', 30_000);
    expect(backgroundRuntime.releaseBackgroundLease).toHaveBeenCalledWith('task-1', 'runner-a');
    expect(backgroundRuntime.reclaimExpiredBackgroundLease).toHaveBeenCalledWith('task-1', 'runner-a');
    expect(backgroundRuntime.runBackgroundTask).toHaveBeenCalledWith('task-1');
    expect(backgroundRuntime.markBackgroundTaskRunnerFailure).toHaveBeenCalledWith('task-1', 'runner crashed');
    expect(backgroundRuntime.retryTask).toHaveBeenCalledWith('task-1');
    expect(backgroundRuntime.cancelTask).toHaveBeenCalledWith('task-1', 'manual stop');
    expect(backgroundRuntime.deleteSessionState).toHaveBeenCalledWith('session-1');
  });
});
