import { AgentRole, TaskRecord, ToolUsageSummaryRecord } from '@agent/shared';
import { Annotation, BaseCheckpointSaver, END, START, StateGraph } from '@langchain/langgraph';

import { PendingExecutionContext } from '../../../flows/approval';
import {
  runDirectReplyInterruptFinishNode,
  runDirectReplyNode,
  runDirectReplySkillGateNode
} from '../../../flows/chat/direct-reply-interrupt-nodes';
import { LibuRouterMinistry } from '../../../flows/ministries';

// task.activeInterrupt and task.interruptHistory persist 司礼监 / InterruptController state across direct-reply resumes.
export interface DirectReplyInterruptGraphState {
  taskId: string;
  goal: string;
  blocked: boolean;
  finalAnswer?: string;
}

export interface DirectReplyInterruptGraphCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
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
  registerPendingExecution: (taskId: string, pending: PendingExecutionContext) => void;
  resolveRuntimeSkillIntervention: (params: {
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
  runDirectReplyTask: (task: TaskRecord, libu: LibuRouterMinistry) => Promise<void>;
}

const DirectReplyInterruptAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  blocked: Annotation<boolean>(),
  finalAnswer: Annotation<string | undefined>()
});

interface BuildDirectReplyInterruptGraphParams {
  task: TaskRecord;
  libu: LibuRouterMinistry;
  callbacks: DirectReplyInterruptGraphCallbacks;
  checkpointer: BaseCheckpointSaver;
}

export function buildDirectReplyInterruptGraph(params: BuildDirectReplyInterruptGraphParams) {
  const { task, libu, callbacks, checkpointer } = params;

  return new StateGraph(DirectReplyInterruptAnnotation)
    .addNode('skill_gate', state => runDirectReplySkillGateNode(state, task, callbacks))
    .addNode('direct_reply', state => runDirectReplyNode(state, task, libu, callbacks))
    .addNode('finish', runDirectReplyInterruptFinishNode)
    .addEdge(START, 'skill_gate')
    .addConditionalEdges('skill_gate', state => (state.blocked ? 'finish' : 'direct_reply'))
    .addEdge('direct_reply', 'finish')
    .addEdge('finish', END)
    .compile({ checkpointer });
}
