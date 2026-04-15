import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  startBackgroundWorker,
  type RuntimeBackgroundRunnerContext
} from '../../../src/runtime/helpers/runtime-background-runner';

function createContext(overrides: Partial<RuntimeBackgroundRunnerContext> = {}): RuntimeBackgroundRunnerContext {
  let sweepInFlight = false;
  return {
    enabled: true,
    orchestrator: {},
    runnerId: 'runner-1',
    workerPoolSize: 2,
    leaseTtlMs: 1000,
    heartbeatMs: 200,
    pollMs: 500,
    backgroundWorkerSlots: new Map(),
    isSweepInFlight: () => sweepInFlight,
    setSweepInFlight: (value: boolean) => {
      sweepInFlight = value;
    },
    ...overrides
  };
}

describe('runtime-background-runner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts runner loop, unrefs the timer, and triggers an immediate tick', async () => {
    vi.useFakeTimers();
    const runTick = vi.fn(async () => undefined);

    const timer = startBackgroundRunnerLoop(createContext({ pollMs: 300 }), runTick);

    expect(runTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(900);
    await vi.runOnlyPendingTimersAsync();
    expect(runTick).toHaveBeenCalledTimes(5);
    clearInterval(timer);
  });

  it('returns early when a sweep is already in flight', async () => {
    const setSweepInFlight = vi.fn();
    const context = createContext({
      isSweepInFlight: () => true,
      setSweepInFlight
    });

    await runBackgroundRunnerTick(context);

    expect(setSweepInFlight).not.toHaveBeenCalled();
  });

  it('sweeps leases, processes queue, and starts workers only when capacity is available', async () => {
    const reclaimExpiredBackgroundLease = vi.fn(async () => undefined);
    const acquireBackgroundLease = vi
      .fn()
      .mockResolvedValueOnce({ id: 'task-queued-1' })
      .mockResolvedValueOnce(undefined);
    const heartbeatBackgroundLease = vi.fn(async () => undefined);
    const runBackgroundTask = vi.fn(async () => undefined);
    const releaseBackgroundLease = vi.fn(async () => undefined);
    const context = createContext({
      orchestrator: {
        sweepInterruptTimeouts: vi.fn(async () => undefined),
        scanLearningConflicts: vi.fn(async () => undefined),
        processLearningQueue: vi.fn(async () => undefined),
        processQueuedLearningJobs: vi.fn(async () => undefined),
        listExpiredBackgroundLeases: vi.fn(() => [
          {
            id: 'expired-task',
            queueState: {
              leaseOwner: 'runner-stale'
            }
          }
        ]),
        reclaimExpiredBackgroundLease,
        listQueuedBackgroundTasks: vi.fn(() => [{ id: 'task-queued-1' }, { id: 'task-queued-2' }]),
        acquireBackgroundLease,
        heartbeatBackgroundLease,
        runBackgroundTask,
        markBackgroundTaskRunnerFailure: vi.fn(async () => undefined),
        releaseBackgroundLease
      }
    });

    await runBackgroundRunnerTick(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(reclaimExpiredBackgroundLease).toHaveBeenCalledWith('expired-task', 'runner-stale');
    expect(acquireBackgroundLease).toHaveBeenCalledWith('task-queued-1', 'runner-1', 1000);
    expect(acquireBackgroundLease).toHaveBeenCalledWith('task-queued-2', 'runner-1', 1000);
    expect(runBackgroundTask).toHaveBeenCalledWith('task-queued-1');
    expect(releaseBackgroundLease).toHaveBeenCalledWith('task-queued-1', 'runner-1');
    expect(context.backgroundWorkerSlots.size).toBe(0);
  });

  it('skips queue acquisition when orchestrator does not expose queue listing functions', async () => {
    const setSweepInFlight = vi.fn();
    const context = createContext({
      orchestrator: {
        sweepInterruptTimeouts: vi.fn(async () => undefined)
      },
      setSweepInFlight
    });

    await runBackgroundRunnerTick(context);

    expect(setSweepInFlight).toHaveBeenNthCalledWith(1, true);
    expect(setSweepInFlight).toHaveBeenLastCalledWith(false);
  });

  it('marks worker failures and releases the lease after cleanup', async () => {
    vi.useFakeTimers();
    const heartbeatBackgroundLease = vi.fn(async () => undefined);
    const markBackgroundTaskRunnerFailure = vi.fn(async () => undefined);
    const releaseBackgroundLease = vi.fn(async () => undefined);
    const context = createContext({
      workerPoolSize: 1,
      heartbeatMs: 100,
      orchestrator: {
        heartbeatBackgroundLease,
        runBackgroundTask: vi.fn(async () => {
          throw new Error('runner exploded');
        }),
        markBackgroundTaskRunnerFailure,
        releaseBackgroundLease
      }
    });

    startBackgroundWorker(context, 'task-failed');
    expect(context.backgroundWorkerSlots.get('slot-1')).toEqual(
      expect.objectContaining({
        taskId: 'task-failed'
      })
    );

    vi.advanceTimersByTime(100);
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(heartbeatBackgroundLease).toHaveBeenCalledWith('task-failed', 'runner-1', 1000);
    expect(markBackgroundTaskRunnerFailure).toHaveBeenCalledWith('task-failed', 'runner exploded');
    expect(releaseBackgroundLease).toHaveBeenCalledWith('task-failed', 'runner-1');
    expect(context.backgroundWorkerSlots.size).toBe(0);
  });

  it('does not start a worker when all slots are already occupied', () => {
    const runBackgroundTask = vi.fn(async () => undefined);
    const context = createContext({
      workerPoolSize: 1,
      backgroundWorkerSlots: new Map([
        [
          'slot-1',
          {
            taskId: 'occupied-task',
            startedAt: '2026-04-08T00:00:00.000Z'
          }
        ]
      ]),
      orchestrator: {
        runBackgroundTask
      }
    });

    startBackgroundWorker(context, 'task-new');

    expect(runBackgroundTask).not.toHaveBeenCalled();
    expect(context.backgroundWorkerSlots.get('slot-1')?.taskId).toBe('occupied-task');
  });
});
