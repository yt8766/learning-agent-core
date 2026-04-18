import {
  CreateTaskDto,
  InternalSubAgentResult,
  ManagerPlan,
  PlanMode,
  PlanDecisionRecord,
  PlanDraftRecord,
  TaskStatus
} from '@agent/core';
import type { SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

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

export function finalizePlanInterrupt(
  task: SupervisorPlanningTaskLike,
  now: string,
  status: 'resolved' | 'cancelled',
  reason: string
) {
  if (!task.activeInterrupt) {
    return;
  }
  task.activeInterrupt = {
    ...task.activeInterrupt,
    status,
    blockedReason: reason,
    resolvedAt: now
  };
  task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
  if (status === 'resolved') {
    task.status = TaskStatus.RUNNING;
    if (task.queueState) {
      task.queueState.status = 'running';
      task.queueState.lastTransitionAt = now;
    }
  }
}

export function shouldExecuteAfterPlanning(task: SupervisorPlanningTaskLike) {
  return task.planDraft?.decisions?.some(
    item =>
      item.resolutionSource === 'bypass-recommended' ||
      (item.questionId === 'delivery_mode' && item.selectedOptionId === 'implement_now')
  );
}

export function buildPlanningFinalAnswer(task: SupervisorPlanningTaskLike, plan: ManagerPlan) {
  const lines = [
    '## 计划结论',
    task.planDraft?.summary ?? plan.summary,
    '',
    '## 关键步骤',
    ...plan.steps.map(step => `- ${step}`)
  ];
  if (task.planDraft?.autoResolved?.length) {
    lines.push('', '## 已自动确认', ...task.planDraft.autoResolved.map(item => `- ${item}`));
  }
  if (task.planDraft?.decisions?.length) {
    lines.push(
      '',
      '## 已收敛决策',
      ...task.planDraft.decisions.map(decision => {
        const question = task.planDraft?.questions?.find(item => item.id === decision.questionId);
        const optionLabel = question?.options.find(item => item.id === decision.selectedOptionId)?.label;
        const value =
          decision.freeform || optionLabel || decision.assumedValue || decision.decisionRationale || '已确认';
        return `- ${question?.question ?? decision.questionId}：${value}`;
      })
    );
  }
  if (task.planDraft?.assumptions?.length) {
    lines.push('', '## 默认假设', ...task.planDraft.assumptions.map(item => `- ${item}`));
  }
  if (task.planDraft?.microBudget) {
    const tokenBudgetUsd = task.planDraft.microBudget.tokenBudgetUsd ?? 0;
    lines.push(
      '',
      '## 计划预算',
      `- 只读工具预算：${task.planDraft.microBudget.readOnlyToolsUsed}/${task.planDraft.microBudget.readOnlyToolLimit}`,
      `- 预算阈值：$${tokenBudgetUsd.toFixed(2)}`,
      `- 是否触顶：${task.planDraft.microBudget.budgetTriggered ? '是' : '否'}`
    );
  }
  return lines.join('\n');
}

export function buildInternalSubAgentResults(
  task: SupervisorPlanningTaskLike,
  planDraft: PlanDraftRecord,
  now: string
): InternalSubAgentResult[] {
  const questions = planDraft.questions ?? [];
  const counselorIds = collectCounselorIds(task);
  const participants = counselorIds.length ? counselorIds : ['general-assistant'];
  const buckets: Array<InternalSubAgentResult & { questions: typeof questions }> = participants.map(agentId => ({
    agentId,
    status: 'continue',
    interactionKind: 'plan-question' as const,
    summary: planDraft.questionSet?.summary,
    questions: [],
    createdAt: now
  }));

  questions.forEach((question, index) => {
    const bucket = buckets[index % buckets.length];
    if (!bucket) {
      return;
    }
    bucket.status = 'needs_user_input';
    bucket.questions.push(question);
  });

  return buckets.filter(item => item.questions.length > 0);
}

export function buildCounselorProxyInterrupt(
  task: SupervisorPlanningTaskLike,
  planDraft: PlanDraftRecord,
  interruptId: string,
  now: string
): NonNullable<SupervisorPlanningTaskLike['activeInterrupt']> {
  const results = task.internalSubAgents ?? [];
  const aggregatedQuestions = results.flatMap(item => item.questions ?? []).slice(0, 3);
  const interactionKind: 'plan-question' | 'supplemental-input' = results.some(
    item => item.interactionKind === 'supplemental-input'
  )
    ? 'supplemental-input'
    : 'plan-question';
  return {
    id: interruptId,
    status: 'pending' as const,
    mode: 'blocking' as const,
    source: 'graph' as const,
    origin: 'counselor_proxy' as const,
    proxySourceAgentId:
      task.executionPlan?.selectedCounselorId ?? task.entryDecision?.counselorSelector?.selectedCounselorId,
    kind: 'user-input' as const,
    interactionKind,
    requestedBy: 'libu-governance',
    ownerType: 'ministry-owned' as const,
    ownerId: 'libu-governance',
    reason: planDraft.questionSet?.summary ?? '存在高影响未知项，需要先收敛方案。',
    blockedReason: planDraft.questionSet?.summary ?? '等待计划问题回答。',
    resumeStrategy: 'command' as const,
    timeoutMinutes: 30,
    timeoutPolicy: 'default-continue' as const,
    payload: {
      stage: 'planning',
      interactionKind,
      questionSet: planDraft.questionSet,
      questions: aggregatedQuestions,
      sourceCounselorIds: collectCounselorIds(task),
      microBudget: planDraft.microBudget,
      defaultAssumption: aggregatedQuestions.map(question => ({
        questionId: question.id,
        assumption: question.defaultAssumption
      })),
      recommendedOptionIds: aggregatedQuestions
        .filter(question => question.recommendedOptionId)
        .map(question => ({
          questionId: question.id,
          optionId: question.recommendedOptionId
        }))
    },
    createdAt: now
  };
}

export function collectCounselorIds(task: SupervisorPlanningTaskLike) {
  return Array.from(
    new Set(
      [task.specialistLead?.id, ...(task.supportingSpecialists?.map(item => item.id) ?? [])].filter(
        (item): item is NonNullable<SupervisorPlanningTaskLike['specialistLead']>['id'] => Boolean(item)
      )
    )
  );
}

function isAmbiguousPlanAnswer(value?: string) {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return [
    '不知道',
    '不清楚',
    '都可以',
    '随便',
    '你看着办',
    '你决定',
    '你来定',
    "i don't know",
    'idk',
    'up to you',
    'you decide',
    'whatever'
  ].some(keyword => normalized.includes(keyword));
}
