import { AgentRole, ApprovalDecision, CreateTaskDto, SourcePolicyMode, ToolUsageSummaryRecord } from '@agent/core';
import type {
  CodeExecutionMinistryLike,
  DeliveryMinistryLike,
  OpsExecutionMinistryLike,
  ResearchMinistryLike,
  ReviewMinistryLike,
  RouterMinistryLike
} from '@agent/core';
import { BaseCheckpointSaver } from '@langchain/langgraph';

import { PendingExecutionContext } from '../../../../flows/approval';
import { runReviewStage } from '../../../../flows/review-stage/review-stage-nodes';
import { runExecuteStage, runResearchStage } from '../../../../flows/runtime-stage/runtime-stage-nodes';
import {
  runDispatchStage,
  runGoalIntakeStage,
  runManagerPlanStage,
  runRouteStage
} from '../../../../bridges/supervisor-runtime-bridge';
import type { RuntimeTaskRecord } from '../../../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../../../types/chat-graph';
import { createAgentGraph } from '../../../chat/chat.graph';

interface TaskPipelineGraphCallbacks {
  ensureTaskNotCancelled: (task: RuntimeTaskRecord) => void;
  syncTaskRuntime: (
    task: RuntimeTaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: RuntimeTaskRecord, subgraphId: 'research' | 'execution' | 'review') => void;
  markWorkerUsage: (task: RuntimeTaskRecord, workerId?: string) => void;
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
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: ToolUsageSummaryRecord['riskLevel'];
      route?: ToolUsageSummaryRecord['route'];
      family?: string;
      capabilityType?: ToolUsageSummaryRecord['capabilityType'];
    }
  ) => void;
  addTrace: (task: RuntimeTaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: RuntimeTaskRecord, content: string, from?: AgentRole) => void;
  setSubTaskStatus: (
    task: RuntimeTaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  addMessage: (
    task: RuntimeTaskRecord,
    type: 'research_result' | 'execution_result' | 'review_result' | 'summary',
    content: string,
    from: AgentRole
  ) => void;
  upsertAgentState: (task: RuntimeTaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: RuntimeTaskRecord) => Promise<void>;
  updateBudgetState: (
    task: RuntimeTaskRecord,
    overrides: Partial<NonNullable<RuntimeTaskRecord['budgetState']>>
  ) => NonNullable<RuntimeTaskRecord['budgetState']>;
  recordDispatches: (task: RuntimeTaskRecord, dispatches: RuntimeAgentGraphState['dispatches']) => void;
  transitionQueueState: (
    task: RuntimeTaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution: (taskId: string, pending: PendingExecutionContext) => void;
  resolveWorkflowRoutes: (
    task: RuntimeTaskRecord,
    workflow?: RuntimeTaskRecord['resolvedWorkflow']
  ) => RuntimeTaskRecord['modelRoute'];
  resolveResearchMinistry: (
    task: RuntimeTaskRecord,
    workflow?: RuntimeTaskRecord['resolvedWorkflow']
  ) => 'hubu-search' | 'libu-delivery';
  resolveExecutionMinistry: (
    task: RuntimeTaskRecord,
    workflow?: RuntimeTaskRecord['resolvedWorkflow']
  ) => 'gongbu-code' | 'bingbu-ops' | 'libu-delivery';
  resolveReviewMinistry: (
    task: RuntimeTaskRecord,
    workflow?: RuntimeTaskRecord['resolvedWorkflow']
  ) => 'xingbu-review' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  describeActionIntent: (intent: string) => string;
  createAgentContext: (taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') => any;
  reviewExecution: (
    task: RuntimeTaskRecord,
    xingbu: ReviewMinistryLike,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ) => Promise<any>;
  persistReviewArtifacts: (
    task: RuntimeTaskRecord,
    goal: string,
    evaluation: any,
    review: any,
    executionSummary: string
  ) => Promise<void>;
  enqueueTaskLearning: (task: RuntimeTaskRecord, userFeedback?: string) => void;
  shouldRunLibuDocsDelivery: (workflow?: RuntimeTaskRecord['resolvedWorkflow']) => boolean;
  buildFreshnessSourceSummary: (task: RuntimeTaskRecord) => string | undefined;
  buildCitationSourceSummary: (task: RuntimeTaskRecord) => string | undefined;
  appendDiagnosisEvidence: (
    task: RuntimeTaskRecord,
    review: any,
    executionSummary: string,
    finalAnswer: string
  ) => void;
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
}

interface TaskPipelineGraphParams {
  task: RuntimeTaskRecord;
  dto: CreateTaskDto;
  options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext };
  libu: RouterMinistryLike;
  hubu: ResearchMinistryLike;
  gongbu: CodeExecutionMinistryLike;
  bingbu: OpsExecutionMinistryLike;
  xingbu: ReviewMinistryLike;
  libuDocs: DeliveryMinistryLike;
  pendingExecutions: Map<string, PendingExecutionContext>;
  llmConfigured: boolean;
  sourcePolicyMode: SourcePolicyMode | undefined;
  callbacks: TaskPipelineGraphCallbacks;
  checkpointer: BaseCheckpointSaver;
}

export function buildTaskPipelineGraph(params: TaskPipelineGraphParams) {
  const {
    task,
    dto,
    options,
    libu,
    hubu,
    gongbu,
    bingbu,
    xingbu,
    libuDocs,
    pendingExecutions,
    llmConfigured,
    sourcePolicyMode,
    callbacks,
    checkpointer
  } = params;

  return createAgentGraph({
    goalIntake: async state => ({
      ...state,
      ...(await runGoalIntakeStage(task, dto, state, options.mode, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
        markWorkerUsage: callbacks.markWorkerUsage,
        recordDispatches: () => undefined
      }))
    }),
    route: async state => ({
      ...state,
      ...(await runRouteStage(task, state, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
        markWorkerUsage: callbacks.markWorkerUsage,
        recordDispatches: () => undefined
      }))
    }),
    managerPlan: async state => ({
      ...state,
      ...(await runManagerPlanStage(task, dto, state, libu, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
        markWorkerUsage: callbacks.markWorkerUsage,
        recordDispatches: () => undefined,
        upsertAgentState: callbacks.upsertAgentState
      }))
    }),
    dispatch: async state => ({
      ...state,
      ...(await runDispatchStage(task, state, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
        markWorkerUsage: callbacks.markWorkerUsage,
        recordDispatches: callbacks.recordDispatches ?? (() => undefined)
      }))
    }),
    research: async state => ({
      ...state,
      ...(await runResearchStage(task, state, hubu, libuDocs, sourcePolicyMode, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        markSubgraph: callbacks.markSubgraph,
        markWorkerUsage: callbacks.markWorkerUsage,
        attachTool: callbacks.attachTool,
        recordToolUsage: callbacks.recordToolUsage,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        setSubTaskStatus: callbacks.setSubTaskStatus,
        addMessage: callbacks.addMessage,
        upsertAgentState: callbacks.upsertAgentState,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        updateBudgetState: callbacks.updateBudgetState,
        transitionQueueState: callbacks.transitionQueueState,
        registerPendingExecution: callbacks.registerPendingExecution,
        resolveResearchMinistry: callbacks.resolveResearchMinistry,
        resolveExecutionMinistry: callbacks.resolveExecutionMinistry,
        getMinistryLabel: callbacks.getMinistryLabel,
        describeActionIntent: callbacks.describeActionIntent,
        createAgentContext: callbacks.createAgentContext,
        resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
        resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume
      }))
    }),
    execute: async state => ({
      ...state,
      ...(await runExecuteStage(task, dto.goal, state, gongbu, bingbu, libuDocs, pendingExecutions, llmConfigured, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        markSubgraph: callbacks.markSubgraph,
        markWorkerUsage: callbacks.markWorkerUsage,
        attachTool: callbacks.attachTool,
        recordToolUsage: callbacks.recordToolUsage,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        setSubTaskStatus: callbacks.setSubTaskStatus,
        addMessage: callbacks.addMessage,
        upsertAgentState: callbacks.upsertAgentState,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        updateBudgetState: callbacks.updateBudgetState,
        transitionQueueState: callbacks.transitionQueueState,
        resolveResearchMinistry: callbacks.resolveResearchMinistry,
        resolveExecutionMinistry: callbacks.resolveExecutionMinistry,
        getMinistryLabel: callbacks.getMinistryLabel,
        describeActionIntent: callbacks.describeActionIntent,
        createAgentContext: callbacks.createAgentContext
      }))
    }),
    review: async state => ({
      ...state,
      ...(await runReviewStage(task, dto.goal, state, libu, libuDocs, xingbu, {
        ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
        syncTaskRuntime: callbacks.syncTaskRuntime,
        markSubgraph: callbacks.markSubgraph,
        markWorkerUsage: callbacks.markWorkerUsage,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        addMessage: callbacks.addMessage,
        upsertAgentState: callbacks.upsertAgentState,
        persistAndEmitTask: callbacks.persistAndEmitTask,
        transitionQueueState: callbacks.transitionQueueState,
        resolveReviewMinistry: callbacks.resolveReviewMinistry,
        getMinistryLabel: callbacks.getMinistryLabel,
        reviewExecution: callbacks.reviewExecution,
        persistReviewArtifacts: callbacks.persistReviewArtifacts,
        enqueueTaskLearning: callbacks.enqueueTaskLearning,
        shouldRunLibuDocsDelivery: callbacks.shouldRunLibuDocsDelivery,
        buildFreshnessSourceSummary: callbacks.buildFreshnessSourceSummary,
        buildCitationSourceSummary: callbacks.buildCitationSourceSummary,
        appendDiagnosisEvidence: callbacks.appendDiagnosisEvidence
      }))
    }),
    finish: async state => {
      callbacks.ensureTaskNotCancelled(task);
      callbacks.syncTaskRuntime(task, {
        currentStep: 'finish',
        retryCount: state.retryCount,
        maxRetries: state.maxRetries
      });
      await callbacks.persistAndEmitTask(task);
      return {
        ...state,
        currentStep: 'finish',
        finalAnswer: task.result ?? state.finalAnswer
      };
    }
  }).compile({ checkpointer });
}
