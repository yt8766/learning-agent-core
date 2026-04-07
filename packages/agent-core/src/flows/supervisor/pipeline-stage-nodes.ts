import {
  AgentRole,
  ApprovalDecision,
  CreateTaskDto,
  InternalSubAgentResult,
  ManagerPlan,
  PlanDecisionRecord,
  PlanDraftRecord,
  PlanMode,
  PlanQuestionRecord,
  TaskRecord,
  TaskStatus
} from '@agent/shared';
import { interrupt } from '@langchain/langgraph';
import { LibuRouterMinistry } from '../ministries';
import { buildPlanningPolicy } from '../../workflows/planning-question-policy';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepResumed,
  markExecutionStepStarted
} from '../../workflows/execution-steps';
import { buildWorkflowPresetPlan } from '../../workflows/workflow-preset-registry';
import { buildContextCompressionResult } from '../../utils/context-compression-pipeline';
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
import { buildContextFilterAudienceSlices, orderRuntimeDispatches } from './dispatch-stage-helpers';

interface PlanningCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  attachTool?: (
    task: TaskRecord,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      family?: string;
    }
  ) => void;
  recordToolUsage?: (
    task: TaskRecord,
    params: {
      toolName: string;
      status: 'suggested' | 'used' | 'blocked' | 'approved' | 'rejected';
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      route?: 'local' | 'mcp' | 'governance';
      family?: string;
      capabilityType?: 'local-tool' | 'mcp-capability' | 'governance-tool';
    }
  ) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  resolveWorkflowRoutes: (task: TaskRecord, workflow?: TaskRecord['resolvedWorkflow']) => TaskRecord['modelRoute'];
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  recordDispatches: (task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']) => void;
}

export async function runGoalIntakeStage(
  task: TaskRecord,
  dto: CreateTaskDto,
  state: RuntimeAgentGraphState,
  mode: 'initial' | 'retry' | 'approval_resume',
  callbacks: PlanningCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  // task.entryDecision is the persisted 通政司 / EntryRouter intake projection for compatibility readers.
  const action =
    mode === 'approval_resume' ? 'Resuming approved goal' : mode === 'retry' ? 'Retrying goal' : 'Received goal';
  callbacks.syncTaskRuntime(task, {
    currentStep: 'goal_intake',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'entry_router';
  task.currentNode = 'receive_decree';
  markExecutionStepCompleted(task, 'request-received', `${action}: ${dto.goal}`, 'session');
  callbacks.addTrace(task, 'entry_router', `${action}: ${dto.goal}`, {
    requestedMode: task.entryDecision?.requestedMode,
    workflowId: task.resolvedWorkflow?.id
  });
  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'goal_intake',
    observations: [...state.observations, `goal:${dto.goal}`]
  };
}

export async function runRouteStage(
  task: TaskRecord,
  state: RuntimeAgentGraphState,
  callbacks: PlanningCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  callbacks.syncTaskRuntime(task, {
    currentStep: 'route',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'mode_gate';
  task.currentNode = 'mode_gate';
  const modelRoute = callbacks.resolveWorkflowRoutes(task, task.resolvedWorkflow);
  task.modelRoute = modelRoute;
  task.currentMinistry = 'libu-governance';
  task.currentWorker = modelRoute?.find(item => item.ministry === 'libu-governance')?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  markExecutionStepCompleted(task, 'route-selection', '吏部已完成模式裁剪、路由与选模。', 'libu');
  task.modeGateState = {
    requestedMode: task.executionPlan?.mode,
    activeMode: task.executionMode === 'imperial_direct' ? 'imperial_direct' : (task.executionPlan?.mode ?? 'execute'),
    reason:
      task.executionPlan?.mode === 'plan'
        ? '模式门已切到 plan，只开放只读/规划能力。'
        : task.executionPlan?.mode === 'imperial_direct'
          ? '模式门已登记特旨直达。'
          : '模式门已切到 execute，允许按角色装载全量执行能力。',
    updatedAt: new Date().toISOString()
  };
  task.guardrailState = {
    stage: 'pre',
    verdict: 'pass_through',
    summary:
      task.executionPlan?.mode === 'plan'
        ? '前置护栏已确认当前轮只允许规划、研究与轻量只读。'
        : '前置护栏已确认当前轮可进入执行链，但仍保留审批与终审底线。',
    updatedAt: new Date().toISOString()
  };
  callbacks.addTrace(task, 'mode_gate', '模式门已完成模式裁剪、路由与选模。', {
    modelRoute,
    activeMode: task.modeGateState.activeMode
  });
  if (task.specialistLead) {
    callbacks.addTrace(task, 'specialist_routed', `本轮主导专家：${task.specialistLead.displayName}`, {
      specialistLead: task.specialistLead,
      supportingSpecialists: task.supportingSpecialists,
      routeConfidence: task.routeConfidence
    });
    callbacks.addProgressDelta(
      task,
      task.supportingSpecialists && task.supportingSpecialists.length > 0
        ? `当前由${task.specialistLead.displayName}主导，并发征询 ${task.supportingSpecialists
            .map(item => item.displayName)
            .join('、')} 的专项意见。`
        : `当前由${task.specialistLead.displayName}主导回答。`
    );
  }
  if (state.resumeFromApproval) {
    callbacks.addTrace(task, 'route', 'Resuming graph from approved execution state');
    await callbacks.persistAndEmitTask(task);
  }
  return { currentStep: 'route' };
}

export async function runManagerPlanStage(
  task: TaskRecord,
  dto: CreateTaskDto,
  state: RuntimeAgentGraphState,
  libu: LibuRouterMinistry,
  callbacks: PlanningCallbacks & {
    upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
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
    applyPlanningMicroBudget(task, planDraft, dto, callbacks);
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
        // task.activeInterrupt and task.interruptHistory persist the 司礼监 / InterruptController question stop.
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
    dispatches: libu.dispatch(plan),
    shouldRetry: false,
    approvalRequired: false,
    approvalStatus: undefined,
    executionResult: undefined,
    executionSummary: undefined,
    finalAnswer: undefined,
    reviewDecision: undefined
  };
}

function applyPlanningMicroBudget(
  task: TaskRecord,
  planDraft: PlanDraftRecord,
  dto: CreateTaskDto,
  callbacks: PlanningCallbacks
) {
  const budget = planDraft.microBudget;
  if (!budget || budget.readOnlyToolsUsed > 0 || budget.budgetTriggered) {
    return;
  }

  const compiledSkillAttachment = resolveCompiledSkillAttachment(task);
  const explorationCandidates = [
    {
      toolName: 'planning.workflow_inspect',
      summary: task.resolvedWorkflow ? `已命中流程模板：${task.resolvedWorkflow.displayName}` : '',
      attachedBy: 'workflow' as const,
      ownerType: 'shared' as const,
      reason: '规划阶段读取流程模板与输出契约。'
    },
    {
      toolName: 'planning.context_digest',
      summary: dto.context?.trim() ? '用户已提供额外上下文，可直接纳入方案' : '',
      attachedBy: 'user' as const,
      ownerType: 'user-attached' as const,
      reason: '规划阶段读取用户补充上下文。'
    },
    {
      toolName: 'planning.specialist_snapshot',
      summary: task.specialistLead ? `主导专家已确定为：${task.specialistLead.displayName}` : '',
      attachedBy: 'specialist' as const,
      ownerType: 'specialist-owned' as const,
      ownerId: task.specialistLead?.id,
      reason: '规划阶段读取已选专家与专项线索。'
    },
    {
      toolName: 'planning.skill_contract_inspect',
      summary: compiledSkillAttachment?.displayName ? `已挂载技能线索：${compiledSkillAttachment.displayName}` : '',
      attachedBy: 'runtime' as const,
      ownerType: 'runtime-derived' as const,
      reason: '规划阶段读取已挂载技能步骤与约束。'
    }
  ].filter(item => item.summary);

  const allowedCount = Math.min(budget.readOnlyToolLimit, explorationCandidates.length);
  const usedCandidates = explorationCandidates.slice(0, allowedCount);
  const skippedCandidates = explorationCandidates.slice(allowedCount);

  for (const candidate of usedCandidates) {
    callbacks.attachTool?.(task, {
      toolName: candidate.toolName,
      attachedBy: candidate.attachedBy,
      ownerType: candidate.ownerType,
      ownerId: candidate.ownerId,
      family: 'plan-readonly',
      preferred: true,
      reason: candidate.reason
    });
    callbacks.recordToolUsage?.(task, {
      toolName: candidate.toolName,
      status: 'used',
      requestedBy: 'runtime-planning',
      reason: candidate.reason,
      route: 'local',
      family: 'plan-readonly',
      capabilityType: 'local-tool',
      riskLevel: 'low'
    });
  }

  for (const candidate of skippedCandidates) {
    callbacks.attachTool?.(task, {
      toolName: candidate.toolName,
      attachedBy: candidate.attachedBy,
      ownerType: candidate.ownerType,
      ownerId: candidate.ownerId,
      family: 'plan-readonly',
      preferred: false,
      reason: 'planning micro-budget 已触顶，未继续展开更多只读探索。'
    });
    callbacks.recordToolUsage?.(task, {
      toolName: candidate.toolName,
      status: 'blocked',
      requestedBy: 'runtime-planning',
      reason: candidate.reason,
      blockedReason: 'planning micro-budget exceeded',
      route: 'local',
      family: 'plan-readonly',
      capabilityType: 'local-tool',
      riskLevel: 'low'
    });
  }

  const replacedPrefixes = ['已命中流程模板：', '用户已提供额外上下文', '主导专家已确定为：', '已挂载技能线索：'];
  planDraft.autoResolved = Array.from(
    new Set([
      ...planDraft.autoResolved.filter(item => !replacedPrefixes.some(prefix => item.startsWith(prefix))),
      ...usedCandidates.map(item => item.summary)
    ])
  );
  planDraft.microBudget = {
    ...budget,
    readOnlyToolsUsed: usedCandidates.length,
    budgetTriggered: skippedCandidates.length > 0
  };
  if (skippedCandidates.length > 0) {
    planDraft.assumptions = Array.from(
      new Set([...(planDraft.assumptions ?? []), '规划阶段只读探索已触顶，剩余未知项直接转为计划提问。'])
    );
    planDraft.questionSet = {
      ...planDraft.questionSet,
      summary: `${planDraft.questionSet?.summary ?? '存在关键未知项。'} 当前 planning micro-budget 已触顶，系统将直接向用户提问收敛。`
    };
    callbacks.addTrace(task, 'budget_exhausted', '规划阶段只读探索预算已触顶，停止继续展开。', {
      family: 'plan-readonly',
      readOnlyToolLimit: budget.readOnlyToolLimit,
      readOnlyToolsUsed: usedCandidates.length,
      skippedTools: skippedCandidates.map(item => item.toolName)
    });
    callbacks.addProgressDelta(task, '规划阶段的只读探索预算已触顶，接下来会直接通过计划问题向你收敛关键决策。');
  } else if (usedCandidates.length > 0) {
    callbacks.addTrace(task, 'planning_research_budget', '规划阶段已完成预算内只读探索。', {
      family: 'plan-readonly',
      readOnlyToolLimit: budget.readOnlyToolLimit,
      readOnlyToolsUsed: usedCandidates.length,
      exploredTools: usedCandidates.map(item => item.toolName)
    });
  }
}

function compileSkillContractIntoPlan(task: TaskRecord, plan: ManagerPlan): ManagerPlan {
  const attachment = resolveCompiledSkillAttachment(task);
  const skillSteps = attachment?.metadata?.steps ?? [];
  if (!attachment || skillSteps.length === 0) {
    return plan;
  }

  const compiledSteps = skillSteps.map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}`);
  const connectorHint = attachment.metadata?.requiredConnectors?.length
    ? `依赖连接器：${attachment.metadata.requiredConnectors.join('、')}`
    : undefined;
  const summary = [plan.summary, `已挂载技能：${attachment.displayName}。`, connectorHint].filter(Boolean).join(' ');

  return {
    ...plan,
    summary,
    steps: Array.from(new Set([...plan.steps, ...compiledSteps])),
    subTasks: [
      ...plan.subTasks.map(subTask => ({
        ...subTask,
        description: augmentSubTaskDescription(subTask.description, subTask.assignedTo, attachment)
      })),
      ...buildSkillContractSubTasks(task, attachment)
    ]
  };
}

function buildSkillContractSubTasks(
  task: TaskRecord,
  attachment: NonNullable<ReturnType<typeof resolveCompiledSkillAttachment>>
) {
  const steps = attachment.metadata?.steps ?? [];
  return steps.map((step, index) => {
    const assignedTo = resolveSkillStepAssignee(step.toolNames ?? []);
    return {
      id: buildSkillSubTaskId(attachment.id, assignedTo, index + 1),
      title: `${attachment.displayName} · ${step.title}`,
      description: step.instruction,
      assignedTo,
      status: 'pending' as const
    };
  });
}

function buildSkillSubTaskId(attachmentId: string, assignedTo: AgentRole, stepIndex: number) {
  return `skill_step:${attachmentId}:${assignedTo}:${stepIndex}`;
}

function resolveSkillStepAssignee(toolNames: string[]) {
  const normalizedTools = toolNames.map(item => item.toLowerCase());
  if (normalizedTools.some(item => /(review|approval|security|compliance|audit)/.test(item))) {
    return AgentRole.REVIEWER;
  }
  if (normalizedTools.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))) {
    return AgentRole.EXECUTOR;
  }
  return AgentRole.RESEARCH;
}

function resolveCompiledSkillAttachment(task: TaskRecord) {
  const attachments = task.capabilityAttachments ?? [];
  const requestedSkill = task.requestedHints?.requestedSkill?.toLowerCase();
  return (
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        Boolean(attachment.metadata?.steps?.length) &&
        requestedSkill &&
        (`${attachment.displayName} ${attachment.sourceId ?? ''}`.toLowerCase().includes(requestedSkill) ||
          attachment.id.toLowerCase().includes(requestedSkill))
    ) ??
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        attachment.owner.ownerType === 'user-attached' &&
        Boolean(attachment.metadata?.steps?.length)
    )
  );
}

function augmentSubTaskDescription(
  description: string,
  assignedTo: AgentRole,
  attachment: NonNullable<ReturnType<typeof resolveCompiledSkillAttachment>>
) {
  const steps = attachment.metadata?.steps ?? [];
  if (!steps.length) {
    return description;
  }

  const relevantSteps = steps.filter(step => {
    const normalizedTools = (step.toolNames ?? []).map(item => item.toLowerCase());
    if (assignedTo === AgentRole.RESEARCH) {
      return (
        normalizedTools.length === 0 || normalizedTools.some(item => /(search|read|browse|doc|memory|web)/.test(item))
      );
    }
    if (assignedTo === AgentRole.EXECUTOR) {
      return (
        normalizedTools.length === 0 ||
        normalizedTools.some(item => /(write|send|run|ship|open|browser|github|lark|http)/.test(item))
      );
    }
    if (assignedTo === AgentRole.REVIEWER) {
      return (
        normalizedTools.length === 0 ||
        normalizedTools.some(item => /(review|approval|security|compliance|audit)/.test(item)) ||
        (attachment.metadata?.approvalSensitiveTools?.length ?? 0) > 0
      );
    }
    return false;
  });

  if (!relevantSteps.length) {
    return description;
  }

  return `${description}\n技能步骤：${relevantSteps.map(step => `${step.title}(${step.instruction})`).join('；')}`;
}

export async function runDispatchStage(
  task: TaskRecord,
  state: RuntimeAgentGraphState,
  callbacks: PlanningCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  callbacks.syncTaskRuntime(task, {
    currentStep: 'dispatch',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'context_filter';
  task.currentNode = 'context_filter';
  const orderedDispatches = orderRuntimeDispatches(state.dispatches);
  const seededDispatchOrder = task.contextFilterState?.dispatchOrder ?? [];
  const dispatchOrder = Array.from(
    new Set([...seededDispatchOrder, ...orderedDispatches.map(dispatch => dispatch.kind)])
  ) as Array<'strategy' | 'ministry' | 'fallback'>;
  const compression = buildContextCompressionResult(task);
  const filteredContextSlice = {
    summary: compression.summary,
    historyTraceCount: Math.min(task.trace.length, 12),
    evidenceCount: task.externalSources?.length ?? 0,
    specialistCount: [task.specialistLead, ...(task.supportingSpecialists ?? [])].filter(Boolean).length,
    ministryCount: Array.from(new Set((task.modelRoute ?? []).map(item => item.ministry))).length,
    compressionApplied: compression.compressionApplied,
    compressionSource: compression.compressionSource,
    compressedMessageCount: compression.compressedMessageCount,
    artifactCount: compression.artifactCount,
    originalCharacterCount: compression.originalCharacterCount,
    compactedCharacterCount: compression.compactedCharacterCount,
    reactiveRetryCount: compression.reactiveRetryCount,
    pipelineAudit: compression.pipelineAudit
  };
  task.contextFilterState = {
    node: 'context_filter',
    status: 'completed',
    filteredContextSlice,
    audienceSlices: buildContextFilterAudienceSlices(task, orderedDispatches),
    dispatchOrder,
    noiseGuards: Array.from(
      new Set([
        ...(task.contextFilterState?.noiseGuards ?? []),
        'filtered_system_battle_reports',
        'deduped_thought_copy',
        'trimmed_irrelevant_history'
      ])
    ),
    hiddenTraceCount: Math.max(0, task.trace.length - filteredContextSlice.historyTraceCount),
    redactedKeys: ['messages.raw', 'toolUsageSummary.debug'],
    createdAt: task.contextFilterState?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  callbacks.recordDispatches(task, orderedDispatches);
  callbacks.addTrace(task, 'context_filter', '文书科已完成上下文压缩与脱敏切片。', {
    filteredContextSlice,
    hiddenTraceCount: task.contextFilterState.hiddenTraceCount,
    dispatchOrder,
    audienceSlices: task.contextFilterState.audienceSlices
  });
  await callbacks.persistAndEmitTask(task);
  return { currentStep: 'dispatch', dispatches: orderedDispatches };
}
