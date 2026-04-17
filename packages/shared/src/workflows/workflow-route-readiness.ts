import type { ExecutionReadiness, RouteIntent, WorkflowRouteContext as CoreWorkflowRouteContext } from '@agent/core';
import type { WorkflowPresetDefinition } from '../types/primitives';

type WorkflowRouteContext = Omit<CoreWorkflowRouteContext, 'workflow'> & {
  workflow?: WorkflowPresetDefinition;
};

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

export function evaluateExecutionReadiness(
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

export function hasApprovalOnlyWorkflowRoute(context: WorkflowRouteContext) {
  return hasApprovalOnlyWorkflow(context);
}

export function hasSpecializedWorkflowRoute(context: WorkflowRouteContext) {
  return hasNonGeneralWorkflow(context);
}

export function hasPromptContent(goal: string) {
  return hasAnyPrompt(goal);
}
