import type { RunBundleRecord } from '@agent/core';

import type { RuntimeCenterRecord } from '@/types/admin';
import type { TaskRecord } from '@/types/admin/tasking';
import { normalizeExecutionMode } from '@/utils/runtime-semantics';

type QueueExecutionModeFilter = 'all' | 'plan' | 'execute' | 'imperial_direct';
type QueueInteractionKindFilter =
  | 'all'
  | 'approval'
  | 'plan-question'
  | 'supplemental-input'
  | 'revise-required'
  | 'micro-loop-exhausted'
  | 'mode-transition';

export interface RuntimeQueueRunFilters {
  statusFilter: string;
  modelFilter: string;
  pricingSourceFilter: string;
  executionModeFilter: QueueExecutionModeFilter;
  interactionKindFilter: QueueInteractionKindFilter;
}

function resolveTaskInteractionKind(task: TaskRecord): string | undefined {
  const payload = task.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { interactionKind?: unknown }).interactionKind === 'string'
  ) {
    return (payload as { interactionKind: string }).interactionKind;
  }
  if (task.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  if (task.pendingApproval || task.activeInterrupt) {
    return 'approval';
  }
  return undefined;
}

function collectTaskModels(task: TaskRecord): string[] {
  const collected = new Set<string>();

  for (const model of task.llmUsage?.models ?? []) {
    if (model.model) {
      collected.add(model.model);
    }
  }

  for (const route of task.modelRoute ?? []) {
    if (route.selectedModel) {
      collected.add(route.selectedModel);
    }
    if (route.defaultModel) {
      collected.add(route.defaultModel);
    }
  }

  for (const trace of task.trace ?? []) {
    if (trace.modelUsed) {
      collected.add(trace.modelUsed);
    }
  }

  return [...collected];
}

function collectTaskPricingSources(task: TaskRecord): string[] {
  const collected = new Set<string>();
  for (const model of task.llmUsage?.models ?? []) {
    if (model.pricingSource) {
      collected.add(model.pricingSource);
    }
  }
  return [...collected];
}

function matchesTaskLevelFilters(task: TaskRecord, filters: RuntimeQueueRunFilters) {
  if (filters.statusFilter && task.status !== filters.statusFilter) {
    return false;
  }

  if (filters.executionModeFilter !== 'all') {
    const executionMode = normalizeExecutionMode(task.executionMode);
    if (executionMode !== filters.executionModeFilter) {
      return false;
    }
  }

  if (filters.interactionKindFilter !== 'all') {
    if (resolveTaskInteractionKind(task) !== filters.interactionKindFilter) {
      return false;
    }
  }

  if (filters.modelFilter) {
    const models = collectTaskModels(task);
    if (!models.includes(filters.modelFilter)) {
      return false;
    }
  }

  if (filters.pricingSourceFilter) {
    const pricingSources = collectTaskPricingSources(task);
    if (!pricingSources.includes(filters.pricingSourceFilter)) {
      return false;
    }
  }

  return true;
}

export function buildFallbackRunsFromRuntime(
  runtime: Pick<RuntimeCenterRecord, 'recentRuns'>,
  filters: RuntimeQueueRunFilters
): RunBundleRecord['run'][] {
  return runtime.recentRuns
    .filter(task => matchesTaskLevelFilters(task, filters))
    .map(task => ({
      taskId: task.id,
      goal: task.goal,
      status: task.status as RunBundleRecord['run']['status'],
      startedAt: task.createdAt,
      endedAt: ['completed', 'failed', 'cancelled'].includes(task.status) ? task.updatedAt : undefined,
      executionMode: normalizeExecutionMode(task.executionMode),
      interactionKind: resolveTaskInteractionKind(task) as RunBundleRecord['run']['interactionKind'],
      currentStage: undefined,
      currentStep: task.currentStep,
      currentNode: task.currentNode,
      currentMinistry: task.currentMinistry,
      currentWorker: task.currentWorker,
      workflow: task.resolvedWorkflow,
      subgraphTrail: task.subgraphTrail,
      modelRoute: task.modelRoute,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      hasInterrupt: false,
      hasFallback: false,
      hasRecoverableCheckpoint: false,
      hasEvidenceWarning: false,
      diagnosticFlags: []
    }));
}

export function filterObservabilityRunsWithRuntimeTasks(
  runs: RunBundleRecord['run'][],
  runtime: Pick<RuntimeCenterRecord, 'recentRuns'>,
  filters: RuntimeQueueRunFilters
): RunBundleRecord['run'][] {
  const taskById = new Map(runtime.recentRuns.map(task => [task.id, task]));

  return runs.filter(run => {
    if (filters.statusFilter && run.status !== filters.statusFilter) {
      return false;
    }

    if (filters.executionModeFilter !== 'all') {
      const executionMode = run.executionMode ?? normalizeExecutionMode(taskById.get(run.taskId)?.executionMode);
      if (executionMode !== filters.executionModeFilter) {
        return false;
      }
    }

    if (filters.interactionKindFilter !== 'all') {
      const interactionKind = run.interactionKind ?? resolveTaskInteractionKind(taskById.get(run.taskId) as TaskRecord);
      if (interactionKind !== filters.interactionKindFilter) {
        return false;
      }
    }

    if (!filters.modelFilter && !filters.pricingSourceFilter) {
      return true;
    }

    const task = taskById.get(run.taskId);
    if (!task) {
      return false;
    }

    return matchesTaskLevelFilters(task, {
      ...filters,
      statusFilter: '',
      executionModeFilter: 'all',
      interactionKindFilter: 'all'
    });
  });
}
