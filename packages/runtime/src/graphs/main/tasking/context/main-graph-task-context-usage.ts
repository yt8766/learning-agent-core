import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { createEmptyUsageRecord, estimateModelCostUsd, roundUsageCost } from './main-graph-task-context-helpers';

import type {
  InvocationUsageRecord,
  TaskUsageDelta
} from '../../../../runtime/model-invocation/model-invocation.types';

export interface RecordTaskUsageDeps {
  tasks: Map<string, TaskRecord>;
  updateBudgetState: (
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ) => NonNullable<TaskRecord['budgetState']>;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
}

interface UsageBudgetUpdate {
  tokenConsumed: number;
  costConsumedUsd: number;
  costConsumedCny: number;
}

interface TaskUsageBridgeState {
  projectedInvocationIds: Set<string>;
}

const taskUsageBridgeState = new WeakMap<TaskRecord, TaskUsageBridgeState>();

interface ApplyTaskUsageParams {
  task: TaskRecord;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model?: string;
    estimated?: boolean;
    costUsd?: number;
    costCny?: number;
  };
  budgetUpdate: UsageBudgetUpdate;
}

function getTaskUsageBridgeState(task: TaskRecord): TaskUsageBridgeState {
  const existing = taskUsageBridgeState.get(task);
  if (existing) {
    return existing;
  }

  const created: TaskUsageBridgeState = {
    projectedInvocationIds: new Set<string>()
  };
  taskUsageBridgeState.set(task, created);
  return created;
}

function hasAppliedInvocation(task: TaskRecord, invocationId?: string): boolean {
  return invocationId ? getTaskUsageBridgeState(task).projectedInvocationIds.has(invocationId) : false;
}

function markInvocationApplied(task: TaskRecord, invocationId?: string): void {
  if (!invocationId) {
    return;
  }
  getTaskUsageBridgeState(task).projectedInvocationIds.add(invocationId);
}

function shouldApplyBudgetSnapshot(task: TaskRecord, next: UsageBudgetUpdate): boolean {
  const currentTokenConsumed = task.budgetState?.tokenConsumed ?? 0;
  const currentCostConsumedUsd = task.budgetState?.costConsumedUsd ?? 0;
  const currentCostConsumedCny = task.budgetState?.costConsumedCny ?? 0;

  const isStaleOrInvalid =
    next.tokenConsumed < currentTokenConsumed ||
    next.costConsumedUsd < currentCostConsumedUsd ||
    next.costConsumedCny < currentCostConsumedCny;
  if (isStaleOrInvalid) {
    return false;
  }

  return (
    next.tokenConsumed > currentTokenConsumed ||
    next.costConsumedUsd > currentCostConsumedUsd ||
    next.costConsumedCny > currentCostConsumedCny
  );
}

function applyBudgetStateProjection(
  deps: RecordTaskUsageDeps,
  task: TaskRecord,
  budgetUpdate: UsageBudgetUpdate
): NonNullable<TaskRecord['budgetState']> {
  task.budgetState = deps.updateBudgetState(task, {
    tokenConsumed: budgetUpdate.tokenConsumed,
    costConsumedUsd: roundUsageCost(budgetUpdate.costConsumedUsd),
    costConsumedCny: roundUsageCost(budgetUpdate.costConsumedCny)
  });
  return task.budgetState;
}

function applyTaskUsage(deps: RecordTaskUsageDeps, { task, usage, budgetUpdate }: ApplyTaskUsageParams): void {
  const current = task.llmUsage ?? createEmptyUsageRecord(new Date().toISOString());
  const model = usage.model ?? 'unknown';
  const computedCostUsd = usage.costUsd ?? estimateModelCostUsd(model, usage.totalTokens);
  const computedCostCny = usage.costCny ?? computedCostUsd * 7.2;
  const pricingSource = usage.costUsd != null || usage.costCny != null ? 'provider' : 'estimated';
  const modelEntry = current.models.find(item => item.model === model);

  current.promptTokens += usage.promptTokens;
  current.completionTokens += usage.completionTokens;
  current.totalTokens += usage.totalTokens;
  if (usage.estimated) {
    current.estimatedCallCount += 1;
  } else {
    current.measuredCallCount += 1;
  }
  current.estimated = current.measuredCallCount === 0;
  current.updatedAt = new Date().toISOString();

  if (modelEntry) {
    modelEntry.promptTokens += usage.promptTokens;
    modelEntry.completionTokens += usage.completionTokens;
    modelEntry.totalTokens += usage.totalTokens;
    modelEntry.callCount += 1;
    modelEntry.costUsd = roundUsageCost((modelEntry.costUsd ?? 0) + computedCostUsd);
    modelEntry.costCny = roundUsageCost((modelEntry.costCny ?? 0) + computedCostCny);
    modelEntry.pricingSource =
      pricingSource === 'provider' || modelEntry.pricingSource === 'provider' ? 'provider' : 'estimated';
  } else {
    current.models.push({
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUsd: roundUsageCost(computedCostUsd),
      costCny: roundUsageCost(computedCostCny),
      pricingSource,
      callCount: 1
    });
  }

  task.llmUsage = {
    ...current,
    models: current.models.sort((left, right) => right.totalTokens - left.totalTokens)
  };
  const budgetState = applyBudgetStateProjection(deps, task, budgetUpdate);
  if (
    budgetState.budgetInterruptState?.status === 'soft-threshold-triggered' &&
    !task.activeInterrupt &&
    task.status === 'running'
  ) {
    // task.activeInterrupt and task.interruptHistory persist the 司礼监 / InterruptController budget stop.
    const now = new Date().toISOString();
    task.status = 'waiting_approval' as TaskRecord['status'];
    if (task.queueState) {
      task.queueState.status = 'waiting_approval';
      task.queueState.lastTransitionAt = now;
    }
    task.activeInterrupt = {
      id: `interrupt_${task.id}_budget_soft_limit`,
      status: 'pending',
      mode: 'blocking',
      source: 'graph',
      origin: 'budget',
      kind: 'user-input',
      interactionKind: 'supplemental-input',
      requestedBy: 'libu-governance',
      ownerType: 'ministry-owned',
      ownerId: 'libu-governance',
      reason: budgetState.budgetInterruptState?.reason,
      blockedReason: budgetState.budgetInterruptState?.reason,
      resumeStrategy: 'command',
      timeoutMinutes: 30,
      timeoutPolicy: 'cancel-task',
      payload: {
        stage: 'budget_governance',
        interactionKind: 'supplemental-input',
        tokenBudget: budgetState.tokenBudget,
        tokenConsumed: budgetState.tokenConsumed,
        costBudgetUsd: budgetState.costBudgetUsd,
        costConsumedUsd: budgetState.costConsumedUsd
      },
      createdAt: now
    };
    task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
    deps.addTrace(
      task,
      'budget_interrupt',
      budgetState.budgetInterruptState.reason ?? '预算接近阈值，已请求补充决策。',
      {
        interactionKind: 'supplemental-input',
        tokenBudget: budgetState.tokenBudget,
        tokenConsumed: budgetState.tokenConsumed,
        costBudgetUsd: budgetState.costBudgetUsd,
        costConsumedUsd: budgetState.costConsumedUsd
      }
    );
  }
  void deps.persistAndEmitTask(task);
}

export function recordTaskUsage(
  deps: RecordTaskUsageDeps,
  taskId: string,
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model?: string;
    estimated?: boolean;
    costUsd?: number;
    costCny?: number;
  }
): void {
  const task = deps.tasks.get(taskId);
  if (!task) {
    return;
  }

  const model = usage.model ?? 'unknown';
  const costUsd = usage.costUsd ?? estimateModelCostUsd(model, usage.totalTokens);
  const costCny = usage.costCny ?? costUsd * 7.2;

  applyTaskUsage(deps, {
    task,
    usage,
    budgetUpdate: {
      tokenConsumed: (task.budgetState?.tokenConsumed ?? 0) + usage.totalTokens,
      costConsumedUsd: (task.budgetState?.costConsumedUsd ?? 0) + costUsd,
      costConsumedCny: (task.budgetState?.costConsumedCny ?? 0) + costCny
    }
  });
}

export function recordTaskUsageFromInvocation(
  deps: RecordTaskUsageDeps,
  taskId: string,
  payload: {
    invocationUsageRecord?: InvocationUsageRecord;
    taskUsageDelta?: TaskUsageDelta;
  }
): void {
  const task = deps.tasks.get(taskId);
  const usageRecord = payload.invocationUsageRecord;
  const taskUsageDelta = payload.taskUsageDelta;
  if (!task) {
    return;
  }

  const invocationId = usageRecord?.invocationId ?? taskUsageDelta?.invocationId;
  if (hasAppliedInvocation(task, invocationId)) {
    return;
  }

  if (!usageRecord) {
    if (!taskUsageDelta) {
      return;
    }
    const budgetUpdate = {
      tokenConsumed: taskUsageDelta.totalTokenConsumed,
      costConsumedUsd: taskUsageDelta.totalCostConsumedUsd,
      costConsumedCny: taskUsageDelta.totalCostConsumedCny
    };
    if (!shouldApplyBudgetSnapshot(task, budgetUpdate)) {
      return;
    }
    applyBudgetStateProjection(deps, task, budgetUpdate);
    markInvocationApplied(task, invocationId);
    void deps.persistAndEmitTask(task);
    return;
  }

  const costUsd = usageRecord.costUsd ?? taskUsageDelta?.costUsdDelta ?? 0;
  const costCny = usageRecord.costCny ?? taskUsageDelta?.costCnyDelta ?? 0;
  const budgetUpdate = {
    tokenConsumed:
      taskUsageDelta?.totalTokenConsumed ?? (task.budgetState?.tokenConsumed ?? 0) + usageRecord.totalTokens,
    costConsumedUsd: taskUsageDelta?.totalCostConsumedUsd ?? (task.budgetState?.costConsumedUsd ?? 0) + costUsd,
    costConsumedCny: taskUsageDelta?.totalCostConsumedCny ?? (task.budgetState?.costConsumedCny ?? 0) + costCny
  };
  if (taskUsageDelta && !shouldApplyBudgetSnapshot(task, budgetUpdate)) {
    markInvocationApplied(task, invocationId);
    return;
  }

  applyTaskUsage(deps, {
    task,
    usage: {
      promptTokens: usageRecord.promptTokens,
      completionTokens: usageRecord.completionTokens,
      totalTokens: usageRecord.totalTokens,
      model: usageRecord.modelId,
      estimated: false,
      costUsd,
      costCny
    },
    budgetUpdate
  });
  markInvocationApplied(task, invocationId);
}
