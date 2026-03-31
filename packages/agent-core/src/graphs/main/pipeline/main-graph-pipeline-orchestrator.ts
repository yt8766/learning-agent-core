import {
  ActionIntent,
  AgentRole,
  ApprovalResumeInput,
  CreateTaskDto,
  SourcePolicyMode,
  TaskRecord,
  TaskStatus,
  ToolUsageSummaryRecord,
  WorkflowPresetDefinition
} from '@agent/shared';
import { BaseCheckpointSaver, Command } from '@langchain/langgraph';

import {
  BingbuOpsMinistry,
  GongbuCodeMinistry,
  HubuSearchMinistry,
  LibuDocsMinistry,
  LibuRouterMinistry,
  XingbuReviewMinistry
} from '../../../flows/ministries';
import { PendingExecutionContext } from '../../../flows/approval';
import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { RuntimeAgentGraphState } from '../../chat.graph';
import { buildTaskPipelineGraph } from './main-graph-pipeline-graph';
import { buildDirectReplyInterruptGraph } from './direct-reply-interrupt-graph';
import { TaskBudgetExceededError, TaskCancelledError } from '../main-graph-task-runtime';

type TaskMode = 'initial' | 'retry' | 'approval_resume';
type GraphTaskMode = TaskMode | 'interrupt_resume';

interface TaskPipelineCallbacks {
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
    xingbu: XingbuReviewMinistry,
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
    libu: LibuRouterMinistry,
    options: { mode: TaskMode; pending?: PendingExecutionContext }
  ) => RuntimeAgentGraphState;
  resolveGraphThreadId: (task: TaskRecord) => string;
  getGraphCheckpointer: () => BaseCheckpointSaver;
  runDirectReplyTask: (task: TaskRecord, libu: LibuRouterMinistry) => Promise<void>;
  recordAgentError: (
    task: TaskRecord,
    error: unknown,
    context: {
      phase: 'task_pipeline' | 'approval_recovery';
      mode?: TaskMode;
      goal?: string;
      routeFlow?: string;
      toolName?: string;
      intent?: ActionIntent;
    }
  ) => void;
}

interface ApprovalRecoveryCallbacks {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  recordAgentError: TaskPipelineCallbacks['recordAgentError'];
  transitionQueueState: TaskPipelineCallbacks['transitionQueueState'];
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
}

interface RunTaskPipelineParams {
  task: TaskRecord;
  dto: CreateTaskDto;
  options: { mode: GraphTaskMode; pending?: PendingExecutionContext; resume?: ApprovalResumeInput };
  pendingExecutions: Map<string, PendingExecutionContext>;
  llmConfigured: boolean;
  sourcePolicyMode: SourcePolicyMode | undefined;
  callbacks: TaskPipelineCallbacks;
}

export async function runTaskPipelineWithGraph(params: RunTaskPipelineParams): Promise<void> {
  const { task, dto, options, pendingExecutions, llmConfigured, sourcePolicyMode, callbacks } = params;
  const graphMode: TaskMode = options.mode === 'interrupt_resume' ? 'initial' : options.mode;
  // task.activeInterrupt is the persisted 司礼监 / InterruptController projection used to resume the right stage.
  const interruptStage =
    task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
      ? (task.activeInterrupt.payload as { stage?: unknown }).stage
      : undefined;

  if (options.mode === 'interrupt_resume' && options.resume) {
    const libu = new LibuRouterMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
    if (interruptStage === 'direct_reply') {
      const graph = buildDirectReplyInterruptGraph({
        task,
        libu,
        callbacks: {
          ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
          attachTool: callbacks.attachTool,
          recordToolUsage: callbacks.recordToolUsage,
          addTrace: callbacks.addTrace,
          addProgressDelta: callbacks.addProgressDelta,
          setSubTaskStatus: callbacks.setSubTaskStatus,
          persistAndEmitTask: callbacks.persistAndEmitTask,
          transitionQueueState: callbacks.transitionQueueState,
          registerPendingExecution: callbacks.registerPendingExecution,
          resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
          resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume,
          runDirectReplyTask: callbacks.runDirectReplyTask
        },
        checkpointer: callbacks.getGraphCheckpointer()
      });
      await graph.invoke(new Command({ resume: options.resume }), {
        configurable: {
          thread_id: callbacks.resolveGraphThreadId(task)
        }
      });
    } else {
      const graph = buildTaskPipelineGraph({
        task,
        dto,
        options: { mode: 'initial' },
        libu,
        hubu: new HubuSearchMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat')),
        gongbu: new GongbuCodeMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat')),
        bingbu: new BingbuOpsMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat')),
        xingbu: new XingbuReviewMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat')),
        libuDocs: new LibuDocsMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat')),
        pendingExecutions,
        llmConfigured,
        sourcePolicyMode,
        callbacks: {
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
          resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
          resolveResearchMinistry: callbacks.resolveResearchMinistry,
          resolveExecutionMinistry: callbacks.resolveExecutionMinistry,
          resolveReviewMinistry: callbacks.resolveReviewMinistry,
          getMinistryLabel: callbacks.getMinistryLabel,
          describeActionIntent: callbacks.describeActionIntent,
          createAgentContext: callbacks.createAgentContext,
          reviewExecution: callbacks.reviewExecution,
          persistReviewArtifacts: callbacks.persistReviewArtifacts,
          enqueueTaskLearning: callbacks.enqueueTaskLearning,
          shouldRunLibuDocsDelivery: callbacks.shouldRunLibuDocsDelivery,
          buildFreshnessSourceSummary: callbacks.buildFreshnessSourceSummary,
          buildCitationSourceSummary: callbacks.buildCitationSourceSummary,
          appendDiagnosisEvidence: callbacks.appendDiagnosisEvidence,
          recordDispatches: callbacks.recordDispatches,
          resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
          resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume
        },
        checkpointer: callbacks.getGraphCheckpointer()
      });
      await graph.invoke(new Command({ resume: options.resume }), {
        configurable: {
          thread_id: callbacks.resolveGraphThreadId(task)
        }
      });
    }
    await callbacks.persistAndEmitTask(task);
    return;
  }

  task.status = TaskStatus.RUNNING;
  callbacks.transitionQueueState(task, 'running');
  task.skillStage = 'preset_plan_expansion';
  task.currentNode = 'supervisor_plan';
  task.updatedAt = new Date().toISOString();
  callbacks.addTrace(
    task,
    'skill_stage_started',
    `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 进入计划展开阶段。`,
    {
      skillId: task.skillId,
      skillStage: task.skillStage
    }
  );
  task.result = undefined;
  await callbacks.persistAndEmitTask(task);

  const libu = new LibuRouterMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
  const hubu = new HubuSearchMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
  const gongbu = new GongbuCodeMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
  const bingbu = new BingbuOpsMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
  const xingbu = new XingbuReviewMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));
  const libuDocs = new LibuDocsMinistry(callbacks.createAgentContext(task.id, dto.goal, 'chat'));

  try {
    callbacks.ensureTaskNotCancelled(task);
    const workflowRoute = callbacks.resolveTaskFlow(task, dto.goal, graphMode);
    task.chatRoute = workflowRoute;
    callbacks.addTrace(task, 'route', `聊天入口已选择 ${workflowRoute.flow} 流程。`, {
      adapter: workflowRoute.adapter,
      priority: workflowRoute.priority,
      reason: workflowRoute.reason,
      flow: workflowRoute.flow,
      graph: workflowRoute.graph
    });
    await callbacks.persistAndEmitTask(task);

    if (workflowRoute.flow === 'direct-reply') {
      const graph = buildDirectReplyInterruptGraph({
        task,
        libu,
        callbacks: {
          ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
          attachTool: callbacks.attachTool,
          recordToolUsage: callbacks.recordToolUsage,
          addTrace: callbacks.addTrace,
          addProgressDelta: callbacks.addProgressDelta,
          setSubTaskStatus: callbacks.setSubTaskStatus,
          persistAndEmitTask: callbacks.persistAndEmitTask,
          transitionQueueState: callbacks.transitionQueueState,
          registerPendingExecution: callbacks.registerPendingExecution,
          resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
          resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume,
          runDirectReplyTask: callbacks.runDirectReplyTask
        },
        checkpointer: callbacks.getGraphCheckpointer()
      });
      await graph.invoke(
        {
          taskId: task.id,
          goal: dto.goal,
          blocked: false,
          finalAnswer: undefined
        },
        {
          configurable: {
            thread_id: callbacks.resolveGraphThreadId(task)
          }
        }
      );
      await callbacks.persistAndEmitTask(task);
      return;
    }

    const graph = buildTaskPipelineGraph({
      task,
      dto,
      options: { mode: graphMode, pending: options.pending },
      libu,
      hubu,
      gongbu,
      bingbu,
      xingbu,
      libuDocs,
      pendingExecutions,
      llmConfigured,
      sourcePolicyMode,
      callbacks: {
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
        resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
        resolveResearchMinistry: callbacks.resolveResearchMinistry,
        resolveExecutionMinistry: callbacks.resolveExecutionMinistry,
        resolveReviewMinistry: callbacks.resolveReviewMinistry,
        getMinistryLabel: callbacks.getMinistryLabel,
        describeActionIntent: callbacks.describeActionIntent,
        createAgentContext: callbacks.createAgentContext,
        reviewExecution: callbacks.reviewExecution,
        persistReviewArtifacts: callbacks.persistReviewArtifacts,
        enqueueTaskLearning: callbacks.enqueueTaskLearning,
        shouldRunLibuDocsDelivery: callbacks.shouldRunLibuDocsDelivery,
        buildFreshnessSourceSummary: callbacks.buildFreshnessSourceSummary,
        buildCitationSourceSummary: callbacks.buildCitationSourceSummary,
        appendDiagnosisEvidence: callbacks.appendDiagnosisEvidence,
        recordDispatches: callbacks.recordDispatches,
        resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
        resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume
      },
      checkpointer: callbacks.getGraphCheckpointer()
    });

    await graph.invoke(
      callbacks.createGraphStartState(task, dto, libu, { mode: graphMode, pending: options.pending }),
      {
        configurable: {
          thread_id: callbacks.resolveGraphThreadId(task)
        }
      }
    );
    await callbacks.persistAndEmitTask(task);
  } catch (error) {
    if (error instanceof TaskCancelledError) {
      await callbacks.persistAndEmitTask(task);
      return;
    }
    if (error instanceof TaskBudgetExceededError) {
      task.status = TaskStatus.BLOCKED;
      callbacks.transitionQueueState(task, 'blocked');
      task.currentNode = 'budget_governance';
      task.currentStep = 'budget_exhausted';
      task.result = error.message;
      task.updatedAt = new Date().toISOString();
      callbacks.addTrace(task, 'budget_exhausted', error.message, error.detail);
      callbacks.addProgressDelta(task, error.message);
      await callbacks.persistAndEmitTask(task);
      return;
    }
    callbacks.recordAgentError(task, error, {
      phase: 'task_pipeline',
      mode: graphMode,
      goal: dto.goal,
      routeFlow: task.chatRoute?.flow
    });
    task.status = TaskStatus.FAILED;
    callbacks.transitionQueueState(task, 'failed');
    task.currentNode = 'agent_error_boundary';
    task.currentStep = 'agent_error';
    task.result = error instanceof Error ? error.message : 'Agent pipeline failed';
    task.updatedAt = new Date().toISOString();
    await callbacks.persistAndEmitTask(task);
    throw error;
  }
}

export async function runApprovalRecoveryPipelineWithGraph(params: {
  task: TaskRecord;
  dto: CreateTaskDto;
  pending: PendingExecutionContext;
  callbacks: ApprovalRecoveryCallbacks;
}): Promise<void> {
  const { task, dto, pending, callbacks } = params;

  try {
    await callbacks.runApprovalRecoveryPipeline(task, dto, pending);
  } catch (error) {
    if (error instanceof TaskCancelledError) {
      await callbacks.persistAndEmitTask(task);
      return;
    }
    callbacks.recordAgentError(task, error, {
      phase: 'approval_recovery',
      mode: 'approval_resume',
      goal: dto.goal,
      toolName: pending.toolName,
      intent: pending.intent
    });
    task.status = TaskStatus.FAILED;
    callbacks.transitionQueueState(task, 'failed');
    task.currentNode = 'approval_recovery_failed';
    task.currentStep = 'agent_error';
    task.result = error instanceof Error ? error.message : 'Approval recovery failed';
    task.updatedAt = new Date().toISOString();
    await callbacks.persistAndEmitTask(task);
    throw error;
  }
}
