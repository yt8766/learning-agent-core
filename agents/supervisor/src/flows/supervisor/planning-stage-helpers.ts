import { type CreateTaskDto, type ManagerPlan, type PlanMode, type PlanDraftRecord } from '@agent/core';
import type { SupervisorPlanningTaskLike } from './pipeline-stage-node.types';
import { collectCounselorIds } from './planning-stage-interrupt-helpers';

export function buildPartialAggregationPreview(task: SupervisorPlanningTaskLike, planDraft: PlanDraftRecord) {
  const questionCount = planDraft.questions?.length ?? 0;
  const openQuestions = (planDraft.openQuestions ?? []).slice(0, 3).join('、');
  return {
    kind: 'preview' as const,
    requiresApproval: true,
    recommendedNextStep: '回答计划问题后再进入完整执行',
    allowedCapabilities: task.executionPlan?.modeCapabilities ?? ['readonly-analysis'],
    sourceCounselorIds: collectCounselorIds(task),
    createdAt: new Date().toISOString(),
    summary:
      questionCount > 0
        ? `阶段性票拟已生成：当前只开放预览、低风险建议和经批准的轻量推进。待确认 ${questionCount} 个关键问题。${openQuestions ? `待确认：${openQuestions}。` : ''}`
        : `阶段性票拟已生成：当前只开放 ${task.executionPlan?.partialAggregationPolicy?.allowedOutputKinds?.join(' / ') ?? 'preview'}。`
  };
}

export function syncTaskExecutionMode(task: SupervisorPlanningTaskLike) {
  if (task.executionPlan?.mode === 'imperial_direct') {
    task.executionMode = 'imperial_direct';
    return;
  }
  const nextMode = task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute';
  task.executionMode = nextMode;
  task.executionPlan = {
    ...(task.executionPlan ?? {
      mode: nextMode
    }),
    mode: nextMode
  };
}

export function resolveInteractivePlanMode(task: SupervisorPlanningTaskLike, dto: CreateTaskDto): PlanMode | undefined {
  const normalizedGoal = dto.goal.trim().toLowerCase();
  if (task.planMode) {
    return task.planMode === 'aborted' ? undefined : task.planMode;
  }

  if (task.resolvedWorkflow?.id.startsWith('plan-')) {
    return 'intent';
  }

  if (
    /^\/plan[-\w]*/i.test(dto.goal.trim()) ||
    ['方案', '计划', '一步一步思考', '先别实现', '先给方案'].some(keyword => normalizedGoal.includes(keyword))
  ) {
    return 'implementation';
  }

  return undefined;
}

export function ensurePlanDraft(
  task: SupervisorPlanningTaskLike,
  plan: ManagerPlan,
  planMode: PlanMode,
  now: string,
  policy: ReturnType<typeof import('../../workflows/planning-question-policy').buildPlanningPolicy>
): PlanDraftRecord {
  if (task.planDraft) {
    if (!task.planModeTransitions?.length && task.planMode) {
      task.planModeTransitions = [{ to: task.planMode, reason: 'resume_existing', at: now }];
    }
    return task.planDraft;
  }

  task.planMode = planMode ?? policy.planMode;
  task.executionPlan = {
    ...(task.executionPlan ?? {
      mode: 'plan'
    }),
    mode: 'plan'
  };
  task.planModeTransitions = [
    ...(task.planModeTransitions ?? []),
    { to: planMode, reason: 'planning_started', at: now }
  ];
  const draft: PlanDraftRecord = {
    summary: plan.summary,
    autoResolved: policy.autoResolved,
    openQuestions: policy.questions.map(question => question.question),
    assumptions: policy.assumptions,
    questions: policy.questions,
    questionSet: policy.questionSet,
    maxPlanTurns: 3,
    planTurnsUsed: 0,
    microBudget: policy.microBudget
  };
  task.planDraft = draft;
  return draft;
}
