import type { TaskRecord } from '@agent/core';

import { normalizeExecutionMode } from '../runtime/runtime-architecture-helpers';
import { matchesRunObservatoryTaskFilters } from './runtime-observability-task-filters';
import { resolveTaskExecutionMode, resolveTaskInteractionKind } from './runtime-observability-filters';

export function parseRunObservatoryLimit(limit?: string | number) {
  if (typeof limit === 'number') {
    return Math.max(1, Math.floor(limit));
  }
  if (typeof limit === 'string' && limit.trim()) {
    return Math.max(1, Math.floor(Number(limit)));
  }
  return undefined;
}

export function filterAndSortRunObservatoryTasks(
  tasks: TaskRecord[],
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
    q?: string;
  }
) {
  const normalizedExecutionMode = normalizeExecutionMode(filters?.executionMode) ?? filters?.executionMode;

  return tasks
    .filter(task => !filters?.status || String(task.status) === filters.status)
    .filter(task => matchesRunObservatoryTaskFilters(task, filters))
    .filter(task => !normalizedExecutionMode || resolveTaskExecutionMode(task) === normalizedExecutionMode)
    .filter(task => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind)
    .filter(task => {
      if (!filters?.q) {
        return true;
      }
      const q = filters.q.toLowerCase();
      return String(task.goal ?? '').toLowerCase().includes(q) || String(task.id ?? '').toLowerCase().includes(q);
    })
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function filterAndSortRunObservatoryRuns<
  TRun extends {
    hasInterrupt?: boolean;
    hasFallback?: boolean;
    hasRecoverableCheckpoint?: boolean;
    startedAt?: string;
  }
>(
  runs: TRun[],
  filters?: {
    hasInterrupt?: string;
    hasFallback?: string;
    hasRecoverableCheckpoint?: string;
  },
  limit?: number
) {
  return runs
    .filter(run => (filters?.hasInterrupt ? String(run.hasInterrupt) === filters.hasInterrupt : true))
    .filter(run => (filters?.hasFallback ? String(run.hasFallback) === filters.hasFallback : true))
    .filter(run =>
      filters?.hasRecoverableCheckpoint
        ? String(run.hasRecoverableCheckpoint) === filters.hasRecoverableCheckpoint
        : true
    )
    .slice()
    .sort((left, right) => new Date(right.startedAt ?? 0).getTime() - new Date(left.startedAt ?? 0).getTime())
    .slice(0, Number.isFinite(limit) ? limit : undefined);
}
