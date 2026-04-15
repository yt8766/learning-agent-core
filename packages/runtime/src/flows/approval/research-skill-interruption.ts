import { ActionIntent, AgentRole, ApprovalResumeInput, TaskRecord, TaskStatus } from '@agent/shared';
import { interrupt } from '@langchain/langgraph';

import type { PendingExecutionContext } from './types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import { markExecutionStepBlocked, markExecutionStepResumed } from '@agent/agents-supervisor';
import { extendInterruptWithRiskMetadata, extendPendingApprovalWithRiskMetadata } from './risk-interrupts';

type PipelineRuntimeCallbacks = {
  attachTool: (
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
  recordToolUsage: (
    task: TaskRecord,
    params: {
      toolName: string;
      status: 'blocked' | 'approved';
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      approvalRequired?: boolean;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      route?: 'local' | 'mcp' | 'governance';
      family?: string;
      capabilityType?: 'local-tool' | 'mcp-capability' | 'governance-tool';
    }
  ) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution?: (taskId: string, pending: PendingExecutionContext) => void;
  resolveRuntimeSkillIntervention?: (params: {
    task: TaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: NonNullable<TaskRecord['skillSearch']>;
    usedInstalledSkills?: string[];
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        progressSummary?: string;
        traceSummary?: string;
        pendingApproval?: {
          toolName: string;
          reason?: string;
          preview?: Array<{
            label: string;
            value: string;
          }>;
        };
        pendingExecution?: {
          receiptId: string;
          skillDisplayName?: string;
        };
      }
    | undefined
  >;
  resolveSkillInstallInterruptResume?: (params: {
    task: TaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        traceSummary?: string;
        progressSummary?: string;
      }
    | undefined
  >;
};

type ResearchSkillInterventionResult =
  | {
      interrupted: false;
    }
  | {
      interrupted: true;
      statePatch: Partial<RuntimeAgentGraphState>;
    };

export async function handleResearchSkillIntervention(
  task: TaskRecord,
  callbacks: PipelineRuntimeCallbacks,
  researchMinistry: 'hubu-search' | 'libu-delivery'
): Promise<ResearchSkillInterventionResult> {
  if (
    !task.skillSearch?.capabilityGapDetected ||
    (task.skillSearch.suggestions.length ?? 0) <= 0 ||
    (task.usedInstalledSkills?.length ?? 0) > 0
  ) {
    return { interrupted: false };
  }

  const resolved = await callbacks.resolveRuntimeSkillIntervention?.({
    task,
    goal: task.goal,
    currentStep: 'research',
    skillSearch: task.skillSearch,
    usedInstalledSkills: task.usedInstalledSkills
  });

  if (resolved?.skillSearch) {
    task.skillSearch = resolved.skillSearch;
  }
  if (resolved?.usedInstalledSkills?.length) {
    task.usedInstalledSkills = Array.from(
      new Set([...(task.usedInstalledSkills ?? []), ...resolved.usedInstalledSkills])
    );
  }
  if (resolved?.traceSummary) {
    callbacks.addTrace(task, 'skill_runtime_intervention', resolved.traceSummary, {
      stage: 'research',
      usedInstalledSkills: resolved.usedInstalledSkills
    });
  }
  if (resolved?.progressSummary) {
    callbacks.addProgressDelta(task, resolved.progressSummary);
  }
  if (!resolved?.pendingApproval || !resolved.pendingExecution?.receiptId) {
    return { interrupted: false };
  }

  const interruptAt = new Date().toISOString();
  task.status = TaskStatus.WAITING_APPROVAL;
  callbacks.transitionQueueState(task, 'waiting_approval');
  task.currentNode = 'approval_gate';
  task.currentStep = 'waiting_skill_install_approval';
  task.pendingAction = {
    toolName: resolved.pendingApproval.toolName,
    intent: ActionIntent.INSTALL_SKILL,
    requestedBy: task.currentMinistry ?? researchMinistry
  };
  task.pendingApproval = extendPendingApprovalWithRiskMetadata(
    {
      ...task.pendingAction,
      reason: resolved.pendingApproval.reason,
      preview: resolved.pendingApproval.preview
    },
    { requestedBy: task.currentMinistry ?? researchMinistry, approvalScope: 'once' }
  );
  task.activeInterrupt = extendInterruptWithRiskMetadata(
    {
      id: `interrupt_${task.id}_research_skill_install`,
      status: 'pending',
      mode: 'blocking',
      source: 'graph',
      origin: 'runtime',
      kind: 'skill-install',
      intent: ActionIntent.INSTALL_SKILL,
      toolName: resolved.pendingApproval.toolName,
      family: 'runtime-governance',
      capabilityType: 'governance-tool',
      requestedBy: task.currentMinistry ?? researchMinistry,
      ownerType: 'ministry-owned',
      ownerId: task.currentMinistry ?? researchMinistry,
      reason: resolved.pendingApproval.reason,
      blockedReason: resolved.pendingApproval.reason,
      riskLevel: 'medium',
      resumeStrategy: 'command',
      preview: resolved.pendingApproval.preview,
      payload: {
        stage: 'research',
        receiptId: resolved.pendingExecution.receiptId,
        skillDisplayName: resolved.pendingExecution.skillDisplayName
      },
      createdAt: interruptAt
    },
    { approvalScope: 'once' }
  );
  task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
  callbacks.attachTool(task, {
    toolName: resolved.pendingApproval.toolName,
    attachedBy: 'runtime',
    preferred: true,
    reason: resolved.pendingApproval.reason,
    ownerType: 'ministry-owned',
    ownerId: task.currentMinistry ?? researchMinistry,
    family: 'runtime-governance'
  });
  callbacks.recordToolUsage(task, {
    toolName: resolved.pendingApproval.toolName,
    status: 'blocked',
    requestedBy: task.currentMinistry ?? researchMinistry,
    reason: resolved.pendingApproval.reason,
    blockedReason: resolved.pendingApproval.reason,
    approvalRequired: true,
    route: 'governance',
    family: 'runtime-governance',
    capabilityType: 'governance-tool',
    riskLevel: 'medium'
  });
  task.approvals.push({
    taskId: task.id,
    intent: ActionIntent.INSTALL_SKILL,
    decision: 'pending',
    decidedAt: new Date().toISOString(),
    reason: resolved.pendingApproval.reason
  });
  callbacks.registerPendingExecution?.(task.id, {
    taskId: task.id,
    intent: ActionIntent.INSTALL_SKILL,
    toolName: resolved.pendingApproval.toolName,
    researchSummary: task.goal,
    kind: 'skill_install',
    receiptId: resolved.pendingExecution.receiptId,
    goal: task.goal,
    usedInstalledSkills: task.usedInstalledSkills,
    skillDisplayName: resolved.pendingExecution.skillDisplayName
  });
  task.currentSkillExecution =
    task.currentSkillExecution?.phase === 'research'
      ? {
          ...task.currentSkillExecution,
          updatedAt: new Date().toISOString()
        }
      : task.currentSkillExecution;
  callbacks.setSubTaskStatus(task, AgentRole.RESEARCH, 'blocked');
  callbacks.addTrace(
    task,
    'approval_gate',
    `户部发现当前轮仍缺少关键 skill，已暂停等待安装 ${resolved.pendingExecution.skillDisplayName ?? '远程 skill'}。`,
    {
      stage: 'research',
      receiptId: resolved.pendingExecution.receiptId,
      skillDisplayName: resolved.pendingExecution.skillDisplayName
    }
  );
  callbacks.addProgressDelta(
    task,
    `户部发现需要先安装 ${resolved.pendingExecution.skillDisplayName ?? '远程 skill'}，当前轮已暂停等待审批。`,
    AgentRole.RESEARCH
  );
  markExecutionStepBlocked(
    task,
    'approval-interrupt',
    resolved.pendingApproval.reason,
    '研究阶段已暂停等待审批。',
    'system'
  );
  await callbacks.persistAndEmitTask(task);
  const resume = interrupt({
    interruptId: task.activeInterrupt.id,
    kind: 'skill-install',
    mode: 'blocking',
    toolName: resolved.pendingApproval.toolName,
    intent: ActionIntent.INSTALL_SKILL,
    reason: resolved.pendingApproval.reason,
    preview: resolved.pendingApproval.preview,
    payload: {
      stage: 'research',
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
    return {
      interrupted: true,
      statePatch: {
        currentStep: 'research',
        approvalRequired: true,
        approvalStatus: 'pending',
        resumeFromApproval: false,
        shouldRetry: false
      }
    };
  }

  const resolvedAfterApproval = await callbacks.resolveSkillInstallInterruptResume?.({
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
    callbacks.addProgressDelta(task, resolvedAfterApproval.progressSummary);
  }
  markExecutionStepResumed(task, 'recovery', '审批已通过，恢复研究阶段。', 'system');
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
  return { interrupted: false };
}
