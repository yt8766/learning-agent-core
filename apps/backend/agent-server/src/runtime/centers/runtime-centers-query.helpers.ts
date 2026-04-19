import type { LocalSkillSuggestionRecord, PlatformApprovalRecord, TaskRecord } from '@agent/core';

import { normalizeExecutionMode } from '../helpers/runtime-architecture-helpers';

type InterruptLike = TaskRecord['activeInterrupt'] | PlatformApprovalRecord['activeInterrupt'];
type ExecutionPlanLike = {
  mode?: string;
};
type TaskInteractionLike = Pick<TaskRecord, 'activeInterrupt' | 'pendingApproval'>;
type TaskExecutionLike = Pick<TaskRecord, 'executionMode' | 'planMode'> & {
  executionPlan?: ExecutionPlanLike;
};

export function resolveInterruptPayloadField(
  interrupt: InterruptLike,
  field: 'commandPreview' | 'riskReason' | 'riskCode' | 'approvalScope'
) {
  const payload = interrupt?.payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const value = payload[field];
  return typeof value === 'string' ? value : undefined;
}

export function resolveTaskInteractionKind(task: TaskInteractionLike) {
  // activeInterrupt is the persisted 司礼监 / InterruptController projection for center filtering.
  const interrupt = task.activeInterrupt;
  const extendedInterrupt = asRecord(interrupt);
  if (typeof extendedInterrupt?.interactionKind === 'string') {
    return extendedInterrupt.interactionKind;
  }
  const payload = interrupt?.payload;
  if (payload && typeof payload === 'object' && typeof payload.interactionKind === 'string') {
    return payload.interactionKind;
  }
  if (interrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  return task.pendingApproval || task.activeInterrupt ? 'approval' : undefined;
}

export function resolveTaskExecutionMode(task: TaskExecutionLike) {
  return String(
    normalizeExecutionMode(
      task.executionMode ??
        task.executionPlan?.mode ??
        (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute')
    ) ?? 'execute'
  );
}

export async function resolveLocalSkillSuggestionsWithTimeout(
  resolver: () => Promise<{
    suggestions: LocalSkillSuggestionRecord[];
    gapSummary?: string;
    profile?: string;
    usedInstalledSkills?: string[];
  }>
) {
  const timeoutMs = 250;
  const timeoutResult = {
    suggestions: [],
    gapSummary: 'local-skill-suggestions-timeout',
    profile: undefined,
    usedInstalledSkills: []
  };

  return Promise.race([
    resolver().catch(() => timeoutResult),
    new Promise<typeof timeoutResult>(resolve => {
      setTimeout(() => resolve(timeoutResult), timeoutMs);
    })
  ]);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}
