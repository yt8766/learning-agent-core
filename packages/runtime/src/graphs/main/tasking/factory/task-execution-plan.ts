import type { ExecutionPlanMode, SpecialistDomain } from '@agent/core';
import type { TaskExecutionPlanRecord as ExecutionPlanRecord } from '../task-architecture-helpers';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';

export function buildExecutionPlan(
  mode: ExecutionPlanMode,
  budget:
    | {
        maxCostPerTaskUsd?: number;
      }
    | undefined,
  counselorSelection: {
    selectedCounselorId?: string;
    selectedVersion?: string;
  },
  governance: {
    requiresGovernanceEscalation: boolean;
    trustedSpecialistFastLane: boolean;
    strategyCounselors: SpecialistDomain[];
  }
): ExecutionPlanRecord {
  const costBudget = budget?.maxCostPerTaskUsd ?? 0;
  const dispatchChain: NonNullable<ExecutionPlanRecord['dispatchChain']> = [
    'entry_router',
    'mode_gate',
    'dispatch_planner',
    'context_filter',
    'result_aggregator',
    'interrupt_controller',
    'learning_recorder'
  ];
  const executionMinistries: NonNullable<ExecutionPlanRecord['executionMinistries']> =
    mode === 'plan'
      ? ['libu-governance', 'hubu-search']
      : ['libu-governance', 'hubu-search', 'gongbu-code', 'bingbu-ops', 'xingbu-review', 'libu-delivery'];
  const allowedOutputKinds: Array<'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress'> = [
    'preview',
    'low_risk_action_suggestion',
    'approved_lightweight_progress'
  ];
  const filteredCapabilitiesBase =
    mode === 'plan'
      ? ['shared', 'readonly:ministry-owned', 'low-risk:specialist-owned']
      : mode === 'imperial_direct'
        ? ['shared', 'ministry-owned', 'specialist-owned', 'imperial-attached']
        : ['shared', 'ministry-owned', 'specialist-owned', 'temporary-assignment'];
  const filteredCapabilities = governance.requiresGovernanceEscalation
    ? filteredCapabilitiesBase.filter(item => item !== 'temporary-assignment' && item !== 'imperial-attached')
    : filteredCapabilitiesBase;
  const modeCapabilitiesBase =
    mode === 'plan'
      ? ['readonly-analysis', 'static-validation', 'plan-synthesis']
      : mode === 'imperial_direct'
        ? ['imperial-fast-path', 'dangerous-approval-floor', 'full-capability-pool']
        : ['full-capability-pool'];
  return {
    mode,
    tokenBudget:
      (mode === 'plan' ? 6000 : mode === 'imperial_direct' ? 12000 : 10000) +
      (governance.trustedSpecialistFastLane ? 800 : 0),
    costBudget,
    softBudgetThreshold: governance.requiresGovernanceEscalation ? 0.72 : 0.8,
    hardBudgetThreshold: 1,
    dispatchChain,
    filteredCapabilities,
    strategyCounselors: governance.strategyCounselors,
    executionMinistries,
    selectedCounselorId: counselorSelection.selectedCounselorId,
    selectedVersion: counselorSelection.selectedVersion,
    partialAggregationPolicy: {
      allowedOutputKinds: governance.requiresGovernanceEscalation
        ? allowedOutputKinds.filter(item => item !== 'approved_lightweight_progress')
        : allowedOutputKinds,
      requiresInterruptApprovalForProgress: true
    },
    modeCapabilities: Array.from(
      new Set([
        ...modeCapabilitiesBase,
        ...(governance.requiresGovernanceEscalation
          ? ['governance-escalated-review', 'trust-gated-capability-pool']
          : []),
        ...(governance.trustedSpecialistFastLane ? ['trusted-specialist-fast-lane'] : [])
      ])
    )
  };
}

export function deriveOrchestrationGovernance(params: {
  capabilityAttachments: TaskRecord['capabilityAttachments'];
  specialistLead: NonNullable<TaskRecord['specialistLead']>;
  routeConfidence: number;
}) {
  const specialistAttachment = (params.capabilityAttachments ?? []).find(
    attachment =>
      attachment.owner.ownerType === 'specialist-owned' && attachment.owner.ownerId === params.specialistLead.domain
  );
  const degradedAttachmentCount = (params.capabilityAttachments ?? []).filter(attachment =>
    isDegradedTrust(attachment.capabilityTrust?.trustLevel, attachment.capabilityTrust?.trustTrend)
  ).length;
  const degradedMinistryCount = (params.capabilityAttachments ?? []).filter(
    attachment =>
      attachment.owner.ownerType === 'ministry-owned' &&
      isDegradedTrust(attachment.capabilityTrust?.trustLevel, attachment.capabilityTrust?.trustTrend)
  ).length;
  const requiresGovernanceEscalation =
    degradedMinistryCount > 0 ||
    isDegradedTrust(
      specialistAttachment?.capabilityTrust?.trustLevel,
      specialistAttachment?.capabilityTrust?.trustTrend
    );
  const trustedSpecialistFastLane =
    specialistAttachment?.capabilityTrust?.trustLevel === 'high' &&
    specialistAttachment?.capabilityTrust?.trustTrend === 'up' &&
    degradedAttachmentCount === 0;
  const adjustedRouteConfidence = Math.max(
    0.2,
    Math.min(
      params.routeConfidence + (trustedSpecialistFastLane ? 0.06 : requiresGovernanceEscalation ? -0.12 : 0),
      0.98
    )
  );

  return {
    requiresGovernanceEscalation,
    trustedSpecialistFastLane,
    strategyCounselors: trustedSpecialistFastLane ? [params.specialistLead.domain] : [],
    adjustedRouteConfidence,
    dispatchOrder: (requiresGovernanceEscalation
      ? ['strategy', 'fallback', 'ministry']
      : ['strategy', 'ministry', 'fallback']) as Array<'strategy' | 'ministry' | 'fallback'>,
    noiseGuards: requiresGovernanceEscalation
      ? ['prioritize_governance_feedback', 'require_cross_check_before_write']
      : trustedSpecialistFastLane
        ? ['compress_confirmed_specialist_context']
        : [],
    contextSummary: requiresGovernanceEscalation
      ? '文书科将优先暴露治理反馈与保守派发顺序。'
      : trustedSpecialistFastLane
        ? '文书科将优先压缩稳定画像并放大主专家可信上下文。'
        : '尚未生成文书科上下文切片。',
    strategySummary: requiresGovernanceEscalation ? '优先汇入治理告警与保守策略。' : '优先汇入主专家和群辅票拟摘要。',
    ministrySummary: requiresGovernanceEscalation
      ? '执行侧先接收治理约束，再展开六部动作。'
      : '执行侧按默认六部链路展开。',
    fallbackSummary: requiresGovernanceEscalation ? '兜底链提前参与交叉校验。' : '仅在主链不足时再进入兜底。'
  };
}

function isDegradedTrust(level?: 'high' | 'medium' | 'low', trend?: 'up' | 'steady' | 'down') {
  return level === 'low' || trend === 'down';
}
