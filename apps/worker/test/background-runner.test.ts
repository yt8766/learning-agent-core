import { describe, expect, it, vi } from 'vitest';

import { runBackgroundRunnerTick } from '../src/runtime/background-runner';

describe('worker background runner', () => {
  it('consumes queued learning jobs alongside task and learning queues', async () => {
    const orchestrator = {
      sweepInterruptTimeouts: vi.fn(async () => undefined),
      scanLearningConflicts: vi.fn(async () => undefined),
      processLearningQueue: vi.fn(async () => undefined),
      processQueuedLearningJobs: vi.fn(async () => undefined),
      listQueuedBackgroundTasks: vi.fn(() => []),
      listExpiredBackgroundLeases: vi.fn(() => [])
    };
    let inFlight = false;

    await runBackgroundRunnerTick({
      enabled: true,
      orchestrator,
      runnerId: 'worker-test',
      workerPoolSize: 1,
      leaseTtlMs: 1000,
      heartbeatMs: 1000,
      pollMs: 1000,
      backgroundWorkerSlots: new Map(),
      isSweepInFlight: () => inFlight,
      setSweepInFlight: value => {
        inFlight = value;
      }
    });

    expect(orchestrator.processQueuedLearningJobs).toHaveBeenCalledTimes(1);
    expect(orchestrator.processLearningQueue).toHaveBeenCalledTimes(1);
  });
});
