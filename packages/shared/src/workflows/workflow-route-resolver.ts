import type { WorkflowRouteContext as CoreWorkflowRouteContext, WorkflowRouteResult } from '@agent/core';
import { applyRoutingProfile, classifyIntent, deriveRoutingProfile } from './workflow-route-signals';
import {
  evaluateExecutionReadiness,
  hasApprovalOnlyWorkflowRoute,
  hasPromptContent,
  hasSpecializedWorkflowRoute
} from './workflow-route-readiness';
import type { WorkflowPresetDefinition } from '../types/primitives';

type WorkflowRouteContext = Omit<CoreWorkflowRouteContext, 'workflow'> & {
  workflow?: WorkflowPresetDefinition;
};

export function resolveWorkflowRoute(context: WorkflowRouteContext): WorkflowRouteResult {
  if (hasApprovalOnlyWorkflowRoute(context)) {
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

  if (hasSpecializedWorkflowRoute(context)) {
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

  if (classified.intent === 'direct-reply' && hasPromptContent(context.goal)) {
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
