import { ActionIntent, AgentRole, RiskLevel, TaskRecord, TaskStatus } from '@agent/shared';
import { PendingExecutionContext } from '../../../flows/approval';
import { setSkillStepStatus } from './main-graph-pipeline-runtime-helpers';

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
  const approvalReason =
    execution.approvalReason ??
    `准备使用 ${execution.toolName} 执行 ${callbacks.describeActionIntent(execution.intent)}，该动作会影响外部环境，因此需要人工审批。`;

  task.status = TaskStatus.WAITING_APPROVAL;
  callbacks.transitionQueueState(task, 'waiting_approval');
  task.currentNode = 'approval_gate';
  task.result = execution.summary;
  task.pendingAction = {
    toolName: execution.toolName,
    intent: execution.intent,
    requestedBy: task.currentMinistry ?? 'gongbu-code',
    riskLevel: execution.tool?.riskLevel
  };
  task.pendingApproval = {
    ...task.pendingAction,
    reason: approvalReason,
    reasonCode: execution.approvalReasonCode,
    serverId: execution.serverId,
    capabilityId: execution.capabilityId,
    preview: execution.approvalPreview
  };
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
    currentSkillExecution: task.currentSkillExecution
  });
  setSkillStepStatus(task, 'execute', 'blocked');
  callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
  callbacks.setSubTaskStatus(task, AgentRole.REVIEWER, 'pending');
  callbacks.addTrace(
    task,
    'approval_gate',
    `执行已暂停：${callbacks.describeActionIntent(execution.intent)} 需要先审批（工具：${execution.toolName}）`
  );
  callbacks.addProgressDelta(
    task,
    `执行已暂停，准备使用 ${execution.toolName} 执行 ${callbacks.describeActionIntent(execution.intent)}。等待你审批后继续。`,
    AgentRole.EXECUTOR
  );
}
