import type { ApprovalActionDto } from '@agent/core';
import { ActionIntent, AgentRole, ApprovalDecision, TaskStatus } from '@agent/core';
import type { RuntimeTaskRecord as TaskRecord } from '../../../../../runtime/runtime-task.types';

import type { LifecycleApprovalParams, LifecyclePersistCallbacks } from './main-graph-lifecycle-approval.types';
import type { ApprovalResumeInput } from '../../../../../index';

export async function applyApprovalAction(
  params: LifecycleApprovalParams & LifecyclePersistCallbacks,
  taskId: string,
  dto: ApprovalActionDto,
  decision: (typeof ApprovalDecision)[keyof typeof ApprovalDecision]
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
      if (task.status !== TaskStatus.WAITING_APPROVAL && task.status !== TaskStatus.BLOCKED) {
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
