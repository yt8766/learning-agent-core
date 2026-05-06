import { ActionIntent, AgentRole, TaskStatus } from '@agent/core';
import { interrupt } from '@langchain/langgraph';

import type {
  TaskBootstrapCallbacks,
  TaskBootstrapGraphState
} from '../../../graphs/main/execution/pipeline/task-bootstrap-interrupt-graph';
import { markExecutionStepBlocked, markExecutionStepResumed } from '../../../bridges/supervisor-runtime-bridge';
import { recordPendingApprovalOnce, recordPendingInterruptOnce } from '../interrupt-idempotency';
import { extendInterruptWithRiskMetadata, extendPendingApprovalWithRiskMetadata } from '../risk-interrupts';
import type { ApprovalResumeInput } from '../../../index';

export async function runPreExecutionSkillGateNode(
  state: TaskBootstrapGraphState,
  task: Parameters<TaskBootstrapCallbacks['persistAndEmitTask']>[0],
  callbacks: TaskBootstrapCallbacks
): Promise<TaskBootstrapGraphState> {
  if (!task.skillSearch || !task.runId) {
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: false };
  }

  const intervention = await callbacks.resolvePreExecutionSkillIntervention({
    goal: task.goal,
    taskId: task.id,
    runId: task.runId,
    sessionId: task.sessionId,
    skillSearch: task.skillSearch,
    usedInstalledSkills: task.usedInstalledSkills
  });

  if (intervention?.skillSearch) {
    task.skillSearch = intervention.skillSearch;
  }
  if (intervention?.usedInstalledSkills?.length) {
    task.usedInstalledSkills = Array.from(
      new Set([...(task.usedInstalledSkills ?? []), ...intervention.usedInstalledSkills])
    );
  }
  if (intervention?.traceSummary) {
    callbacks.addTrace(task, 'skill_runtime_intervention', intervention.traceSummary, {
      stage: 'pre_execution',
      usedInstalledSkills: intervention.usedInstalledSkills
    });
  }
  if (intervention?.progressSummary) {
    callbacks.addProgressDelta(task, intervention.progressSummary);
  }

  if (!intervention?.pendingApproval || !intervention.pendingExecution) {
    await callbacks.persistAndEmitTask(task);
    return { ...state, blocked: false };
  }

  const interruptId = `interrupt_${task.id}_pre_execution_skill_install`;
  const isPendingReplay = task.activeInterrupt?.id === interruptId && task.activeInterrupt.status === 'pending';
  const now = task.activeInterrupt?.createdAt ?? new Date().toISOString();
  task.status = TaskStatus.WAITING_APPROVAL;
  task.currentNode = 'approval_gate';
  task.currentStep = 'waiting_skill_install_approval';
  callbacks.transitionQueueState(task, 'waiting_approval');
  task.pendingApproval = extendPendingApprovalWithRiskMetadata(
    {
      toolName: intervention.pendingApproval.toolName,
      intent: ActionIntent.INSTALL_SKILL,
      riskLevel: 'medium',
      requestedBy: 'libu-governance',
      reason: intervention.pendingApproval.reason,
      reasonCode: 'requires_approval_governance',
      preview: intervention.pendingApproval.preview
    },
    { requestedBy: 'libu-governance', approvalScope: 'once' }
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
          toolName: intervention.pendingApproval.toolName,
          family: 'runtime-governance',
          capabilityType: 'governance-tool',
          requestedBy: 'libu-governance',
          ownerType: 'ministry-owned',
          ownerId: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          blockedReason: intervention.pendingApproval.reason,
          riskLevel: 'medium',
          resumeStrategy: 'command',
          preview: intervention.pendingApproval.preview,
          payload: {
            stage: 'pre_execution',
            receiptId: intervention.pendingExecution.receiptId,
            skillDisplayName: intervention.pendingExecution.skillDisplayName
          },
          createdAt: now
        },
        { approvalScope: 'once' }
      );
  const activeInterrupt = task.activeInterrupt;
  if (!activeInterrupt) {
    throw new Error('Pre-execution skill install interrupt was not initialized.');
  }
  const isFirstPendingInterrupt = recordPendingInterruptOnce(task, activeInterrupt);
  if (isFirstPendingInterrupt) {
    callbacks.attachTool(task, {
      toolName: intervention.pendingApproval.toolName,
      attachedBy: 'runtime',
      preferred: true,
      reason: intervention.pendingApproval.reason,
      ownerType: 'ministry-owned',
      ownerId: 'libu-governance',
      family: 'runtime-governance'
    });
    callbacks.recordToolUsage(task, {
      toolName: intervention.pendingApproval.toolName,
      status: 'blocked',
      requestedBy: 'libu-governance',
      reason: intervention.pendingApproval.reason,
      blockedReason: intervention.pendingApproval.reason,
      approvalRequired: true,
      route: 'governance',
      family: 'runtime-governance',
      capabilityType: 'governance-tool',
      riskLevel: 'medium'
    });
    recordPendingApprovalOnce(task, {
      taskId: task.id,
      intent: ActionIntent.INSTALL_SKILL,
      reason: intervention.pendingApproval.reason,
      actor: 'runtime-auto-pre-execution',
      decision: 'pending',
      decidedAt: now
    });
  }
  callbacks.registerPendingExecution(task.id, {
    taskId: task.id,
    intent: ActionIntent.INSTALL_SKILL,
    toolName: intervention.pendingApproval.toolName,
    researchSummary: task.goal,
    kind: 'skill_install',
    receiptId: intervention.pendingExecution.receiptId,
    goal: task.goal,
    usedInstalledSkills: task.usedInstalledSkills,
    currentSkillExecution: task.currentSkillExecution,
    skillDisplayName: intervention.pendingExecution.skillDisplayName
  });
  if (isFirstPendingInterrupt) {
    callbacks.addTrace(
      task,
      'approval_gate',
      intervention.pendingApproval.reason ?? '检测到远程 skill 安装需要审批。',
      {
        stage: 'pre_execution',
        receiptId: intervention.pendingExecution.receiptId,
        skillDisplayName: intervention.pendingExecution.skillDisplayName,
        intent: ActionIntent.INSTALL_SKILL
      }
    );
    callbacks.addProgressDelta(
      task,
      `当前轮需要先确认安装 ${intervention.pendingExecution.skillDisplayName ?? '远程 skill'}。`
    );
    markExecutionStepBlocked(
      task,
      'approval-interrupt',
      intervention.pendingApproval.reason,
      '预执行阶段已暂停等待审批。',
      'system'
    );
  }
  await callbacks.persistAndEmitTask(task);

  const resume = interrupt({
    interruptId: activeInterrupt.id,
    kind: 'skill-install',
    mode: 'blocking',
    toolName: intervention.pendingApproval.toolName,
    intent: ActionIntent.INSTALL_SKILL,
    reason: intervention.pendingApproval.reason,
    preview: intervention.pendingApproval.preview,
    payload: {
      stage: 'pre_execution',
      receiptId: intervention.pendingExecution.receiptId,
      skillDisplayName: intervention.pendingExecution.skillDisplayName
    }
  }) as ApprovalResumeInput | undefined;

  if (!resume || resume.action !== 'approve') {
    const resolvedAt = new Date().toISOString();
    const blockedReason = resume?.feedback ?? intervention.pendingApproval.reason;
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
    receiptId: intervention.pendingExecution.receiptId,
    skillDisplayName: intervention.pendingExecution.skillDisplayName,
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
      interruptId: task.activeInterrupt?.id,
      stage: 'pre_execution'
    });
  }
  if (resolvedAfterApproval?.progressSummary) {
    callbacks.addProgressDelta(task, resolvedAfterApproval.progressSummary);
  }
  markExecutionStepResumed(task, 'recovery', '审批已通过，恢复预执行阶段。', 'system');
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
    toolName: intervention.pendingApproval.toolName,
    status: 'approved',
    requestedBy: typeof resume.payload?.actor === 'string' ? resume.payload.actor : undefined,
    reason: intervention.pendingApproval.reason,
    approvalRequired: false,
    route: 'governance',
    family: 'runtime-governance',
    capabilityType: 'governance-tool',
    riskLevel: 'medium'
  });
  task.pendingApproval = undefined;
  task.pendingAction = undefined;
  task.activeInterrupt = undefined;
  task.status = TaskStatus.QUEUED;
  callbacks.transitionQueueState(task, 'queued');
  await callbacks.persistAndEmitTask(task);

  return { ...state, blocked: false };
}

export async function runTaskBootstrapFinishNode(state: TaskBootstrapGraphState): Promise<TaskBootstrapGraphState> {
  return state;
}
