import { ApprovalDecision, TaskStatus, type CreateTaskDto, type RouterMinistryLike } from '@agent/core';
import { interrupt } from '@langchain/langgraph';
import { buildPlanningPolicy } from '../../workflows/planning-question-policy';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepResumed,
  markExecutionStepStarted
} from '../../workflows/execution-steps';
import { buildWorkflowPresetPlan } from '../../workflows/workflow-preset-registry';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import {
  applyDefaultPlanAssumptions,
  applyRecommendedPlanAnswers,
  applyUserPlanAnswers,
  buildCounselorProxyInterrupt,
  buildInternalSubAgentResults,
  buildPartialAggregationPreview,
  buildPlanningFinalAnswer,
  collectCounselorIds,
  ensurePlanDraft,
  finalizePlanInterrupt,
  resolveInteractivePlanMode,
  shouldExecuteAfterPlanning,
  syncTaskExecutionMode
} from './planning-stage-helpers';
import { derivePlannerStrategyRecord } from './contracts/supervisor-plan-contract';
import { enrichPlanningDispatches } from './planning-stage-dispatches';
import { applyPlanningMicroBudget } from './planning-stage-budget';
import { compileSkillContractIntoPlan, resolveCompiledSkillAttachment } from './planning-stage-skill-contract';
import type { PlanningCallbacks, SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

export { runGoalIntakeStage, runRouteStage } from './planning-stage-intake';
export { compileSkillContractIntoPlan } from './planning-stage-skill-contract';

export async function runManagerPlanStage<TTask extends SupervisorPlanningTaskLike>(
  task: TTask,
  dto: CreateTaskDto,
  state: RuntimeAgentGraphState,
  libu: RouterMinistryLike,
  callbacks: PlanningCallbacks<TTask> & {
    upsertAgentState: (task: TTask, nextState: unknown) => void;
  }
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  if (task.currentExecutionStep?.stage === 'task-planning' && task.currentExecutionStep.status === 'blocked') {
    markExecutionStepResumed(task, 'task-planning', '恢复群辅票拟流程。', 'libu');
  } else {
    markExecutionStepStarted(task, 'task-planning', '首辅开始拆解目标并形成执行计划。', 'libu');
  }
  if (task.executionPlan?.mode === 'imperial_direct') {
    task.executionMode = 'imperial_direct';
    task.skillStage = 'ministry_execution';
    task.mainChainNode = 'dispatch_planner';
    task.currentNode = 'imperial_direct_dispatch';
    callbacks.syncTaskRuntime(task, {
      currentStep: 'manager_plan',
      retryCount: state.retryCount,
      maxRetries: state.maxRetries
    });
    callbacks.addTrace(task, 'mode_transition', '司礼监已记录皇帝直批，跳过群辅票拟直接进入执行。', {
      interactionKind: 'mode-transition',
      from: task.planMode ?? 'execute',
      to: 'imperial_direct',
      requestedMode: task.executionPlan.mode
    });
    callbacks.addProgressDelta(task, '已进入皇帝直批快捷通道，系统会直接派发到目标六部执行。');
    markExecutionStepCompleted(task, 'task-planning', '已记录特旨直达，跳过群辅票拟。', 'libu');
    await callbacks.persistAndEmitTask(task);
    return {
      currentStep: 'manager_plan',
      shouldRetry: false,
      approvalRequired: false
    };
  }
  const basePlan = task.resolvedWorkflow
    ? buildWorkflowPresetPlan(task.id, dto.goal, task.resolvedWorkflow)
    : await libu.plan();
  if (!basePlan) {
    throw new Error('Manager failed to produce a plan for the current task.');
  }
  const plan = compileSkillContractIntoPlan(task, basePlan);
  task.plan = plan;
  task.plannerStrategy = derivePlannerStrategyRecord({
    specialistLead: task.specialistLead
      ? {
          displayName: task.specialistLead.displayName,
          domain: task.specialistLead.domain ?? 'general-assistant',
          requiredCapabilities: task.specialistLead.requiredCapabilities,
          candidateAgentIds: task.specialistLead.candidateAgentIds
        }
      : undefined
  });
  const subGoals = Array.from(
    new Set([plan.summary, ...(plan.steps ?? []), ...(plan.subTasks ?? []).map(item => item.title)].filter(Boolean))
  );
  task.complexTaskPlan = {
    node: 'complex_task_plan',
    status: 'completed',
    summary: plan.summary,
    subGoals,
    dependencies: subGoals.slice(1).map((goal, index) => ({
      from: subGoals[index]!,
      to: goal
    })),
    recoveryPoints: (plan.subTasks ?? []).map(item => `${item.title}:${item.status}`),
    createdAt: task.complexTaskPlan?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  task.mainChainNode = 'dispatch_planner';
  task.executionPlan = {
    ...(task.executionPlan ?? { mode: task.entryDecision?.requestedMode ?? 'execute' }),
    strategyCounselors: collectCounselorIds(task)
  };
  const interactivePlanMode = resolveInteractivePlanMode(task, dto);
  syncTaskExecutionMode(task);
  if (interactivePlanMode) {
    const now = new Date().toISOString();
    const planDraft = ensurePlanDraft(task, plan, interactivePlanMode, now, buildPlanningPolicy(task, dto));
    applyPlanningMicroBudget(task, planDraft, dto, callbacks, resolveCompiledSkillAttachment(task));
    const questions = planDraft.questions ?? [];
    const shouldAskQuestions = task.planMode !== 'finalized' && task.planMode !== 'aborted' && questions.length > 0;

    if (shouldAskQuestions) {
      const maxPlanTurns = planDraft.maxPlanTurns ?? 3;
      const planTurnsUsed = planDraft.planTurnsUsed ?? 0;
      if (planTurnsUsed >= maxPlanTurns) {
        applyDefaultPlanAssumptions(task, planDraft, now, 'fallback-assumption');
      } else {
        const partialAggregation = buildPartialAggregationPreview(task, planDraft);
        task.partialAggregation = partialAggregation;
        task.internalSubAgents = buildInternalSubAgentResults(task, planDraft, now);
        task.status = TaskStatus.WAITING_APPROVAL;
        task.currentNode = 'planning_interrupt';
        task.currentStep = 'waiting_plan_input';
        task.planDraft = {
          ...planDraft,
          planTurnsUsed: planTurnsUsed + 1
        };
        if (task.queueState) {
          task.queueState.status = 'waiting_approval';
          task.queueState.startedAt ??= now;
          task.queueState.lastTransitionAt = now;
        }
        const interruptId = task.activeInterrupt?.id ?? `interrupt_${task.id}_plan_question`;
        const proxyInterrupt = buildCounselorProxyInterrupt(task, planDraft, interruptId, now);
        task.activeInterrupt = proxyInterrupt;
        task.interruptHistory = [...(task.interruptHistory ?? []), proxyInterrupt];
        markExecutionStepBlocked(
          task,
          'task-planning',
          proxyInterrupt.reason ?? '计划模式需要用户补充关键问题。',
          '群辅票拟已暂停，等待计划问题回复。',
          'libu'
        );
        task.approvals.push({
          taskId: task.id,
          intent: 'plan_question',
          actor: 'runtime-planning',
          reason: proxyInterrupt.reason,
          decision: 'pending',
          decidedAt: now
        });
        callbacks.addTrace(task, 'partial_aggregation_preview', partialAggregation.summary, {
          allowedOutputKinds: task.executionPlan?.partialAggregationPolicy?.allowedOutputKinds,
          interactionKind: 'plan-question',
          sourceCounselorIds: partialAggregation.sourceCounselorIds
        });
        callbacks.addTrace(task, 'approval_gate', proxyInterrupt.reason ?? '计划模式需要用户回答关键问题。', {
          interruptId,
          interactionKind: 'plan-question',
          planMode: task.planMode,
          questionSet: planDraft.questionSet,
          questionCount: questions.length,
          microBudget: planDraft.microBudget
        });
        callbacks.addProgressDelta(
          task,
          `${partialAggregation.summary} 存在关键未知项，已发起计划问题，等待你补充方向后继续。`
        );
        await callbacks.persistAndEmitTask(task);

        const resume = interrupt({
          interruptId,
          kind: 'user-input',
          interactionKind: 'plan-question',
          questionSet: planDraft.questionSet,
          questions,
          microBudget: planDraft.microBudget,
          defaultAssumption: questions.map(question => ({
            questionId: question.id,
            assumption: question.defaultAssumption
          })),
          recommendedOptionIds: questions
            .filter(question => question.recommendedOptionId)
            .map(question => ({
              questionId: question.id,
              optionId: question.recommendedOptionId
            }))
        }) as {
          action?: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
          feedback?: string;
          payload?: {
            answers?: Array<{
              questionId: string;
              optionId?: string;
              freeform?: string;
            }>;
          };
        };

        if (resume?.action === 'abort') {
          finalizePlanInterrupt(task, now, 'cancelled', '用户取消了本轮计划。');
          task.planMode = 'aborted';
          syncTaskExecutionMode(task);
          task.planModeTransitions = [
            ...(task.planModeTransitions ?? []),
            { from: interactivePlanMode, to: 'aborted', reason: 'user_abort', at: now }
          ];
          task.status = TaskStatus.CANCELLED;
          task.result = '计划已取消。';
          callbacks.addTrace(task, 'run_cancelled', '计划模式已取消。', {
            interactionKind: 'plan-question'
          });
          await callbacks.persistAndEmitTask(task);
          return {
            currentStep: 'manager_plan',
            currentPlan: plan.steps,
            shouldRetry: false,
            approvalRequired: false,
            approvalStatus: ApprovalDecision.REJECTED,
            finalAnswer: task.result,
            terminateAfterPlanning: true
          } as Partial<RuntimeAgentGraphState>;
        }

        if (resume?.action === 'bypass') {
          applyRecommendedPlanAnswers(task, planDraft, now, 'bypass-recommended');
          syncTaskExecutionMode(task);
          finalizePlanInterrupt(task, now, 'resolved', '用户选择跳过计划问题，按推荐项继续执行。');
          markExecutionStepResumed(task, 'task-planning', '已按推荐项跳过计划提问，继续推进方案。', 'libu');
          callbacks.addTrace(task, 'run_resumed', '计划问题已按推荐项跳过，准备进入执行阶段。', {
            interactionKind: 'plan-question',
            resolutionSource: 'bypass-recommended'
          });
          callbacks.addProgressDelta(task, '已按推荐项跳过计划提问，接下来直接进入执行主链。');
        } else {
          applyUserPlanAnswers(task, planDraft, resume, now);
          syncTaskExecutionMode(task);
          finalizePlanInterrupt(task, now, 'resolved', '用户已回答计划问题，系统将据此更新方案。');
          markExecutionStepResumed(task, 'task-planning', '已收到计划问题回复，继续收敛方案。', 'libu');
          callbacks.addTrace(task, 'run_resumed', '计划问题已得到回答，正在更新计划。', {
            interactionKind: 'plan-question',
            resolutionSource: task.planDraft?.decisions?.at(-1)?.resolutionSource ?? 'user-answer'
          });
          callbacks.addProgressDelta(task, '已根据你的回答更新计划，正在收敛最终方案。');
        }
      }
    }

    if (task.planMode === 'finalized' && !shouldExecuteAfterPlanning(task)) {
      syncTaskExecutionMode(task);
      task.currentNode = 'planning_finalize';
      task.mainChainNode = 'result_aggregator';
      task.currentStep = 'plan_finalized';
      task.status = TaskStatus.COMPLETED;
      task.result = buildPlanningFinalAnswer(task, plan);
      callbacks.addTrace(task, 'final_response_completed', '计划模式已收敛，准备输出最终方案。', {
        planMode: task.planMode,
        decisionCount: task.planDraft?.decisions?.length ?? 0
      });
      markExecutionStepCompleted(task, 'task-planning', '计划模式已完成方案收敛。', 'libu');
      markExecutionStepCompleted(task, 'delivery', '已输出计划型最终答复。', 'libu-docs');
      await callbacks.persistAndEmitTask(task);
      return {
        currentStep: 'manager_plan',
        currentPlan: plan.steps,
        shouldRetry: false,
        approvalRequired: false,
        approvalStatus: ApprovalDecision.APPROVED,
        finalAnswer: task.result,
        terminateAfterPlanning: true
      } as Partial<RuntimeAgentGraphState>;
    }
  }
  task.review = undefined;
  syncTaskExecutionMode(task);
  task.skillStage = 'ministry_execution';
  task.currentNode = 'dispatch_planner';
  callbacks.syncTaskRuntime(task, {
    currentStep: 'manager_plan',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.upsertAgentState(task, libu.getState());
  callbacks.addTrace(
    task,
    state.retryCount > 0 ? 'manager_replan' : 'dispatch_planner',
    `首辅已完成票拟调度，生成 ${plan.subTasks.length} 个执行子任务${state.retryCount > 0 ? `（第 ${state.retryCount} 次回流）` : ''}。`
  );
  const compiledSkill = resolveCompiledSkillAttachment(task);
  if (compiledSkill) {
    callbacks.addTrace(
      task,
      'skill_contract_compiled',
      `已把 ${compiledSkill.displayName} 的技能步骤编译进本轮执行计划。`,
      {
        sourceId: compiledSkill.sourceId,
        stepCount: compiledSkill.metadata?.steps?.length ?? 0,
        requiredConnectors: compiledSkill.metadata?.requiredConnectors ?? []
      }
    );
    callbacks.addProgressDelta(task, `${compiledSkill.displayName} 的执行步骤已并入本轮计划，后续会按技能步骤推进。`);
  }
  callbacks.addProgressDelta(task, `首辅已完成规划，接下来会按 ${plan.subTasks.length} 个步骤推进。`);
  markExecutionStepCompleted(task, 'task-planning', `已形成 ${plan.subTasks.length} 个执行步骤。`, 'libu');
  callbacks.addTrace(
    task,
    'skill_stage_started',
    `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 进入尚书执行阶段。`,
    {
      skillId: task.skillId,
      skillStage: task.skillStage,
      requiredMinistries: task.resolvedWorkflow?.requiredMinistries
    }
  );
  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'manager_plan',
    currentPlan: plan.steps,
    dispatches: enrichPlanningDispatches(task, libu.dispatch(plan)),
    shouldRetry: false,
    approvalRequired: false,
    approvalStatus: undefined,
    executionResult: undefined,
    executionSummary: undefined,
    finalAnswer: undefined,
    reviewDecision: undefined
  };
}
