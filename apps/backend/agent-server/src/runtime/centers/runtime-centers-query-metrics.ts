import {
  readPersistedEvalHistory,
  readPersistedUsageAnalytics,
  summarizeAndPersistEvalHistory,
  summarizeAndPersistUsageAnalytics
} from '@agent/runtime';
import type { RuntimeCentersContext } from './runtime-centers.types';

type RuntimeMetricsTasks = Parameters<typeof summarizeAndPersistUsageAnalytics>[0]['tasks'];

export async function loadRuntimeUsageAnalytics(
  ctx: RuntimeCentersContext,
  tasks: RuntimeMetricsTasks,
  days: number,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
    metricsMode?: 'live' | 'snapshot-preferred';
  }
) {
  if (filters?.metricsMode === 'snapshot-preferred') {
    const persisted = await readPersistedUsageAnalytics({
      runtimeStateRepository: ctx.runtimeStateRepository,
      tasks,
      days,
      filters
    });
    if (hasPersistedUsageSnapshot(persisted, tasks)) {
      return persisted;
    }
  }

  return summarizeAndPersistUsageAnalytics({
    runtimeStateRepository: ctx.runtimeStateRepository,
    tasks,
    days,
    filters,
    fetchProviderUsageAudit: (auditDays: number) => ctx.fetchProviderUsageAudit(auditDays)
  });
}

export async function loadEvalsCenterMetrics(
  ctx: RuntimeCentersContext,
  days: number,
  filters?: { scenarioId?: string; outcome?: string; metricsMode?: 'live' | 'snapshot-preferred' }
) {
  const tasks = ctx.orchestrator.listTasks();
  if (filters?.metricsMode === 'snapshot-preferred') {
    const persisted = await readPersistedEvalHistory({
      runtimeStateRepository: ctx.runtimeStateRepository,
      tasks,
      days,
      filters
    });
    if (hasPersistedEvalSnapshot(persisted, tasks)) {
      return persisted;
    }
  }

  return summarizeAndPersistEvalHistory({
    runtimeStateRepository: ctx.runtimeStateRepository,
    tasks,
    days,
    filters
  });
}

function hasPersistedUsageSnapshot(
  persisted: Awaited<ReturnType<typeof readPersistedUsageAnalytics>>,
  tasks: RuntimeMetricsTasks
) {
  if ((persisted.persistedDailyHistory?.length ?? 0) > 0) {
    return true;
  }
  if ((persisted.recentUsageAudit?.length ?? 0) > 0) {
    return true;
  }
  return tasks.length === 0;
}

function hasPersistedEvalSnapshot(
  persisted: Awaited<ReturnType<typeof readPersistedEvalHistory>>,
  tasks: RuntimeMetricsTasks
) {
  if ((persisted.persistedDailyHistory?.length ?? 0) > 0) {
    return true;
  }
  return tasks.length === 0;
}
