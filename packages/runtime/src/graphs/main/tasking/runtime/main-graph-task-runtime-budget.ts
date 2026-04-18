import type { QueueStateRecord } from '@agent/core';

import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { TaskBudgetExceededError } from './main-graph-task-runtime-errors';

export function updateTaskBudgetState(
  task: TaskRecord,
  settings: {
    policy?: {
      budget?: {
        stepBudget?: number;
        retryBudget?: number;
        sourceBudget?: number;
        maxCostPerTaskUsd?: number;
        fallbackModelId?: string;
      };
    };
  },
  overrides: Partial<NonNullable<TaskRecord['budgetState']>>
): NonNullable<TaskRecord['budgetState']> {
  const nextBudget = {
    stepBudget: task.budgetState?.stepBudget ?? settings.policy?.budget?.stepBudget ?? 8,
    stepsConsumed: task.budgetState?.stepsConsumed ?? 0,
    retryBudget: task.budgetState?.retryBudget ?? settings.policy?.budget?.retryBudget ?? 1,
    retriesConsumed: task.budgetState?.retriesConsumed ?? 0,
    sourceBudget: task.budgetState?.sourceBudget ?? settings.policy?.budget?.sourceBudget ?? 8,
    sourcesConsumed: task.budgetState?.sourcesConsumed ?? 0,
    tokenBudget: task.budgetState?.tokenBudget ?? 10000,
    tokenConsumed: task.budgetState?.tokenConsumed ?? 0,
    costBudgetUsd: task.budgetState?.costBudgetUsd ?? settings.policy?.budget?.maxCostPerTaskUsd ?? 0,
    costConsumedUsd: task.budgetState?.costConsumedUsd ?? 0,
    costConsumedCny: task.budgetState?.costConsumedCny ?? 0,
    softBudgetThreshold: task.budgetState?.softBudgetThreshold ?? 0.8,
    hardBudgetThreshold: task.budgetState?.hardBudgetThreshold ?? 1,
    budgetInterruptState: task.budgetState?.budgetInterruptState ?? { status: 'idle' as const },
    fallbackModelId: task.budgetState?.fallbackModelId ?? settings.policy?.budget?.fallbackModelId,
    overBudget: task.budgetState?.overBudget ?? false,
    ...overrides
  };
  const tokenBudget = nextBudget.tokenBudget ?? Number.POSITIVE_INFINITY;
  const costBudget = nextBudget.costBudgetUsd ?? Number.POSITIVE_INFINITY;
  const tokenRatio = tokenBudget > 0 ? (nextBudget.tokenConsumed ?? 0) / tokenBudget : 0;
  const costRatio = costBudget > 0 ? (nextBudget.costConsumedUsd ?? 0) / costBudget : 0;
  const budgetRatio = Math.max(tokenRatio, costRatio);
  if (budgetRatio >= (nextBudget.hardBudgetThreshold ?? 1)) {
    nextBudget.budgetInterruptState = {
      status: 'hard-threshold-triggered',
      interactionKind: 'supplemental-input',
      triggeredAt: new Date().toISOString(),
      reason: '成本超限，请简化问题或提高预算。'
    };
  } else if (
    budgetRatio >= (nextBudget.softBudgetThreshold ?? 0.8) &&
    nextBudget.budgetInterruptState?.status !== 'soft-threshold-triggered'
  ) {
    nextBudget.budgetInterruptState = {
      status: 'soft-threshold-triggered',
      interactionKind: 'supplemental-input',
      triggeredAt: new Date().toISOString(),
      reason: '当前任务已接近预算阈值，建议缩小范围或确认是否继续。'
    };
  }
  nextBudget.overBudget =
    nextBudget.overBudget ||
    (nextBudget.costConsumedUsd ?? 0) >= (nextBudget.costBudgetUsd ?? Number.POSITIVE_INFINITY);
  task.budgetGateState = {
    node: 'budget_gate',
    status:
      nextBudget.budgetInterruptState?.status === 'hard-threshold-triggered'
        ? 'hard_blocked'
        : nextBudget.budgetInterruptState?.status === 'soft-threshold-triggered'
          ? 'soft_blocked'
          : task.queueState?.status === 'queued'
            ? 'throttled'
            : 'open',
    summary:
      nextBudget.budgetInterruptState?.reason ??
      (task.queueState?.status === 'queued' ? '预算门当前按队列节流等待执行。' : '预算门已放行当前任务继续执行。'),
    queueDepth: task.queueState?.status === 'queued' ? 1 : 0,
    rateLimitKey: task.sessionId ?? task.id,
    triggeredAt:
      nextBudget.budgetInterruptState?.status === 'idle' ? undefined : nextBudget.budgetInterruptState?.triggeredAt,
    updatedAt: new Date().toISOString()
  };
  return nextBudget;
}

export function estimateRuntimeStepsConsumed(currentStep?: string): number {
  switch (currentStep) {
    case 'manager_plan':
      return 1;
    case 'research':
      return 2;
    case 'execute':
      return 3;
    case 'review':
      return 4;
    default:
      return 0;
  }
}

export function createTaskQueueState(sessionId: string | undefined, now: string): QueueStateRecord {
  return {
    mode: sessionId ? 'foreground' : 'background',
    backgroundRun: !sessionId,
    status: 'queued',
    enqueuedAt: now,
    lastTransitionAt: now,
    attempt: 1
  };
}

export function transitionTaskQueueState(task: TaskRecord, status: QueueStateRecord['status']): void {
  const now = new Date().toISOString();
  const previous = task.queueState ?? createTaskQueueState(task.sessionId, now);
  const shouldReleaseLease = status !== 'queued' && status !== 'running';
  task.queueState = {
    ...previous,
    status,
    lastTransitionAt: now,
    startedAt: status === 'running' ? (previous.startedAt ?? now) : previous.startedAt,
    finishedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now : previous.finishedAt,
    leaseOwner: shouldReleaseLease ? undefined : previous.leaseOwner,
    leaseExpiresAt: shouldReleaseLease ? undefined : previous.leaseExpiresAt,
    lastHeartbeatAt: shouldReleaseLease ? undefined : previous.lastHeartbeatAt
  };
}

export function assertTaskBudgetAllowsProgress(
  task: TaskRecord,
  state: Pick<
    { currentStep?: string; retryCount: number; maxRetries: number },
    'currentStep' | 'retryCount' | 'maxRetries'
  >
) {
  const stepsConsumed = Math.max(task.budgetState?.stepsConsumed ?? 0, estimateRuntimeStepsConsumed(state.currentStep));
  if (stepsConsumed > (task.budgetState?.stepBudget ?? 8)) {
    throw new TaskBudgetExceededError(`当前任务已耗尽 step budget，已在 ${state.currentStep ?? 'unknown'} 阶段暂停。`, {
      stepBudget: task.budgetState?.stepBudget,
      stepsConsumed,
      currentStep: state.currentStep
    });
  }
  const budgetInterruptState = task.budgetState?.budgetInterruptState;
  if (budgetInterruptState?.status === 'hard-threshold-triggered') {
    throw new TaskBudgetExceededError(budgetInterruptState.reason ?? '当前任务已超过预算硬阈值，系统已强制终止执行。', {
      tokenBudget: task.budgetState?.tokenBudget,
      tokenConsumed: task.budgetState?.tokenConsumed,
      costBudgetUsd: task.budgetState?.costBudgetUsd,
      costConsumedUsd: task.budgetState?.costConsumedUsd,
      currentStep: state.currentStep
    });
  }
}
