import {
  ActionIntent,
  AgentRole,
  ApprovalResumeInput,
  TaskRecord,
  TaskStatus,
  ToolUsageSummaryRecord
} from '@agent/shared';
import { Annotation, BaseCheckpointSaver, END, interrupt, START, StateGraph } from '@langchain/langgraph';

import { PendingExecutionContext } from '../../../flows/approval';
import {
  runPreExecutionSkillGateNode,
  runTaskBootstrapFinishNode
} from '../../../flows/approval/bootstrap-interrupt-nodes';

// task.activeInterrupt and task.interruptHistory persist 司礼监 / InterruptController state across bootstrap resumes.
export interface TaskBootstrapGraphState {
  taskId: string;
  goal: string;
  blocked: boolean;
}

export interface TaskBootstrapCallbacks {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
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
      status: ToolUsageSummaryRecord['status'];
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      approvalRequired?: boolean;
      riskLevel?: ToolUsageSummaryRecord['riskLevel'];
      route?: ToolUsageSummaryRecord['route'];
      family?: string;
      capabilityType?: ToolUsageSummaryRecord['capabilityType'];
    }
  ) => void;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution: (taskId: string, pending: PendingExecutionContext) => void;
  resolvePreExecutionSkillIntervention: (params: {
    goal: string;
    taskId: string;
    runId: string;
    sessionId?: string;
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
  resolveSkillInstallInterruptResume: (params: {
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
}

const TaskBootstrapAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  blocked: Annotation<boolean>()
});

interface BuildTaskBootstrapInterruptGraphParams {
  task: TaskRecord;
  callbacks: TaskBootstrapCallbacks;
  checkpointer: BaseCheckpointSaver;
}

export function buildTaskBootstrapInterruptGraph(params: BuildTaskBootstrapInterruptGraphParams) {
  const { task, callbacks, checkpointer } = params;

  return new StateGraph(TaskBootstrapAnnotation)
    .addNode('pre_execution_skill_gate', state => runPreExecutionSkillGateNode(state, task, callbacks))
    .addNode('finish', runTaskBootstrapFinishNode)
    .addEdge(START, 'pre_execution_skill_gate')
    .addEdge('pre_execution_skill_gate', 'finish')
    .addEdge('finish', END)
    .compile({ checkpointer });
}
