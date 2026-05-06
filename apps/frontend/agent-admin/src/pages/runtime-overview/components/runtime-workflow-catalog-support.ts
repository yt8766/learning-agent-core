import type { WorkflowPresetDefinition } from '@agent/core';

export function buildWorkflowLaunchGoal(workflow: WorkflowPresetDefinition, goal: string) {
  const normalizedGoal = goal.trim();
  if (!normalizedGoal) {
    return '';
  }
  if (!workflow.command) {
    return normalizedGoal;
  }
  return `${workflow.command} ${normalizedGoal}`.trim();
}
