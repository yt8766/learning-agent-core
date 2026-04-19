import type { LocalSkillSuggestionRecord } from '@agent/core';

import { normalizeExecutionMode } from '../runtime/runtime-architecture-helpers';

type InterruptLike = {
  kind?: string;
  interactionKind?: string;
  payload?: Record<string, unknown>;
};
type ExecutionPlanLike = {
  mode?: string;
};
type PendingApprovalLike = {
  requestedBy?: string;
  intent?: string;
  toolName?: string;
  riskLevel?: string;
  reason?: string;
  reasonCode?: string;
};
type TaskInteractionLike = {
  activeInterrupt?: InterruptLike;
  pendingApproval?: PendingApprovalLike;
};
type TaskExecutionLike = {
  executionMode?: string;
  planMode?: string;
  executionPlan?: ExecutionPlanLike;
};

export function resolveInterruptPayloadField(
  interrupt: InterruptLike | undefined,
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
