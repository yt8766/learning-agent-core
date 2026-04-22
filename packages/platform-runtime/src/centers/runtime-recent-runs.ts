import type { TaskRecord } from '@agent/core';

import { normalizeExecutionMode } from '@agent/runtime';
import { resolveTaskExecutionMode, resolveTaskInteractionKind } from '@agent/runtime';

export function filterAndSortRecentRuntimeRuns(
  tasks: TaskRecord[],
  filters?: {
    status?: string;
    executionMode?: string;
    interactionKind?: string;
  }
) {
  return tasks
    .filter(task => !filters?.status || String(task.status) === filters.status)
    .filter(
      task =>
        !filters?.executionMode ||
        resolveTaskExecutionMode(task) === (normalizeExecutionMode(filters.executionMode) ?? filters.executionMode)
    )
    .filter(task => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind)
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 10);
}
