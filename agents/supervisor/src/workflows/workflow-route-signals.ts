import type {
  IntentClassificationResult,
  RoutingProfile,
  WorkflowRouteContext as CoreWorkflowRouteContext
} from '@agent/core';

import { isFreshnessSensitiveGoal } from '../utils/prompts/temporal-context';
import type { WorkflowPresetDefinition } from '@agent/core';

type WorkflowRouteContext = Omit<CoreWorkflowRouteContext, 'workflow'> & {
  workflow?: WorkflowPresetDefinition;
};

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

function isPlanOnlyGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  return (
    /先给(我)?(一个)?计划|先出方案|先分析|不要执行|先别执行|只给计划|plan only|plan-first/i.test(normalized) ||
    normalized.startsWith('/plan')
  );
}

function isResearchFirstGoal(goal: string) {
  const normalized = normalizeGoal(goal);
  return /先研究|先调研|先查资料|先查一下|research first|research-only|先搜一下|先检索/i.test(normalized);
}

function looksWorkspaceDependent(goal: string, context?: string) {
  const normalized = normalizeGoal(`${goal}\n${context ?? ''}`);
  return /(代码|仓库|repo|repository|文件|file|diff|补丁|pr|组件|页面|接口|branch|提交)/i.test(normalized);
}

export function deriveRoutingProfile(context: WorkflowRouteContext): RoutingProfile {
  const recentText = [...(context.recentTurns ?? []).map(turn => turn.content), ...(context.relatedHistory ?? [])]
    .join('\n')
    .toLowerCase();
  const planSignals = (recentText.match(/\/plan|先给计划|先分析|不要执行/g) ?? []).length;
  const execSignals = (recentText.match(/\/exec|直接执行|直接改|直接做/g) ?? []).length;
  const researchSignals = (recentText.match(/先研究|先调研|research/g) ?? []).length;

  return {
    defaultMode:
      planSignals > execSignals ? 'plan-first' : execSignals > planSignals ? 'execute-first' : 'direct-reply',
    prefersResearchFirst: researchSignals > 0,
    executionTolerance: execSignals >= 2 ? 'high' : planSignals >= 2 ? 'low' : 'medium'
  };
}

export function classifyIntent(context: WorkflowRouteContext): IntentClassificationResult {
  const explicitSignals: string[] = [];

  if (context.requestedMode === 'plan' || isPlanOnlyGoal(context.goal)) {
    explicitSignals.push('plan-only');
    return {
      intent: 'plan-only',
      confidence: 0.96,
      matchedSignals: explicitSignals,
      adapterHint: 'plan-only',
      reasonHint: 'plan_only_prompt'
    };
  }

  if (context.requestedHints?.preferredMode === 'research-first' || isResearchFirstGoal(context.goal)) {
    explicitSignals.push('research-first');
    return {
      intent: 'research-first',
      confidence: 0.92,
      matchedSignals: explicitSignals,
      adapterHint: 'research-first',
      reasonHint: 'research_first_prompt'
    };
  }

  if (
    context.requestedHints?.preferredMode === 'workflow' ||
    isFigmaLikeGoal(context.goal) ||
    isModificationIntentGoal(context.goal)
  ) {
    explicitSignals.push(isFigmaLikeGoal(context.goal) ? 'figma-like' : 'workflow-execute');
    return {
      intent: 'workflow-execute',
      confidence: 0.9,
      matchedSignals: explicitSignals,
      adapterHint: isFigmaLikeGoal(context.goal) ? 'figma-design' : 'modification-intent',
      reasonHint: isFigmaLikeGoal(context.goal) ? 'figma_like_design' : 'modification_intent'
    };
  }

  if (isIdentityOrCapabilityGoal(context.goal)) {
    return {
      intent: 'direct-reply',
      confidence: 0.95,
      matchedSignals: ['identity-capability'],
      adapterHint: 'identity-capability',
      reasonHint: 'identity_or_capability_question'
    };
  }

  if (isConversationRecallGoal(context.goal)) {
    return {
      intent: 'direct-reply',
      confidence: 0.88,
      matchedSignals: ['conversation-recall'],
      adapterHint: 'general-prompt',
      reasonHint: 'conversation_recall_prompt'
    };
  }

  if (isFreshnessSensitiveGoal(context.goal)) {
    return {
      intent: 'research-first',
      confidence: 0.78,
      matchedSignals: ['freshness-sensitive'],
      adapterHint: 'research-first',
      reasonHint: 'freshness_sensitive_prompt'
    };
  }

  return {
    intent: 'direct-reply',
    confidence: 0.5,
    matchedSignals: ['general-prompt'],
    adapterHint: 'general-prompt',
    reasonHint: 'general_prompt'
  };
}

export function applyRoutingProfile(
  classification: IntentClassificationResult,
  profile: RoutingProfile,
  context: WorkflowRouteContext
): IntentClassificationResult {
  if (classification.confidence > 0.6 || classification.matchedSignals.some(signal => signal !== 'general-prompt')) {
    return classification;
  }

  if (
    classification.intent === 'direct-reply' &&
    profile.prefersResearchFirst &&
    isFreshnessSensitiveGoal(context.goal)
  ) {
    return {
      intent: 'research-first',
      confidence: 0.58,
      matchedSignals: [...classification.matchedSignals, 'profile-prefers-research'],
      adapterHint: 'research-first',
      reasonHint: 'profile_research_first'
    };
  }

  if (
    classification.intent === 'direct-reply' &&
    profile.defaultMode === 'plan-first' &&
    looksWorkspaceDependent(context.goal, context.context)
  ) {
    return {
      intent: 'plan-only',
      confidence: 0.56,
      matchedSignals: [...classification.matchedSignals, 'profile-prefers-plan'],
      adapterHint: 'plan-only',
      reasonHint: 'profile_plan_first'
    };
  }

  return classification;
}
