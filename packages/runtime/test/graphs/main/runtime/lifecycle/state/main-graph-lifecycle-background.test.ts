import { describe, expect, it, vi } from 'vitest';

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
  retryLifecycleTask,
  cancelLifecycleTask,
  deleteLifecycleSessionState,
  listLifecycleTaskTraces
} from '../../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-background';

function makeWorkerRegistry(overrides: Record<string, any> = {}) {
  return {
    list: vi.fn().mockReturnValue([{ id: 'w1', displayName: 'Worker 1' }]),
    register: vi.fn(),
    setEnabled: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
    ...overrides
  } as any;
}

function makeBackgroundRuntime(overrides: Record<string, any> = {}) {
  return {
    listQueuedBackgroundTasks: vi.fn().mockReturnValue([]),
    acquireBackgroundLease: vi.fn().mockResolvedValue({ id: 'task-1' }),
    heartbeatBackgroundLease: vi.fn().mockResolvedValue({ id: 'task-1' }),
    releaseBackgroundLease: vi.fn().mockResolvedValue({ id: 'task-1' }),
    listExpiredBackgroundLeases: vi.fn().mockReturnValue([]),
    reclaimExpiredBackgroundLease: vi.fn().mockResolvedValue({ id: 'task-1' }),
    runBackgroundTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
    markBackgroundTaskRunnerFailure: vi.fn().mockResolvedValue({ id: 'task-1' }),
    retryTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
    cancelTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
    deleteSessionState: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as any;
}

function makeDeps(overrides: Record<string, any> = {}) {
  return {
    workerRegistry: makeWorkerRegistry(),
    backgroundRuntime: makeBackgroundRuntime(),
    listTasks: () => [],
    initialize: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as any;
}

describe('main-graph-lifecycle-background', () => {
  describe('listLifecycleWorkers', () => {
    it('delegates to workerRegistry.list', () => {
      const registry = makeWorkerRegistry();
      const result = listLifecycleWorkers(registry);
      expect(registry.list).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'w1', displayName: 'Worker 1' }]);
    });
  });

  describe('registerLifecycleWorker', () => {
    it('delegates to workerRegistry.register', () => {
      const registry = makeWorkerRegistry();
      const worker = { id: 'w2', displayName: 'Worker 2' };
      registerLifecycleWorker(registry, worker as any);
      expect(registry.register).toHaveBeenCalledWith(worker);
    });
  });

  describe('setLifecycleWorkerEnabled', () => {
    it('delegates to workerRegistry.setEnabled', () => {
      const registry = makeWorkerRegistry();
      setLifecycleWorkerEnabled(registry, 'w1', false);
      expect(registry.setEnabled).toHaveBeenCalledWith('w1', false);
    });
  });

  describe('isLifecycleWorkerEnabled', () => {
    it('delegates to workerRegistry.isEnabled', () => {
      const registry = makeWorkerRegistry({ isEnabled: vi.fn().mockReturnValue(false) });
      expect(isLifecycleWorkerEnabled(registry, 'w1')).toBe(false);
      expect(registry.isEnabled).toHaveBeenCalledWith('w1');
    });
  });

  describe('listQueuedLifecycleBackgroundTasks', () => {
    it('delegates to backgroundRuntime.listQueuedBackgroundTasks', () => {
      const runtime = makeBackgroundRuntime();
      const listTasks = () => [{ id: 't1' }];
      listQueuedLifecycleBackgroundTasks(runtime, listTasks);
      expect(runtime.listQueuedBackgroundTasks).toHaveBeenCalledWith(listTasks);
    });
  });

  describe('acquireLifecycleBackgroundLease', () => {
    it('initializes and delegates to backgroundRuntime.acquireBackgroundLease', async () => {
      const deps = makeDeps();
      const result = await acquireLifecycleBackgroundLease(deps, 'task-1', 'owner-1', 60000);
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.acquireBackgroundLease).toHaveBeenCalledWith('task-1', 'owner-1', 60000);
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('heartbeatLifecycleBackgroundLease', () => {
    it('initializes and delegates to backgroundRuntime.heartbeatBackgroundLease', async () => {
      const deps = makeDeps();
      const result = await heartbeatLifecycleBackgroundLease(deps, 'task-1', 'owner-1', 60000);
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.heartbeatBackgroundLease).toHaveBeenCalledWith('task-1', 'owner-1', 60000);
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('releaseLifecycleBackgroundLease', () => {
    it('initializes and delegates to backgroundRuntime.releaseBackgroundLease', async () => {
      const deps = makeDeps();
      const result = await releaseLifecycleBackgroundLease(deps, 'task-1', 'owner-1');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.releaseBackgroundLease).toHaveBeenCalledWith('task-1', 'owner-1');
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('listExpiredLifecycleBackgroundLeases', () => {
    it('delegates to backgroundRuntime.listExpiredBackgroundLeases', () => {
      const runtime = makeBackgroundRuntime();
      const listTasks = () => [];
      listExpiredLifecycleBackgroundLeases(runtime, listTasks);
      expect(runtime.listExpiredBackgroundLeases).toHaveBeenCalledWith(listTasks);
    });
  });

  describe('reclaimExpiredLifecycleBackgroundLease', () => {
    it('initializes and delegates', async () => {
      const deps = makeDeps();
      const result = await reclaimExpiredLifecycleBackgroundLease(deps, 'task-1', 'owner-1');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.reclaimExpiredBackgroundLease).toHaveBeenCalledWith('task-1', 'owner-1');
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('runLifecycleBackgroundTask', () => {
    it('initializes and delegates', async () => {
      const deps = makeDeps();
      const result = await runLifecycleBackgroundTask(deps, 'task-1');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.runBackgroundTask).toHaveBeenCalledWith('task-1');
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('markLifecycleBackgroundTaskRunnerFailure', () => {
    it('initializes and delegates', async () => {
      const deps = makeDeps();
      const result = await markLifecycleBackgroundTaskRunnerFailure(deps, 'task-1', 'crashed');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.markBackgroundTaskRunnerFailure).toHaveBeenCalledWith('task-1', 'crashed');
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('retryLifecycleTask', () => {
    it('initializes and delegates', async () => {
      const deps = makeDeps();
      const result = await retryLifecycleTask(deps, 'task-1');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.retryTask).toHaveBeenCalledWith('task-1');
      expect(result).toEqual({ id: 'task-1' });
    });
  });

  describe('cancelLifecycleTask', () => {
    it('initializes and delegates with reason', async () => {
      const deps = makeDeps();
      const result = await cancelLifecycleTask(deps, 'task-1', 'user-cancelled');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.cancelTask).toHaveBeenCalledWith('task-1', 'user-cancelled');
      expect(result).toEqual({ id: 'task-1' });
    });

    it('initializes and delegates without reason', async () => {
      const deps = makeDeps();
      await cancelLifecycleTask(deps, 'task-1');
      expect(deps.backgroundRuntime.cancelTask).toHaveBeenCalledWith('task-1', undefined);
    });
  });

  describe('deleteLifecycleSessionState', () => {
    it('initializes and delegates', async () => {
      const deps = makeDeps();
      await deleteLifecycleSessionState(deps, 'session-1');
      expect(deps.initialize).toHaveBeenCalled();
      expect(deps.backgroundRuntime.deleteSessionState).toHaveBeenCalledWith('session-1');
    });
  });

  describe('listLifecycleTaskTraces', () => {
    it('returns traces for an existing task', () => {
      const traces = [{ node: 'test', summary: 'test' }];
      const tasks = new Map([['task-1', { trace: traces } as any]]);
      expect(listLifecycleTaskTraces(tasks, 'task-1')).toEqual(traces);
    });

    it('returns empty array for missing task', () => {
      const tasks = new Map<string, any>();
      expect(listLifecycleTaskTraces(tasks, 'missing')).toEqual([]);
    });
  });
});
