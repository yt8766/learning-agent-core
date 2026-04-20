import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { createEmptyUsageRecord, estimateModelCostUsd, roundUsageCost } from './main-graph-task-context-helpers';

export interface RecordTaskUsageDeps {
  tasks: Map<string, TaskRecord>;
  updateBudgetState: (
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ) => NonNullable<TaskRecord['budgetState']>;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
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

  const current = task.llmUsage ?? createEmptyUsageRecord(new Date().toISOString());
  const model = usage.model ?? 'unknown';
  const costUsd = usage.costUsd ?? estimateModelCostUsd(model, usage.totalTokens);
  const costCny = usage.costCny ?? costUsd * 7.2;
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
    modelEntry.costUsd = roundUsageCost((modelEntry.costUsd ?? 0) + costUsd);
    modelEntry.costCny = roundUsageCost((modelEntry.costCny ?? 0) + costCny);
    modelEntry.pricingSource =
      pricingSource === 'provider' || modelEntry.pricingSource === 'provider' ? 'provider' : 'estimated';
  } else {
    current.models.push({
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUsd: roundUsageCost(costUsd),
      costCny: roundUsageCost(costCny),
      pricingSource,
      callCount: 1
    });
  }

  task.llmUsage = {
    ...current,
    models: current.models.sort((left, right) => right.totalTokens - left.totalTokens)
  };
  task.budgetState = deps.updateBudgetState(task, {
    tokenConsumed: (task.budgetState?.tokenConsumed ?? 0) + usage.totalTokens,
    costConsumedUsd: roundUsageCost((task.budgetState?.costConsumedUsd ?? 0) + costUsd),
    costConsumedCny: roundUsageCost((task.budgetState?.costConsumedCny ?? 0) + costCny)
  });
  if (
    task.budgetState.budgetInterruptState?.status === 'soft-threshold-triggered' &&
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
      reason: task.budgetState.budgetInterruptState.reason,
      blockedReason: task.budgetState.budgetInterruptState.reason,
      resumeStrategy: 'command',
      timeoutMinutes: 30,
      timeoutPolicy: 'cancel-task',
      payload: {
        stage: 'budget_governance',
        interactionKind: 'supplemental-input',
        tokenBudget: task.budgetState.tokenBudget,
        tokenConsumed: task.budgetState.tokenConsumed,
        costBudgetUsd: task.budgetState.costBudgetUsd,
        costConsumedUsd: task.budgetState.costConsumedUsd
      },
      createdAt: now
    };
    task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
    deps.addTrace(
      task,
      'budget_interrupt',
      task.budgetState.budgetInterruptState.reason ?? '预算接近阈值，已请求补充决策。',
      {
        interactionKind: 'supplemental-input',
        tokenBudget: task.budgetState.tokenBudget,
        tokenConsumed: task.budgetState.tokenConsumed,
        costBudgetUsd: task.budgetState.costBudgetUsd,
        costConsumedUsd: task.budgetState.costConsumedUsd
      }
    );
  }
  void deps.persistAndEmitTask(task);
}
