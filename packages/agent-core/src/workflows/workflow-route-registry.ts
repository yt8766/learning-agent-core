import type { ChatRouteRecord, WorkflowPresetDefinition } from '@agent/shared';
import { isFreshnessSensitiveGoal } from '../shared/prompts/temporal-context';

export interface WorkflowRouteContext {
  goal: string;
  workflow?: WorkflowPresetDefinition;
}

export type WorkflowRouteAdapterId =
  | 'workflow-command'
  | 'approval-recovery'
  | 'identity-capability'
  | 'figma-design'
  | 'modification-intent'
  | 'general-prompt'
  | 'fallback';

export interface WorkflowRouteResult extends ChatRouteRecord {
  adapter: WorkflowRouteAdapterId;
}

function normalizeGoal(goal: string) {
  return goal.trim().toLowerCase();
}

export function isConversationRecallGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  if (!normalized || normalized.length > 80) {
    return false;
  }

  return [
    '刚刚聊了什么',
    '刚才聊了什么',
    '我们刚刚聊了什么',
    '上一轮聊了什么',
    '回顾一下刚刚',
    '总结一下刚刚',
    '总结一下我们刚刚聊了什么',
    'what did we just talk',
    'recap what we just talked'
  ].some(pattern => normalized.includes(pattern));
}

function isIdentityOrCapabilityGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  if (!normalized || normalized.length > 48) {
    return false;
  }

  return ['你是谁', '你是誰', '介绍一下你自己', '介绍你自己', '你能做什么', '你会什么', 'who are you'].some(pattern =>
    normalized.includes(pattern)
  );
}

function isFigmaLikeGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  return (
    normalized.includes('figma.com') ||
    normalized.includes('www.figma.com') ||
    normalized.includes('/file/') ||
    normalized.includes('设计稿') ||
    normalized.includes('ui 复刻') ||
    normalized.includes('页面还原')
  );
}

function isModificationIntentGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  return [
    '修改',
    '修复',
    '改一下',
    '重构',
    '新增',
    '加一个',
    '实现',
    '优化',
    'refactor',
    'fix',
    'modify',
    'change',
    'implement'
  ].some(pattern => normalized.includes(pattern));
}

function hasNonGeneralWorkflow(context: WorkflowRouteContext) {
  return Boolean(context.workflow && context.workflow.id !== 'general');
}

function hasAnyPrompt(goal: string) {
  const normalized = goal.trim().toLowerCase();
  return normalized.length > 0;
}

function hasApprovalOnlyWorkflow(context: WorkflowRouteContext) {
  return context.workflow?.requiredMinistries.length === 0 && context.workflow?.approvalPolicy === 'all-actions';
}

export function resolveWorkflowRoute(context: WorkflowRouteContext): WorkflowRouteResult {
  if (hasApprovalOnlyWorkflow(context)) {
    return {
      graph: 'approval-recovery',
      flow: 'approval',
      reason: 'approval_only_workflow',
      adapter: 'approval-recovery',
      priority: 95
    };
  }

  if (hasNonGeneralWorkflow(context)) {
    return {
      graph: 'workflow',
      flow: 'supervisor',
      reason: context.workflow?.command ? 'workflow_command' : (context.workflow?.id ?? 'workflow_specialized'),
      adapter: 'workflow-command',
      priority: 100
    };
  }

  if (isIdentityOrCapabilityGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'direct-reply',
      reason: 'identity_or_capability_question',
      adapter: 'identity-capability',
      priority: 70
    };
  }

  if (isFigmaLikeGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'figma_like_design',
      adapter: 'figma-design',
      priority: 60
    };
  }

  if (isModificationIntentGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'modification_intent',
      adapter: 'modification-intent',
      priority: 70
    };
  }

  if (isFreshnessSensitiveGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'freshness_sensitive_prompt',
      adapter: 'general-prompt',
      priority: 65
    };
  }

  if (isConversationRecallGoal(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'direct-reply',
      reason: 'conversation_recall_prompt',
      adapter: 'general-prompt',
      priority: 55
    };
  }

  if (hasAnyPrompt(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'direct-reply',
      reason: 'general_prompt',
      adapter: 'general-prompt',
      priority: 50
    };
  }

  return {
    graph: 'workflow',
    flow: 'supervisor',
    reason: context.workflow?.id ?? 'default_workflow',
    adapter: 'fallback',
    priority: 10
  };
}
