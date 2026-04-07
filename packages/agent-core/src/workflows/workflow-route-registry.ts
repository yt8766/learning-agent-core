import type {
  CapabilityAttachmentRecord,
  CreateTaskDto,
  RequestedExecutionHints,
  WorkflowPresetDefinition
} from '@agent/shared';
import type {
  ExecutionReadiness,
  IntentClassificationResult,
  RouteIntent,
  RoutingProfile,
  WorkflowRouteAdapterId,
  WorkflowRouteContext,
  WorkflowRouteResult
} from '../types/workflow-route';
import { isFreshnessSensitiveGoal } from '../utils/prompts/temporal-context';

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

function buildConnectorToken(connector?: string) {
  return connector
    ?.replace(/-mcp-template$/i, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
}

function hasRequestedConnector(context: WorkflowRouteContext) {
  const requested = context.requestedHints?.requestedConnectorTemplate;
  if (!requested) {
    return true;
  }
  const expected = buildConnectorToken(requested);
  const connectorMatches = [
    ...(context.connectorRefs ?? []),
    ...(context.capabilityAttachments ?? [])
      .filter(item => item.kind === 'connector')
      .flatMap(item => [item.id, item.displayName, item.sourceId].filter(Boolean) as string[])
  ].some(item =>
    item
      .toLowerCase()
      .replace(/[^a-z]/gi, '')
      .includes(expected ?? '')
  );
  return connectorMatches;
}

function hasRequestedCapability(context: WorkflowRouteContext) {
  const requested = context.requestedHints?.requestedSkill ?? context.requestedHints?.requestedCapability;
  if (!requested) {
    return true;
  }
  const normalizedRequested = requested.toLowerCase();
  return (context.capabilityAttachments ?? []).some(item =>
    [item.id, item.displayName, item.sourceId]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(normalizedRequested))
  );
}

function deriveRoutingProfile(context: WorkflowRouteContext): RoutingProfile {
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

function classifyIntent(context: WorkflowRouteContext): IntentClassificationResult {
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

function applyRoutingProfile(
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

function evaluateExecutionReadiness(
  context: WorkflowRouteContext,
  intent: RouteIntent
): {
  readiness: ExecutionReadiness;
  reason?: string;
} {
  if (intent === 'approval-recovery' || intent === 'direct-reply' || intent === 'plan-only') {
    return { readiness: 'ready' };
  }

  if (context.workflow?.approvalPolicy === 'all-actions' && intent === 'workflow-execute') {
    return {
      readiness: 'approval-required',
      reason: '当前 workflow 配置为 all-actions，进入执行前必须先经过审批。'
    };
  }

  if (!hasRequestedConnector(context)) {
    return {
      readiness: 'missing-connector',
      reason: '当前请求显式依赖连接器，但任务上下文里还没有可用 connector。'
    };
  }

  if (!hasRequestedCapability(context)) {
    return {
      readiness: 'missing-capability',
      reason: '当前请求显式依赖 skill/capability，但任务上下文里还没有可用能力附件。'
    };
  }

  return { readiness: 'ready' };
}

export function resolveWorkflowRoute(context: WorkflowRouteContext): WorkflowRouteResult {
  if (hasApprovalOnlyWorkflow(context)) {
    return {
      graph: 'approval-recovery',
      flow: 'approval',
      reason: 'approval_only_workflow',
      adapter: 'approval-recovery',
      priority: 95,
      intent: 'approval-recovery',
      intentConfidence: 1,
      executionReadiness: 'ready',
      matchedSignals: ['approval-only-workflow']
    };
  }

  if (hasNonGeneralWorkflow(context)) {
    const readiness = evaluateExecutionReadiness(context, 'workflow-execute');
    return {
      graph: 'workflow',
      flow:
        readiness.readiness === 'missing-capability' ||
        readiness.readiness === 'missing-connector' ||
        readiness.readiness === 'missing-workspace'
          ? 'direct-reply'
          : 'supervisor',
      reason:
        readiness.readiness === 'ready' || readiness.readiness === 'approval-required'
          ? context.workflow?.command
            ? 'workflow_command'
            : (context.workflow?.id ?? 'workflow_specialized')
          : readiness.readiness.replace(/-/g, '_'),
      adapter:
        readiness.readiness === 'ready' || readiness.readiness === 'approval-required'
          ? 'workflow-command'
          : 'readiness-fallback',
      priority: 100,
      intent: 'workflow-execute',
      intentConfidence: 1,
      executionReadiness: readiness.readiness,
      matchedSignals: ['workflow-command'],
      readinessReason: readiness.reason
    };
  }

  const routingProfile = deriveRoutingProfile(context);
  const classified = applyRoutingProfile(classifyIntent(context), routingProfile, context);
  const readiness = evaluateExecutionReadiness(context, classified.intent);
  const profileAdjustmentReason = classified.reasonHint?.startsWith('profile_')
    ? routingProfile.defaultMode === 'plan-first'
      ? '最近会话显示用户更偏好先计划再执行，本轮在低置信边界 case 中优先进入 plan-only。'
      : '最近会话显示用户更偏好先研究后执行，本轮在低置信边界 case 中优先进入 research-first。'
    : undefined;

  if (classified.intent === 'direct-reply' && hasAnyPrompt(context.goal)) {
    return {
      graph: 'workflow',
      flow: 'direct-reply',
      reason: classified.reasonHint ?? 'general_prompt',
      adapter: classified.adapterHint ?? 'general-prompt',
      priority: classified.adapterHint === 'identity-capability' ? 70 : 50,
      intent: classified.intent,
      intentConfidence: classified.confidence,
      executionReadiness: readiness.readiness,
      matchedSignals: classified.matchedSignals,
      readinessReason: readiness.reason,
      profileAdjustmentReason,
      preferredExecutionMode: routingProfile.defaultMode
    };
  }

  if (classified.intent === 'plan-only') {
    return {
      graph: 'workflow',
      flow: 'supervisor',
      reason: classified.reasonHint ?? 'plan_only_prompt',
      adapter: 'plan-only',
      priority: 72,
      intent: classified.intent,
      intentConfidence: classified.confidence,
      executionReadiness: readiness.readiness,
      matchedSignals: classified.matchedSignals,
      readinessReason: readiness.reason,
      profileAdjustmentReason,
      preferredExecutionMode: routingProfile.defaultMode
    };
  }

  if (classified.intent === 'research-first') {
    return {
      graph: 'workflow',
      flow:
        readiness.readiness === 'missing-capability' || readiness.readiness === 'missing-connector'
          ? 'direct-reply'
          : 'supervisor',
      reason:
        readiness.readiness === 'ready'
          ? (classified.reasonHint ?? 'research_first_prompt')
          : readiness.readiness.replace(/-/g, '_'),
      adapter: readiness.readiness === 'ready' ? 'research-first' : 'readiness-fallback',
      priority: 66,
      intent: classified.intent,
      intentConfidence: classified.confidence,
      executionReadiness: readiness.readiness,
      matchedSignals: classified.matchedSignals,
      readinessReason: readiness.reason,
      profileAdjustmentReason,
      preferredExecutionMode: routingProfile.defaultMode
    };
  }

  if (classified.intent === 'workflow-execute') {
    const flow =
      readiness.readiness === 'missing-capability' ||
      readiness.readiness === 'missing-connector' ||
      readiness.readiness === 'missing-workspace'
        ? 'direct-reply'
        : 'supervisor';
    return {
      graph: 'workflow',
      flow,
      reason:
        flow === 'supervisor'
          ? (classified.reasonHint ?? 'modification_intent')
          : readiness.readiness.replace(/-/g, '_'),
      adapter: flow === 'supervisor' ? (classified.adapterHint ?? 'modification-intent') : 'readiness-fallback',
      priority: classified.adapterHint === 'figma-design' ? 60 : 70,
      intent: classified.intent,
      intentConfidence: classified.confidence,
      executionReadiness: readiness.readiness,
      matchedSignals: classified.matchedSignals,
      readinessReason: readiness.reason,
      profileAdjustmentReason,
      preferredExecutionMode: routingProfile.defaultMode
    };
  }

  return {
    graph: 'workflow',
    flow: 'supervisor',
    reason: context.workflow?.id ?? 'default_workflow',
    adapter: 'fallback',
    priority: 10,
    intent: 'workflow-execute',
    intentConfidence: 0.2,
    executionReadiness: 'ready',
    matchedSignals: ['fallback'],
    preferredExecutionMode: routingProfile.defaultMode
  };
}
