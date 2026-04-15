import {
  ActionIntent,
  AgentRole,
  ApprovalActionDto,
  ApprovalDecision,
  ApprovalResumeInput,
  CreateTaskDto,
  ExecutionTrace,
  ReviewRecord,
  SkillSearchStateRecord,
  TaskRecord,
  TaskStatus
} from '@agent/shared';

import { PendingExecutionContext } from '../../../flows/approval';

type LifecycleApprovalParams = {
  tasks: Map<string, TaskRecord>;
  pendingExecutions: Map<string, PendingExecutionContext>;
  runTaskPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: ApprovalResumeInput;
    }
  ) => Promise<void>;
  runBootstrapGraph: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'interrupt_resume';
      resume?: ApprovalResumeInput;
    }
  ) => Promise<void>;
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
  addTrace: (trace: ExecutionTrace[], node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  transitionQueueState: (task: TaskRecord, status: NonNullable<TaskRecord['queueState']>['status']) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  getSkillInstallApprovalResolver: () =>
    | ((params: { task: TaskRecord; pending: PendingExecutionContext; actor?: string }) => Promise<
        | {
            skillSearch?: SkillSearchStateRecord;
            usedInstalledSkills?: string[];
            traceSummary?: string;
            progressSummary?: string;
          }
        | undefined
      >)
    | undefined;
  runtime: {
    attachTool: (
      task: TaskRecord,
      params: {
        toolName: string;
        attachedBy: 'user';
        preferred?: boolean;
        reason?: string;
        ownerType?: 'user-attached';
        ownerId?: string;
      }
    ) => void;
    recordToolUsage: (
      task: TaskRecord,
      params: {
        toolName: string;
        status: 'blocked' | 'approved';
        requestedBy?: string;
        reason?: string;
        blockedReason?: string;
        serverId?: string;
        capabilityId?: string;
        approvalRequired?: boolean;
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      }
    ) => void;
  };
};

type LifecyclePersistCallbacks = {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
};

export async function applyApprovalAction(
  params: LifecycleApprovalParams & LifecyclePersistCallbacks,
  taskId: string,
  dto: ApprovalActionDto,
  decision: ApprovalDecision
): Promise<TaskRecord | undefined> {
  const task = params.tasks.get(taskId);
  if (!task) return undefined;
  const resolvedIntent =
    dto.intent ??
    (task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
      ? (task.activeInterrupt.payload as { interactionKind?: unknown }).interactionKind === 'plan-question'
        ? 'plan_question'
        : undefined
      : undefined) ??
    task.pendingApproval?.intent ??
    task.pendingAction?.intent ??
    'interrupt';
  task.approvals.push({
    taskId,
    intent: resolvedIntent,
    reason: dto.reason,
    actor: dto.actor,
    decision,
    decidedAt: new Date().toISOString()
  });
  task.updatedAt = new Date().toISOString();

  if (task.activeInterrupt?.resumeStrategy === 'command') {
    const interruptStage =
      task.activeInterrupt.payload && typeof task.activeInterrupt.payload === 'object'
        ? (task.activeInterrupt.payload as { stage?: unknown }).stage
        : undefined;
    await params.persistAndEmitTask(task);
    const resume =
      dto.interrupt ??
      ({
        interruptId: task.activeInterrupt.id,
        action:
          task.activeInterrupt.kind === 'user-input'
            ? decision === ApprovalDecision.APPROVED
              ? 'bypass'
              : 'abort'
            : decision === ApprovalDecision.APPROVED
              ? 'approve'
              : 'reject',
        feedback: dto.feedback,
        payload: dto.actor ? { actor: dto.actor } : undefined
      } as ApprovalResumeInput);
    if (interruptStage === 'pre_execution') {
      await params.runBootstrapGraph(
        task,
        { goal: task.goal, context: task.context, constraints: [] },
        {
          mode: 'interrupt_resume',
          resume
        }
      );
      if (![TaskStatus.WAITING_APPROVAL, TaskStatus.BLOCKED].includes(task.status)) {
        await params.runTaskPipeline(
          task,
          { goal: task.goal, context: task.context, constraints: [] },
          { mode: 'initial' }
        );
      }
    } else {
      await params.runTaskPipeline(
        task,
        { goal: task.goal, context: task.context, constraints: [] },
        {
          mode: 'interrupt_resume',
          resume
        }
      );
    }
    return task;
  }

  if (decision === ApprovalDecision.REJECTED) {
    if (task.activeInterrupt) {
      const resolvedInterrupt = {
        ...task.activeInterrupt,
        status: 'cancelled' as const,
        blockedReason: dto.feedback ?? task.activeInterrupt.blockedReason ?? task.activeInterrupt.reason,
        resolvedAt: new Date().toISOString()
      };
      task.activeInterrupt = resolvedInterrupt;
      task.interruptHistory = [...(task.interruptHistory ?? []), resolvedInterrupt];
    }
    if (task.pendingApproval?.toolName) {
      params.runtime.attachTool(task, {
        toolName: task.pendingApproval.toolName,
        attachedBy: 'user',
        preferred: true,
        reason: task.pendingApproval.reason,
        ownerType: 'user-attached',
        ownerId: dto.actor
      });
      params.runtime.recordToolUsage(task, {
        toolName: task.pendingApproval.toolName,
        status: 'blocked',
        requestedBy: dto.actor,
        reason: task.pendingApproval.reason,
        blockedReason: dto.feedback ?? task.pendingApproval.reason,
        serverId: task.pendingApproval.serverId,
        capabilityId: task.pendingApproval.capabilityId,
        approvalRequired: true,
        riskLevel: task.pendingApproval.riskLevel
      });
    }
    task.status = TaskStatus.BLOCKED;
    params.transitionQueueState(task, 'blocked');
    task.result = 'Approval rejected. Task is blocked.';
    task.approvalFeedback = dto.feedback;
    task.pendingApproval = task.pendingApproval
      ? { ...task.pendingApproval, feedback: dto.feedback }
      : task.pendingAction
        ? { ...task.pendingAction, feedback: dto.feedback }
        : undefined;
    task.review = {
      taskId,
      decision: 'blocked',
      notes: ['Human approval rejected the high-risk action.', ...(dto.feedback ? [`Feedback: ${dto.feedback}`] : [])],
      createdAt: new Date().toISOString()
    };
    params.addTrace(
      task.trace,
      dto.feedback ? 'approval_rejected_with_feedback' : 'approval_gate',
      dto.feedback
        ? `Approval rejected for ${dto.intent} with feedback: ${dto.feedback}`
        : `Approval rejected for ${dto.intent}`
    );
    params.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
    await params.persistAndEmitTask(task);
    return task;
  }

  params.addTrace(task.trace, 'approval_gate', `Approval granted for ${dto.intent}`);
  if (task.activeInterrupt) {
    const resolvedInterrupt = {
      ...task.activeInterrupt,
      status: 'resolved' as const,
      resolvedAt: new Date().toISOString()
    };
    task.activeInterrupt = resolvedInterrupt;
    task.interruptHistory = [...(task.interruptHistory ?? []), resolvedInterrupt];
  }
  if (task.pendingApproval?.toolName) {
    params.runtime.attachTool(task, {
      toolName: task.pendingApproval.toolName,
      attachedBy: 'user',
      preferred: true,
      reason: task.pendingApproval.reason,
      ownerType: 'user-attached',
      ownerId: dto.actor
    });
    params.runtime.recordToolUsage(task, {
      toolName: task.pendingApproval.toolName,
      status: 'approved',
      requestedBy: dto.actor,
      reason: task.pendingApproval.reason,
      serverId: task.pendingApproval.serverId,
      capabilityId: task.pendingApproval.capabilityId,
      approvalRequired: false,
      riskLevel: task.pendingApproval.riskLevel
    });
  }
  task.activeInterrupt = undefined;
  task.pendingApproval = undefined;
  task.pendingAction = undefined;
  const pending = params.pendingExecutions.get(taskId);
  if (!pending) {
    task.status = TaskStatus.RUNNING;
    params.transitionQueueState(task, 'running');
    task.result = '已收到审批结果，但当前没有找到待恢复的执行上下文。';
    await params.persistAndEmitTask(task);
    return task;
  }

  params.pendingExecutions.delete(taskId);
  if (pending.kind === 'skill_install' && pending.intent === ActionIntent.INSTALL_SKILL) {
    const resolver = params.getSkillInstallApprovalResolver();
    const resolved = resolver ? await resolver({ task, pending, actor: dto.actor }) : undefined;
    if (resolved?.skillSearch) {
      task.skillSearch = resolved.skillSearch;
    }
    if (resolved?.usedInstalledSkills?.length) {
      task.usedInstalledSkills = Array.from(
        new Set([...(task.usedInstalledSkills ?? []), ...resolved.usedInstalledSkills])
      );
    }
    if (resolved?.traceSummary) {
      params.addTrace(task.trace, 'skill_runtime_intervention', resolved.traceSummary, {
        usedInstalledSkills: resolved.usedInstalledSkills
      });
    }
    if (resolved?.progressSummary) {
      params.addProgressDelta(task, resolved.progressSummary);
    }
    task.status = TaskStatus.RUNNING;
    params.transitionQueueState(task, 'running');
    await params.persistAndEmitTask(task);
    await params.runTaskPipeline(task, { goal: task.goal, context: undefined, constraints: [] }, { mode: 'initial' });
    return task;
  }
  await params.persistAndEmitTask(task);
  await params.runApprovalRecoveryPipeline(
    task,
    { goal: task.goal, context: pending.researchSummary, constraints: [] },
    pending
  );
  return task;
}

export async function handleLifecycleInterruptTimeout(
  params: Pick<LifecycleApprovalParams, 'addTrace' | 'addProgressDelta' | 'transitionQueueState' | 'runTaskPipeline'> &
    LifecyclePersistCallbacks,
  task: TaskRecord,
  now: string
): Promise<TaskRecord | undefined> {
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

function applyTimeoutPlanDefaults(task: TaskRecord, now: string) {
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
