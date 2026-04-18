import { TaskStatus } from '@agent/core';
import type { RuntimeTaskRecord } from '../../../../../runtime/runtime-task.types';

import type { LifecycleApprovalParams, LifecyclePersistCallbacks } from './main-graph-lifecycle-approval.types';

export async function handleLifecycleInterruptTimeout(
  params: Pick<LifecycleApprovalParams, 'addTrace' | 'addProgressDelta' | 'transitionQueueState' | 'runTaskPipeline'> &
    LifecyclePersistCallbacks,
  task: RuntimeTaskRecord,
  now: string
): Promise<RuntimeTaskRecord | undefined> {
  const interrupt = task.activeInterrupt;
  if (!interrupt || interrupt.status !== 'pending') {
    return undefined;
  }

  const interactionKind =
    interrupt.interactionKind ??
    (interrupt.payload && typeof interrupt.payload === 'object' && typeof interrupt.payload.interactionKind === 'string'
      ? interrupt.payload.interactionKind
      : interrupt.kind === 'user-input'
        ? 'plan-question'
        : 'approval');

  task.activeInterrupt = {
    ...interrupt,
    status: 'cancelled',
    origin: interrupt.origin ?? 'timeout',
    blockedReason: interrupt.blockedReason ?? interrupt.reason,
    timedOutAt: now,
    resolvedAt: now
  };
  task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
  task.learningEvaluation = {
    ...(task.learningEvaluation ?? {
      score: 0,
      confidence: 'low',
      notes: [],
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount: 0,
        internalSourceCount: 0,
        reusedMemoryCount: 0,
        reusedRuleCount: 0,
        reusedSkillCount: 0
      }
    }),
    timeoutStats: {
      count: (task.learningEvaluation?.timeoutStats?.count ?? 0) + 1,
      defaultAppliedCount:
        (task.learningEvaluation?.timeoutStats?.defaultAppliedCount ?? 0) +
        (interactionKind === 'plan-question' ? 1 : 0)
    }
  };

  if (interactionKind === 'approval') {
    task.pendingApproval = undefined;
    task.pendingAction = undefined;
    task.status = TaskStatus.CANCELLED;
    task.currentNode = 'interrupt_timeout';
    task.currentStep = 'approval_timeout';
    task.result = '审批超时，系统已默认拒绝并终止任务。';
    params.transitionQueueState(task, 'cancelled');
    params.addTrace(task.trace, 'interrupt_timeout', task.result, {
      interactionKind,
      timeoutPolicy: interrupt.timeoutPolicy,
      timeoutMinutes: interrupt.timeoutMinutes
    });
    await params.persistAndEmitTask(task);
    return task;
  }

  if (interactionKind === 'supplemental-input') {
    task.status = TaskStatus.CANCELLED;
    task.currentNode = 'interrupt_timeout';
    task.currentStep = 'supplemental_input_timeout';
    task.result = '补充信息超时，当前任务已取消，请补充信息后重试。';
    params.transitionQueueState(task, 'cancelled');
    params.addTrace(task.trace, 'interrupt_timeout', task.result, {
      interactionKind,
      timeoutPolicy: interrupt.timeoutPolicy,
      timeoutMinutes: interrupt.timeoutMinutes
    });
    await params.persistAndEmitTask(task);
    return task;
  }

  if (interactionKind === 'plan-question') {
    applyTimeoutPlanDefaults(task, now);
    task.status = TaskStatus.RUNNING;
    task.currentNode = 'planning_timeout_resume';
    task.currentStep = 'manager_plan';
    params.transitionQueueState(task, 'running');
    params.addTrace(task.trace, 'interrupt_timeout', '计划问题超时，已按默认选项继续，并将在最终答复标注默认值。', {
      interactionKind,
      timeoutPolicy: interrupt.timeoutPolicy,
      timeoutMinutes: interrupt.timeoutMinutes
    });
    await params.persistAndEmitTask(task);
    await params.runTaskPipeline(
      task,
      { goal: task.goal, context: task.context, constraints: [] },
      { mode: 'initial' }
    );
    return task;
  }

  return undefined;
}

export function applyTimeoutPlanDefaults(task: RuntimeTaskRecord, now: string) {
  const questions = task.planDraft?.questions ?? [];
  const previousPlanMode = task.planMode;
  if (task.planDraft) {
    task.planDraft = {
      ...task.planDraft,
      decisions: questions.map(question => ({
        questionId: question.id,
        resolutionSource: 'default-assumption',
        selectedOptionId: question.recommendedOptionId,
        assumedValue: question.defaultAssumption,
        whyAsked: question.whyAsked,
        decisionRationale:
          question.options.find(option => option.id === question.recommendedOptionId)?.description ??
          question.defaultAssumption,
        impactOnPlan: question.impactOnPlan,
        answeredAt: now
      })),
      assumptions: Array.from(
        new Set([
          ...(task.planDraft.assumptions ?? []),
          ...(questions.map(question => question.defaultAssumption).filter(Boolean) as string[]),
          '部分计划问题因超时采用了默认值。'
        ])
      )
    };
  }
  task.planMode = 'finalized';
  task.executionPlan = {
    ...(task.executionPlan ?? { mode: 'execute' }),
    mode: 'execute'
  };
  task.executionMode = 'execute';
  task.planModeTransitions = [
    ...(task.planModeTransitions ?? []),
    {
      from: previousPlanMode,
      to: 'finalized',
      reason: 'timeout_default_continue',
      at: now
    }
  ];
}
