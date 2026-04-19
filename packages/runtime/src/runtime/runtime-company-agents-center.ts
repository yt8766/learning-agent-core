import type { TaskRecord } from '@agent/core';

interface CompanyWorkerRecord {
  id: string;
  kind?: string;
  requiredConnectors?: string[];
  [key: string]: unknown;
}

export function buildCompanyAgentsCenter(input: {
  tasks: TaskRecord[];
  workers: CompanyWorkerRecord[];
  disabledWorkerIds: Set<string>;
}) {
  return input.workers
    .filter(worker => worker.kind === 'company')
    .map(worker => {
      const relatedTasks = input.tasks
        .filter(task => task.currentWorker === worker.id || (task.usedCompanyWorkers ?? []).includes(worker.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const completedTasks = relatedTasks.filter(task =>
        ['completed', 'failed', 'cancelled'].includes(String(task.status))
      );
      const successfulTasks = completedTasks.filter(task => String(task.status) === 'completed');
      const successRate = completedTasks.length ? successfulTasks.length / completedTasks.length : undefined;

      return {
        ...worker,
        enabled: !input.disabledWorkerIds.has(worker.id),
        activeTaskCount: relatedTasks.filter(task =>
          ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
        ).length,
        totalTaskCount: relatedTasks.length,
        successRate,
        promotionState:
          successRate == null
            ? 'warming'
            : successRate >= 0.8
              ? 'validated'
              : successRate >= 0.5
                ? 'warming'
                : 'needs-review',
        sourceRuns: Array.from(new Set(relatedTasks.map(task => task.runId).filter(Boolean))),
        recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
        governanceStatus: input.disabledWorkerIds.has(worker.id)
          ? 'disabled'
          : worker.requiredConnectors?.length
            ? 'connector-bound'
            : 'ready'
      };
    });
}
