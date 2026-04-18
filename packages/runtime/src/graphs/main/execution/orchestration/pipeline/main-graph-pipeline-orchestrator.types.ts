import type { AgentRoleValue as AgentRole, SourcePolicyMode } from '@agent/core';
import type { ApprovalResumeInput, CreateTaskDto, ToolUsageSummaryRecord, WorkflowPresetDefinition } from '@agent/core';
import { ActionIntent } from '@agent/core';
import type { ReviewMinistryLike, RouterMinistryLike } from '@agent/core';
import type { BaseCheckpointSaver } from '@langchain/langgraph';

import type { PendingExecutionContext } from '../../../../../flows/approval';
import type { AgentRuntimeContext } from '../../../../../runtime/agent-runtime-context';
import type { RuntimeTaskRecord as TaskRecord } from '../../../../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../../../../types/chat-graph';

export type TaskMode = 'initial' | 'retry' | 'approval_resume';
export type GraphTaskMode = TaskMode | 'interrupt_resume';

export interface TaskPipelineCallbacks {
  createAgentContext: (taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') => AgentRuntimeContext;
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: TaskRecord, subgraphId: 'research' | 'execution' | 'review') => void;
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
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
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: ToolUsageSummaryRecord['riskLevel'];
      route?: ToolUsageSummaryRecord['route'];
      family?: string;
      capabilityType?: ToolUsageSummaryRecord['capabilityType'];
    }
  ) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  addMessage: (
    task: TaskRecord,
    type: 'research_result' | 'execution_result' | 'review_result' | 'summary',
    content: string,
    from: AgentRole
  ) => void;
  upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  updateBudgetState: (
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ) => NonNullable<TaskRecord['budgetState']>;
  transitionQueueState: (task: TaskRecord, status: NonNullable<TaskRecord['queueState']>['status']) => void;
  registerPendingExecution: (taskId: string, pending: PendingExecutionContext) => void;
  resolveWorkflowRoutes: (task: TaskRecord, workflow?: WorkflowPresetDefinition) => TaskRecord['modelRoute'];
  resolveResearchMinistry: (task: TaskRecord, workflow?: WorkflowPresetDefinition) => 'hubu-search' | 'libu-delivery';
  resolveExecutionMinistry: (
    task: TaskRecord,
    workflow?: WorkflowPresetDefinition
  ) => 'gongbu-code' | 'bingbu-ops' | 'libu-delivery';
  resolveReviewMinistry: (task: TaskRecord, workflow?: WorkflowPresetDefinition) => 'xingbu-review' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  describeActionIntent: (intent: string) => string;
  reviewExecution: (
    task: TaskRecord,
    xingbu: ReviewMinistryLike,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ) => Promise<any>;
  persistReviewArtifacts: (
    task: TaskRecord,
    goal: string,
    evaluation: any,
    review: any,
    executionSummary: string
  ) => Promise<void>;
  enqueueTaskLearning: (task: TaskRecord, userFeedback?: string) => void;
  shouldRunLibuDocsDelivery: (workflow?: WorkflowPresetDefinition) => boolean;
  buildFreshnessSourceSummary: (task: TaskRecord) => string | undefined;
  buildCitationSourceSummary: (task: TaskRecord) => string | undefined;
  appendDiagnosisEvidence: (task: TaskRecord, review: any, executionSummary: string, finalAnswer: string) => void;
  recordDispatches: (task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']) => void;
  resolveTaskFlow: (task: TaskRecord, goal: string, mode: TaskMode) => NonNullable<TaskRecord['chatRoute']>;
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
  createGraphStartState: (
    task: TaskRecord,
    dto: CreateTaskDto,
    libu: RouterMinistryLike,
    options: { mode: TaskMode; pending?: PendingExecutionContext }
  ) => RuntimeAgentGraphState;
  resolveGraphThreadId: (task: TaskRecord) => string;
  getGraphCheckpointer: () => BaseCheckpointSaver;
  runDirectReplyTask: (task: TaskRecord, libu: RouterMinistryLike) => Promise<void>;
  recordAgentError: (
    task: TaskRecord,
    error: unknown,
    context: {
      phase: 'task_pipeline' | 'approval_recovery';
      mode?: TaskMode;
      goal?: string;
      routeFlow?: string;
      toolName?: string;
      intent?: (typeof ActionIntent)[keyof typeof ActionIntent];
    }
  ) => void;
}

export interface ApprovalRecoveryCallbacks {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  recordAgentError: TaskPipelineCallbacks['recordAgentError'];
  transitionQueueState: TaskPipelineCallbacks['transitionQueueState'];
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
}

export interface RunTaskPipelineParams {
  task: TaskRecord;
  dto: CreateTaskDto;
  options: { mode: GraphTaskMode; pending?: PendingExecutionContext; resume?: ApprovalResumeInput };
  pendingExecutions: Map<string, PendingExecutionContext>;
  llmConfigured: boolean;
  sourcePolicyMode: SourcePolicyMode | undefined;
  callbacks: TaskPipelineCallbacks;
}
