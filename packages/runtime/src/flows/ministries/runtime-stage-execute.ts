import { ActionIntent, AgentRole, RiskLevel, TaskRecord, TaskStatus } from '@agent/shared';

import { PendingExecutionContext } from '../approval';
import { extendInterruptWithRiskMetadata, extendPendingApprovalWithRiskMetadata } from '../approval/risk-interrupts';
import { setSkillStepStatus } from './runtime-stage-helpers';

type ExecutionApprovalContext = {
  task: TaskRecord;
  pendingExecutions: Map<string, PendingExecutionContext>;
  researchSummary: string;
  execution: {
    intent: ActionIntent;
    toolName: string;
    summary: string;
    serverId?: string;
    capabilityId?: string;
    approvalReason?: string;
    approvalReasonCode?: string;
    approvalPreview?: Array<{
      label: string;
      value: string;
    }>;
    toolInput?: Record<string, unknown>;
    tool?: {
      riskLevel?: RiskLevel;
    };
  };
  callbacks: {
    transitionQueueState: (
      task: TaskRecord,
      status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
    ) => void;
    setSubTaskStatus: (
      task: TaskRecord,
      role: AgentRole,
      status: 'pending' | 'running' | 'completed' | 'blocked'
    ) => void;
    addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
    addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
    describeActionIntent: (intent: string) => string;
  };
};

export function pauseExecutionForApproval({
  task,
  pendingExecutions,
  researchSummary,
  execution,
  callbacks
}: ExecutionApprovalContext): void {
  const isWatchdogInterrupt =
    execution.approvalReasonCode === 'watchdog_timeout' ||
    execution.approvalReasonCode === 'watchdog_interaction_required';
  const approvalReason =
    execution.approvalReason ??
    (isWatchdogInterrupt
      ? `兵部执行 ${execution.toolName} 时检测到长任务停滞或交互阻塞，需人工干预后才能继续。`
      : `准备使用 ${execution.toolName} 执行 ${callbacks.describeActionIntent(execution.intent)}，该动作会影响外部环境，因此需要人工审批。`);

  task.status = TaskStatus.WAITING_APPROVAL;
  callbacks.transitionQueueState(task, 'waiting_approval');
  task.currentNode = isWatchdogInterrupt ? 'runtime_governance_gate' : 'approval_gate';
  task.result = execution.summary;
  task.pendingAction = {
    toolName: execution.toolName,
    intent: execution.intent,
    requestedBy: task.currentMinistry ?? 'gongbu-code',
    riskLevel: execution.tool?.riskLevel
  };
  task.pendingApproval = extendPendingApprovalWithRiskMetadata(
    {
      ...task.pendingAction,
      reason: approvalReason,
      reasonCode: execution.approvalReasonCode,
      serverId: execution.serverId,
      capabilityId: execution.capabilityId,
      preview: execution.approvalPreview
    },
    { requestedBy: task.currentMinistry ?? 'gongbu-code', approvalScope: 'once' }
  );
  task.activeInterrupt = extendInterruptWithRiskMetadata(
    {
      id: `interrupt_${task.id}_execution_approval`,
      status: 'pending',
      mode: 'blocking',
      source: isWatchdogInterrupt ? 'tool' : 'graph',
      origin: isWatchdogInterrupt ? 'timeout' : 'runtime',
      kind: isWatchdogInterrupt ? 'runtime-governance' : 'tool-approval',
      interactionKind: isWatchdogInterrupt ? 'supplemental-input' : 'approval',
      intent: execution.intent,
      toolName: execution.toolName,
      family: 'runtime-governance',
      capabilityType: 'governance-tool',
      requestedBy: task.currentMinistry ?? 'gongbu-code',
      ownerType: 'ministry-owned',
      ownerId: task.currentMinistry ?? 'gongbu-code',
      reason: approvalReason,
      blockedReason: approvalReason,
      riskLevel: execution.tool?.riskLevel ?? 'medium',
      resumeStrategy: 'approval-recovery',
      timeoutMinutes: 30,
      timeoutPolicy: 'reject',
      preview: execution.approvalPreview,
      payload: {
        stage: 'execution',
        serverId: execution.serverId,
        capabilityId: execution.capabilityId,
        watchdog: isWatchdogInterrupt,
        runtimeGovernanceReasonCode: execution.approvalReasonCode,
        recommendedActions: isWatchdogInterrupt
          ? ['continue-waiting', 'cancel-run', 'provide-input']
          : ['approve-once', 'reject']
      },
      createdAt: new Date().toISOString()
    },
    { approvalScope: 'once' }
  );
  task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
  task.approvals.push({
    taskId: task.id,
    intent: execution.intent,
    decision: 'pending',
    decidedAt: new Date().toISOString(),
    reason: approvalReason
  });
  pendingExecutions.set(task.id, {
    taskId: task.id,
    intent: execution.intent,
    toolName: execution.toolName,
    researchSummary,
    toolInput: execution.toolInput,
    currentSkillExecution: task.currentSkillExecution
  });
  setSkillStepStatus(task, 'execute', 'blocked');
  callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
  callbacks.setSubTaskStatus(task, AgentRole.REVIEWER, 'pending');
  callbacks.addTrace(
    task,
    isWatchdogInterrupt ? 'runtime_governance_watchdog' : 'approval_gate',
    isWatchdogInterrupt
      ? `兵部已暂停 ${execution.toolName}，等待处理长任务停滞/交互阻塞。`
      : `执行已暂停：${callbacks.describeActionIntent(execution.intent)} 需要先审批（工具：${execution.toolName}）`,
    isWatchdogInterrupt
      ? {
          toolName: execution.toolName,
          reasonCode: execution.approvalReasonCode,
          serverId: execution.serverId,
          capabilityId: execution.capabilityId
        }
      : undefined
  );
  callbacks.addProgressDelta(
    task,
    isWatchdogInterrupt
      ? `兵部执行已暂停：${execution.toolName} 需要人工处理卡住的运行时操作。`
      : `执行已暂停，准备使用 ${execution.toolName} 执行 ${callbacks.describeActionIntent(execution.intent)}。等待你审批后继续。`,
    AgentRole.EXECUTOR
  );
}
