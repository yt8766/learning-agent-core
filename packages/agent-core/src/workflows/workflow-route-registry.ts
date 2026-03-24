import type { WorkflowPresetDefinition } from '@agent/shared';

export interface WorkflowRouteContext {
  goal: string;
  workflow?: WorkflowPresetDefinition;
}

export interface WorkflowRouteResult {
  graph: 'workflow' | 'approval-recovery' | 'learning';
  flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
  reason: string;
}

function isDirectReplyGoal(goal: string) {
  const normalized = goal.trim().toLowerCase();
  if (!normalized || normalized.length > 32) {
    return false;
  }

  return ['你是谁', '你是誰', '介绍一下你自己', '介绍你自己', '你能做什么', '你会什么', 'who are you'].some(pattern =>
    normalized.includes(pattern)
  );
}

function hasApprovalOnlyWorkflow(context: WorkflowRouteContext) {
  return context.workflow?.requiredMinistries.length === 0 && context.workflow?.approvalPolicy === 'all-actions';
}

export function resolveWorkflowRoute(context: WorkflowRouteContext): WorkflowRouteResult {
  if (isDirectReplyGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'direct-reply',
      reason: 'identity_or_capability_question'
    };
  }

  if (hasApprovalOnlyWorkflow(context)) {
    return {
      graph: 'approval-recovery',
      flow: 'approval',
      reason: 'approval_only_workflow'
    };
  }

  return {
    graph: 'workflow',
    flow: 'supervisor',
    reason: context.workflow?.id ?? 'default_workflow'
  };
}
