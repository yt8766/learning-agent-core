import { normalizeExecutionMode } from '../helpers/runtime-architecture-helpers';

export function resolveInterruptPayloadField(
  interrupt: any,
  field: 'commandPreview' | 'riskReason' | 'riskCode' | 'approvalScope'
) {
  const payload = interrupt?.payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const value = payload[field];
  return typeof value === 'string' ? value : undefined;
}

export function resolveTaskInteractionKind(task: any) {
  // activeInterrupt is the persisted 司礼监 / InterruptController projection for center filtering.
  if (typeof task.activeInterrupt?.interactionKind === 'string') {
    return task.activeInterrupt.interactionKind;
  }
  const payload = task.activeInterrupt?.payload;
  if (payload && typeof payload === 'object' && typeof payload.interactionKind === 'string') {
    return payload.interactionKind;
  }
  if (task.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  return task.pendingApproval || task.activeInterrupt ? 'approval' : undefined;
}

export function resolveTaskExecutionMode(task: any) {
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
    suggestions: unknown[];
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
