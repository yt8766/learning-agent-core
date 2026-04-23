import type { PlanDecisionRecord, PlanDraftRecord } from '@agent/core';
import type { SupervisorPlanningTaskLike } from './pipeline-stage-node.types';
import { collectCounselorIds, isAmbiguousPlanAnswer } from './planning-stage-interrupt-helpers';

export function applyDefaultPlanAssumptions(
  task: SupervisorPlanningTaskLike,
  planDraft: PlanDraftRecord,
  now: string,
  resolutionSource: PlanDecisionRecord['resolutionSource']
) {
  const previousPlanMode = task.planMode;
  const decisions = (planDraft.questions ?? []).map(question => ({
    questionId: question.id,
    resolutionSource,
    assumedValue: question.defaultAssumption,
    whyAsked: question.whyAsked,
    decisionRationale: question.defaultAssumption,
    impactOnPlan: question.impactOnPlan,
    answeredAt: now
  }));
  task.planDraft = {
    ...planDraft,
    decisions,
    assumptions: Array.from(
      new Set([...(planDraft.assumptions ?? []), ...decisions.map(item => item.assumedValue ?? '')])
    )
  };
  task.planMode = 'finalized';
  task.executionPlan = {
    ...(task.executionPlan ?? {
      mode: 'execute'
    }),
    mode: 'execute'
  };
  task.planModeTransitions = [
    ...(task.planModeTransitions ?? []),
    { from: previousPlanMode, to: 'finalized', reason: resolutionSource, at: now }
  ];
  task.partialAggregation = {
    kind: 'approved_lightweight_progress',
    summary: '计划默认值已收敛，允许进入轻量推进并继续完整执行。',
    recommendedNextStep: '继续执行正式任务',
    requiresApproval: false,
    allowedCapabilities: task.executionPlan?.modeCapabilities ?? ['full-capability-pool'],
    sourceCounselorIds: collectCounselorIds(task),
    createdAt: now
  };
}

export function applyRecommendedPlanAnswers(
  task: SupervisorPlanningTaskLike,
  planDraft: PlanDraftRecord,
  now: string,
  resolutionSource: PlanDecisionRecord['resolutionSource']
) {
  const previousPlanMode = task.planMode;
  const decisions = (planDraft.questions ?? []).map(question => ({
    questionId: question.id,
    resolutionSource,
    selectedOptionId: question.recommendedOptionId,
    whyAsked: question.whyAsked,
    decisionRationale: question.options.find(option => option.id === question.recommendedOptionId)?.description,
    impactOnPlan: question.impactOnPlan,
    answeredAt: now
  }));
  task.planDraft = {
    ...planDraft,
    decisions,
    assumptions: Array.from(
      new Set([
        ...(planDraft.assumptions ?? []),
        ...decisions.map(item => item.decisionRationale ?? item.selectedOptionId ?? '').filter(Boolean)
      ])
    )
  };
  task.planMode = 'finalized';
  task.executionPlan = {
    ...(task.executionPlan ?? {
      mode: 'execute'
    }),
    mode: 'execute'
  };
  task.planModeTransitions = [
    ...(task.planModeTransitions ?? []),
    { from: previousPlanMode, to: 'finalized', reason: resolutionSource, at: now }
  ];
  task.partialAggregation = {
    kind: 'approved_lightweight_progress',
    summary: '计划推荐项已收敛，允许继续进入完整执行。',
    recommendedNextStep: '继续执行正式任务',
    requiresApproval: false,
    allowedCapabilities: task.executionPlan?.modeCapabilities ?? ['full-capability-pool'],
    sourceCounselorIds: collectCounselorIds(task),
    createdAt: now
  };
}

export function applyUserPlanAnswers(
  task: SupervisorPlanningTaskLike,
  planDraft: PlanDraftRecord,
  resume: {
    action?: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
    feedback?: string;
    payload?: {
      answers?: Array<{
        questionId: string;
        optionId?: string;
        freeform?: string;
      }>;
    };
  },
  now: string
) {
  const answers = resume.payload?.answers ?? [];
  const previousPlanMode = task.planMode;
  const decisions = (planDraft.questions ?? []).map(question => {
    const answer = answers.find(item => item.questionId === question.id);
    const trimmedFreeform = answer?.freeform?.trim();
    if (!answer || (!answer.optionId && !trimmedFreeform) || isAmbiguousPlanAnswer(trimmedFreeform)) {
      return {
        questionId: question.id,
        resolutionSource: 'fallback-assumption' as const,
        assumedValue: question.defaultAssumption,
        whyAsked: question.whyAsked,
        decisionRationale: question.defaultAssumption,
        impactOnPlan: question.impactOnPlan,
        answeredAt: now
      };
    }
    return {
      questionId: question.id,
      resolutionSource: 'user-answer' as const,
      selectedOptionId: answer.optionId,
      freeform: trimmedFreeform || undefined,
      whyAsked: question.whyAsked,
      decisionRationale:
        trimmedFreeform ||
        question.options.find(option => option.id === answer.optionId)?.description ||
        question.defaultAssumption,
      impactOnPlan: question.impactOnPlan,
      answeredAt: now
    };
  });
  task.planDraft = {
    ...planDraft,
    decisions,
    assumptions: Array.from(
      new Set([
        ...(planDraft.assumptions ?? []),
        ...decisions.map(item => item.assumedValue ?? item.freeform ?? '').filter(Boolean)
      ])
    )
  };
  task.planMode = 'finalized';
  task.executionPlan = {
    ...(task.executionPlan ?? {
      mode: 'execute'
    }),
    mode: 'execute'
  };
  task.planModeTransitions = [
    ...(task.planModeTransitions ?? []),
    { from: previousPlanMode, to: 'finalized', reason: 'user_answered', at: now }
  ];
  task.partialAggregation = {
    kind: 'approved_lightweight_progress',
    summary: '计划问题已完成收敛，允许继续进入完整执行。',
    recommendedNextStep: '继续执行正式任务',
    requiresApproval: false,
    allowedCapabilities: task.executionPlan?.modeCapabilities ?? ['full-capability-pool'],
    sourceCounselorIds: collectCounselorIds(task),
    createdAt: now
  };
}
