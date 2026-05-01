import { ActionIntent, AgentRole, TaskStatus, type RouterMinistryLike } from '@agent/core';
import { interrupt } from '@langchain/langgraph';

import type {
  DirectReplyInterruptGraphCallbacks,
  DirectReplyInterruptGraphState
} from '../../../graphs/main/execution/pipeline/direct-reply-interrupt-graph';
import { markExecutionStepBlocked, markExecutionStepResumed } from '../../../bridges/supervisor-runtime-bridge';
import { recordPendingApprovalOnce, recordPendingInterruptOnce } from '../../approval/interrupt-idempotency';
import { extendInterruptWithRiskMetadata, extendPendingApprovalWithRiskMetadata } from '../../approval/risk-interrupts';
import type { ApprovalResumeInput } from '@agent/runtime';
function shouldAttemptRuntimeSkillIntervention(
  task: Parameters<DirectReplyInterruptGraphCallbacks['persistAndEmitTask']>[0]
) {
  return Boolean(
    task.skillSearch?.capabilityGapDetected &&
    (task.skillSearch?.suggestions.length ?? 0) > 0 &&
    (task.usedInstalledSkills?.length ?? 0) === 0
  );
}

export async function runDirectReplySkillGateNode(
  state: DirectReplyInterruptGraphState,
  task: Parameters<DirectReplyInterruptGraphCallbacks['persistAndEmitTask']>[0],
  callbacks: DirectReplyInterruptGraphCallbacks
): Promise<DirectReplyInterruptGraphState> {
  callbacks.ensureTaskNotCancelled(task);

  if (!task.skillSearch || !shouldAttemptRuntimeSkillIntervention(task)) {
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: false };
  }

  const resolved = await callbacks.resolveRuntimeSkillIntervention({
    task,
    goal: task.goal,
    currentStep: 'direct_reply',
    skillSearch: task.skillSearch,
    usedInstalledSkills: task.usedInstalledSkills
  });

  if (!resolved) {
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: false };
  }

  if (resolved.skillSearch) {
    task.skillSearch = resolved.skillSearch;
  }
  if (resolved.usedInstalledSkills?.length) {
    task.usedInstalledSkills = Array.from(
      new Set([...(task.usedInstalledSkills ?? []), ...resolved.usedInstalledSkills])
    );
  }
  if (resolved.traceSummary) {
    callbacks.addTrace(task, 'skill_runtime_intervention', resolved.traceSummary, {
      stage: 'direct_reply',
      usedInstalledSkills: resolved.usedInstalledSkills
    });
  }
  if (resolved.progressSummary) {
    callbacks.addProgressDelta(task, resolved.progressSummary, AgentRole.MANAGER);
  }

  if (!resolved.pendingApproval || !resolved.pendingExecution?.receiptId) {
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: false };
  }

  const interruptId = `interrupt_${task.id}_direct_reply_skill_install`;
  const isPendingReplay = task.activeInterrupt?.id === interruptId && task.activeInterrupt.status === 'pending';
  const interruptAt = task.activeInterrupt?.createdAt ?? new Date().toISOString();
  task.status = TaskStatus.WAITING_APPROVAL;
  callbacks.transitionQueueState(task, 'waiting_approval');
  task.currentNode = 'approval_gate';
  task.currentStep = 'waiting_skill_install_approval';
  task.pendingAction = {
    toolName: resolved.pendingApproval.toolName,
    intent: ActionIntent.INSTALL_SKILL,
    requestedBy: task.currentMinistry ?? 'libu-governance'
  };
  task.pendingApproval = extendPendingApprovalWithRiskMetadata(
    {
      ...task.pendingAction,
      reason: resolved.pendingApproval.reason,
      preview: resolved.pendingApproval.preview
    },
    { requestedBy: task.currentMinistry ?? 'libu-governance', approvalScope: 'once' }
  );
  task.activeInterrupt = isPendingReplay
    ? task.activeInterrupt
    : extendInterruptWithRiskMetadata(
        {
          id: interruptId,
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          origin: 'runtime',
          kind: 'skill-install',
          intent: ActionIntent.INSTALL_SKILL,
          toolName: resolved.pendingApproval.toolName,
          family: 'runtime-governance',
          capabilityType: 'governance-tool',
          requestedBy: task.currentMinistry ?? 'libu-governance',
          ownerType: 'ministry-owned',
          ownerId: task.currentMinistry ?? 'libu-governance',
          reason: resolved.pendingApproval.reason,
          blockedReason: resolved.pendingApproval.reason,
          riskLevel: 'medium',
          resumeStrategy: 'command',
          preview: resolved.pendingApproval.preview,
          payload: {
            stage: 'direct_reply',
            receiptId: resolved.pendingExecution.receiptId,
            skillDisplayName: resolved.pendingExecution.skillDisplayName
          },
          createdAt: interruptAt
        },
        { approvalScope: 'once' }
      );
  const activeInterrupt = task.activeInterrupt;
  if (!activeInterrupt) {
    throw new Error('Direct reply skill install interrupt was not initialized.');
  }
  const isFirstPendingInterrupt = recordPendingInterruptOnce(task, activeInterrupt);
  if (isFirstPendingInterrupt) {
    callbacks.attachTool(task, {
      toolName: resolved.pendingApproval.toolName,
      attachedBy: 'runtime',
      preferred: true,
      reason: resolved.pendingApproval.reason,
      ownerType: 'ministry-owned',
      ownerId: task.currentMinistry ?? 'libu-governance',
      family: 'runtime-governance'
    });
    callbacks.recordToolUsage(task, {
      toolName: resolved.pendingApproval.toolName,
      status: 'blocked',
      requestedBy: task.currentMinistry ?? 'libu-governance',
      reason: resolved.pendingApproval.reason,
      blockedReason: resolved.pendingApproval.reason,
      approvalRequired: true,
      route: 'governance',
      family: 'runtime-governance',
      capabilityType: 'governance-tool',
      riskLevel: 'medium'
    });
    recordPendingApprovalOnce(task, {
      taskId: task.id,
      intent: ActionIntent.INSTALL_SKILL,
      decision: 'pending',
      decidedAt: new Date().toISOString(),
      reason: resolved.pendingApproval.reason
    });
  }
  callbacks.registerPendingExecution(task.id, {
    taskId: task.id,
    intent: ActionIntent.INSTALL_SKILL,
    toolName: resolved.pendingApproval.toolName,
    researchSummary: task.goal,
    kind: 'skill_install',
    receiptId: resolved.pendingExecution.receiptId,
    goal: task.goal,
    usedInstalledSkills: task.usedInstalledSkills,
    skillDisplayName: resolved.pendingExecution.skillDisplayName,
    currentSkillExecution: task.currentSkillExecution
  });
  if (isFirstPendingInterrupt) {
    callbacks.setSubTaskStatus(task, AgentRole.MANAGER, 'blocked');
    callbacks.addTrace(
      task,
      'approval_gate',
      `直答前检测到需要先安装 ${resolved.pendingExecution.skillDisplayName ?? '远程 skill'}，已暂停等待审批。`,
      {
        stage: 'direct_reply',
        receiptId: resolved.pendingExecution.receiptId,
        skillDisplayName: resolved.pendingExecution.skillDisplayName
      }
    );
    callbacks.addProgressDelta(
      task,
      `当前轮直答前需要先安装 ${resolved.pendingExecution.skillDisplayName ?? '远程 skill'}，已暂停等待审批。`,
      AgentRole.MANAGER
    );
    markExecutionStepBlocked(
      task,
      'approval-interrupt',
      resolved.pendingApproval.reason,
      '直答链已暂停等待审批。',
      'system'
    );
  }
  await callbacks.persistAndEmitTask(task);

  const resume = interrupt({
    interruptId: activeInterrupt.id,
    kind: 'skill-install',
    mode: 'blocking',
    toolName: resolved.pendingApproval.toolName,
    intent: ActionIntent.INSTALL_SKILL,
    reason: resolved.pendingApproval.reason,
    preview: resolved.pendingApproval.preview,
    payload: {
      stage: 'direct_reply',
      receiptId: resolved.pendingExecution.receiptId,
      skillDisplayName: resolved.pendingExecution.skillDisplayName
    }
  }) as ApprovalResumeInput | undefined;

  if (!resume || resume.action !== 'approve') {
    const resolvedAt = new Date().toISOString();
    const blockedReason = resume?.feedback ?? resolved.pendingApproval.reason;
    task.status = TaskStatus.BLOCKED;
    callbacks.transitionQueueState(task, 'blocked');
    task.approvalFeedback = resume?.feedback;
    task.result = 'Approval rejected. Task is blocked.';
    task.activeInterrupt = task.activeInterrupt
      ? {
          ...task.activeInterrupt,
          status: 'cancelled',
          blockedReason,
          resolvedAt
        }
      : task.activeInterrupt;
    if (task.activeInterrupt) {
      task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
    }
    callbacks.addTrace(
      task,
      resume?.feedback ? 'approval_rejected_with_feedback' : 'approval_gate',
      resume?.feedback
        ? `Approval rejected for ${ActionIntent.INSTALL_SKILL} with feedback: ${resume.feedback}`
        : `Approval rejected for ${ActionIntent.INSTALL_SKILL}`
    );
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: true };
  }

  const resolvedAfterApproval = await callbacks.resolveSkillInstallInterruptResume({
    task,
    receiptId: resolved.pendingExecution.receiptId,
    skillDisplayName: resolved.pendingExecution.skillDisplayName,
    usedInstalledSkills: task.usedInstalledSkills,
    actor: typeof resume.payload?.actor === 'string' ? resume.payload.actor : undefined
  });

  if (resolvedAfterApproval?.skillSearch) {
    task.skillSearch = resolvedAfterApproval.skillSearch;
  }
  if (resolvedAfterApproval?.usedInstalledSkills?.length) {
    task.usedInstalledSkills = Array.from(
      new Set([...(task.usedInstalledSkills ?? []), ...resolvedAfterApproval.usedInstalledSkills])
    );
  }
  if (resolvedAfterApproval?.traceSummary) {
    callbacks.addTrace(task, 'run_resumed', resolvedAfterApproval.traceSummary, {
      interruptId: task.activeInterrupt?.id
    });
  }
  if (resolvedAfterApproval?.progressSummary) {
    callbacks.addProgressDelta(task, resolvedAfterApproval.progressSummary, AgentRole.MANAGER);
  }
  markExecutionStepResumed(task, 'recovery', '审批已通过，恢复直答链。', 'system');
  task.activeInterrupt = task.activeInterrupt
    ? {
        ...task.activeInterrupt,
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      }
    : undefined;
  if (task.activeInterrupt) {
    task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
  }
  callbacks.recordToolUsage(task, {
    toolName: resolved.pendingApproval.toolName,
    status: 'approved',
    requestedBy: typeof resume.payload?.actor === 'string' ? resume.payload.actor : undefined,
    reason: resolved.pendingApproval.reason,
    approvalRequired: false,
    route: 'governance',
    family: 'runtime-governance',
    capabilityType: 'governance-tool',
    riskLevel: 'medium'
  });
  task.pendingApproval = undefined;
  task.pendingAction = undefined;
  task.activeInterrupt = undefined;
  task.status = TaskStatus.RUNNING;
  callbacks.transitionQueueState(task, 'running');
  await callbacks.persistAndEmitTask(task);

  return { ...state, blocked: false };
}

export async function runDirectReplyNode(
  state: DirectReplyInterruptGraphState,
  task: Parameters<DirectReplyInterruptGraphCallbacks['persistAndEmitTask']>[0],
  libu: RouterMinistryLike,
  callbacks: DirectReplyInterruptGraphCallbacks
): Promise<DirectReplyInterruptGraphState> {
  if (state.blocked) {
    return state;
  }
  callbacks.ensureTaskNotCancelled(task);
  await callbacks.runDirectReplyTask(task, libu);
  return {
    ...state,
    blocked: false,
    finalAnswer: task.result
  };
}

export async function runDirectReplyInterruptFinishNode(
  state: DirectReplyInterruptGraphState
): Promise<DirectReplyInterruptGraphState> {
  return state;
}
