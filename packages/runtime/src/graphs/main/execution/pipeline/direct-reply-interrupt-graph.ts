import { AgentRole, type AgentRoleValue, type RouterMinistryLike } from '@agent/core';
import { Annotation, BaseCheckpointSaver, END, START, StateGraph } from '@langchain/langgraph';

import { PendingExecutionContext } from '../../../../flows/approval';
import {
  runDirectReplyInterruptFinishNode,
  runDirectReplyNode,
  runDirectReplySkillGateNode
} from '../../../../flows/chat/direct-reply/direct-reply-interrupt-nodes';
import type { RuntimeTaskRecord } from '../../../../runtime/runtime-task.types';
import type { ToolUsageSummaryRecord } from '@agent/runtime';
// task.activeInterrupt and task.interruptHistory persist 司礼监 / InterruptController state across direct-reply resumes.
export interface DirectReplyInterruptGraphState {
  taskId: string;
  goal: string;
  blocked: boolean;
  finalAnswer?: string;
}

export interface DirectReplyInterruptGraphCallbacks {
  ensureTaskNotCancelled: (task: RuntimeTaskRecord) => void;
  attachTool: (
    task: RuntimeTaskRecord,
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
    task: RuntimeTaskRecord,
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
  addTrace: (task: RuntimeTaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: RuntimeTaskRecord, content: string, from?: AgentRoleValue) => void;
  setSubTaskStatus: (
    task: RuntimeTaskRecord,
    role: AgentRoleValue,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  persistAndEmitTask: (task: RuntimeTaskRecord) => Promise<void>;
  transitionQueueState: (
    task: RuntimeTaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution: (taskId: string, pending: PendingExecutionContext) => void;
  resolveRuntimeSkillIntervention: (params: {
    task: RuntimeTaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: NonNullable<RuntimeTaskRecord['skillSearch']>;
    usedInstalledSkills?: string[];
  }) => Promise<
    | {
        skillSearch?: NonNullable<RuntimeTaskRecord['skillSearch']>;
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
    task: RuntimeTaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) => Promise<
    | {
        skillSearch?: NonNullable<RuntimeTaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        traceSummary?: string;
        progressSummary?: string;
      }
    | undefined
  >;
  runDirectReplyTask: (task: RuntimeTaskRecord, libu: RouterMinistryLike) => Promise<void>;
}

const DirectReplyInterruptAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  blocked: Annotation<boolean>(),
  finalAnswer: Annotation<string | undefined>()
});

interface BuildDirectReplyInterruptGraphParams {
  task: RuntimeTaskRecord;
  libu: RouterMinistryLike;
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
