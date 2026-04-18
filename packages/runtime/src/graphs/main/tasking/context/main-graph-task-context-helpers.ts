import type { LlmUsageRecord } from '@agent/core';

import type { MainGraphTaskAggregate } from '../main-graph-task.types';

export function createEmptyUsageRecord(now: string): LlmUsageRecord {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimated: false,
    measuredCallCount: 0,
    estimatedCallCount: 0,
    models: [],
    updatedAt: now
  };
}

export function estimateModelCostUsd(model: string, totalTokens: number): number {
  const normalized = model.toLowerCase();
  const rate = normalized.includes('glm-5')
    ? 0.002
    : normalized.includes('glm-4.7-flash')
      ? 0.0005
      : normalized.includes('glm-4.7')
        ? 0.001
        : normalized.includes('glm-4.6')
          ? 0.0012
          : 0.001;
  return (Math.max(totalTokens, 0) / 1000) * rate;
}

export function roundUsageCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function resolveCompiledSkillAttachment(task: MainGraphTaskAggregate) {
  const attachments = task.capabilityAttachments ?? [];
  const requestedSkill = task.requestedHints?.requestedSkill?.toLowerCase();
  return (
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        Boolean(attachment.metadata?.steps?.length) &&
        requestedSkill &&
        (`${attachment.displayName} ${attachment.sourceId ?? ''}`.toLowerCase().includes(requestedSkill) ||
          attachment.id.toLowerCase().includes(requestedSkill))
    ) ??
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        attachment.owner.ownerType === 'user-attached' &&
        Boolean(attachment.metadata?.steps?.length)
    )
  );
}

export function resolveExecutionMode(task?: MainGraphTaskAggregate) {
  if (task?.executionPlan?.mode) {
    return task.executionPlan.mode;
  }
  if (task?.executionMode) {
    return task.executionMode;
  }
  return task?.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute';
}
