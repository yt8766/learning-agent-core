import { TaskStatus, type InternalSubAgentResult, type ManagerPlan, type PlanDraftRecord } from '@agent/core';
import type { SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

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
      [
        task.specialistLead?.agentId,
        ...(task.specialistLead?.candidateAgentIds ?? []),
        ...(task.supportingSpecialists?.flatMap(item => [item.agentId, ...(item.candidateAgentIds ?? [])]) ?? []),
        task.specialistLead?.id,
        ...(task.supportingSpecialists?.map(item => item.id) ?? [])
      ].filter((item): item is string => Boolean(item))
    )
  );
}

export function isAmbiguousPlanAnswer(value?: string) {
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
