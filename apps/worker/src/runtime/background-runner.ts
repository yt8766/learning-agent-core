export interface WorkerBackgroundRunnerContext {
  enabled: boolean;
  orchestrator: any;
  runnerId: string;
  workerPoolSize: number;
  leaseTtlMs: number;
  heartbeatMs: number;
  pollMs: number;
  backgroundWorkerSlots: Map<string, { taskId: string; startedAt: string }>;
  isSweepInFlight: () => boolean;
  setSweepInFlight: (value: boolean) => void;
}

export function startBackgroundRunnerLoop(
  context: WorkerBackgroundRunnerContext,
  runTick: () => Promise<void>
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runTick();
  }, context.pollMs);
  void runTick();
  return timer;
}

export async function runBackgroundRunnerTick(context: WorkerBackgroundRunnerContext): Promise<void> {
  if (!context.enabled || context.isSweepInFlight()) {
    return;
  }
  context.setSweepInFlight(true);

  try {
    if (typeof context.orchestrator.sweepInterruptTimeouts === 'function') {
      await context.orchestrator.sweepInterruptTimeouts();
    }
    if (typeof context.orchestrator.scanLearningConflicts === 'function') {
      await context.orchestrator.scanLearningConflicts();
    }
    if (typeof context.orchestrator.processLearningQueue === 'function') {
      await context.orchestrator.processLearningQueue();
    }
    if (typeof context.orchestrator.processQueuedLearningJobs === 'function') {
      await context.orchestrator.processQueuedLearningJobs();
    }

    if (
      typeof context.orchestrator.listQueuedBackgroundTasks !== 'function' ||
      typeof context.orchestrator.listExpiredBackgroundLeases !== 'function'
    ) {
      return;
    }

    const expiredLeases = context.orchestrator.listExpiredBackgroundLeases();
    for (const task of expiredLeases) {
      await context.orchestrator.reclaimExpiredBackgroundLease(
        task.id,
        task.queueState?.leaseOwner ?? 'unknown-runner'
      );
    }

    const capacity = context.workerPoolSize - context.backgroundWorkerSlots.size;
    if (capacity <= 0) {
      return;
    }

    const queuedTasks = context.orchestrator.listQueuedBackgroundTasks();
    for (const nextTask of queuedTasks.slice(0, capacity)) {
      const leasedTask = await context.orchestrator.acquireBackgroundLease(
        nextTask.id,
        context.runnerId,
        context.leaseTtlMs
      );
      if (!leasedTask) {
        continue;
      }
      startBackgroundWorker(context, leasedTask.id);
    }
  } finally {
    context.setSweepInFlight(false);
  }
}

export function startBackgroundWorker(context: WorkerBackgroundRunnerContext, taskId: string): void {
  const slotId = allocateBackgroundWorkerSlot(context.backgroundWorkerSlots, context.workerPoolSize);
  if (!slotId) {
    return;
  }

  context.backgroundWorkerSlots.set(slotId, { taskId, startedAt: new Date().toISOString() });
  const heartbeatTimer = setInterval(() => {
    void context.orchestrator.heartbeatBackgroundLease(taskId, context.runnerId, context.leaseTtlMs);
  }, context.heartbeatMs);

  void (async () => {
    try {
      await context.orchestrator.runBackgroundTask(taskId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '后台 worker 执行异常终止。';
      await context.orchestrator.markBackgroundTaskRunnerFailure(taskId, reason);
    } finally {
      clearInterval(heartbeatTimer);
      await context.orchestrator.releaseBackgroundLease(taskId, context.runnerId);
      context.backgroundWorkerSlots.delete(slotId);
    }
  })();
}

function allocateBackgroundWorkerSlot(
  slots: Map<string, { taskId: string; startedAt: string }>,
  workerPoolSize: number
): string | undefined {
  for (let index = 1; index <= workerPoolSize; index += 1) {
    const slotId = `slot-${index}`;
    if (!slots.has(slotId)) {
      return slotId;
    }
  }
  return undefined;
}
