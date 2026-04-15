import {
  AgentExecutionState,
  AgentMessage,
  AgentRole,
  ApprovalResumeInput,
  CreateTaskDto,
  EvaluationResult,
  ExecutionTrace,
  MemoryRecord,
  ModelRouteDecision,
  QueueStateRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  SubgraphId,
  TaskRecord,
  WorkflowPresetDefinition
} from '@agent/shared';
import { Command } from '@langchain/langgraph';

import { MainGraphExecutionHelpers } from './main-graph-execution-helpers';
import { MainGraphLifecycle } from '../lifecycle/main-graph-lifecycle';
import { runApprovalRecoveryPipelineWithGraph, runTaskPipelineWithGraph } from './main-graph-pipeline-orchestrator';
import { buildTaskBootstrapInterruptGraph } from '../pipeline/task-bootstrap-interrupt-graph';
import { MainGraphTaskContextRuntime } from '../task/main-graph-task-context';
import { MainGraphTaskDrafts } from '../task/main-graph-task-drafts';
import { MainGraphTaskRuntime } from '../task/main-graph-task-runtime';
import { PendingExecutionContext } from '../../../flows/approval';
import { LearningFlow } from '../../../flows/learning';
import { LibuRouterMinistry } from '@agent/agents-supervisor';
import { XingbuReviewMinistry } from '@agent/agents-reviewer';
import type { RuntimeAgentGraphState } from '../../../types/chat-graph';

interface MainGraphBridgeParams {
  pendingExecutions: Map<string, PendingExecutionContext>;
  llmConfigured: () => boolean;
  sourcePolicyMode: () => any;
  lifecycle: MainGraphLifecycle;
  learningFlow: LearningFlow;
  taskDrafts: MainGraphTaskDrafts;
  taskContextRuntime: MainGraphTaskContextRuntime;
  runtime: MainGraphTaskRuntime;
  executionHelpers: MainGraphExecutionHelpers;
  graphCheckpointer: any;
}

export class MainGraphBridge {
  constructor(private readonly params: MainGraphBridgeParams) {}

  async runTaskPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: ApprovalResumeInput;
    }
  ): Promise<void> {
    await runTaskPipelineWithGraph({
      task,
      dto,
      options,
      pendingExecutions: this.params.pendingExecutions,
      llmConfigured: this.params.llmConfigured(),
      sourcePolicyMode: this.params.sourcePolicyMode(),
      callbacks: {
        createAgentContext: this.createAgentContext.bind(this),
        ensureTaskNotCancelled: this.ensureTaskNotCancelled.bind(this),
        syncTaskRuntime: this.syncTaskRuntime.bind(this),
        markSubgraph: this.markSubgraph.bind(this),
        markWorkerUsage: this.markWorkerUsage.bind(this),
        attachTool: this.attachTool.bind(this),
        recordToolUsage: this.recordToolUsage.bind(this),
        addTrace: (currentTask, node, summary, data) => this.addTrace(currentTask.trace, node, summary, data),
        addProgressDelta: this.addProgressDelta.bind(this),
        setSubTaskStatus: this.setSubTaskStatus.bind(this),
        addMessage: this.addMessage.bind(this),
        upsertAgentState: this.upsertAgentState.bind(this),
        persistAndEmitTask: this.params.lifecycle.persistAndEmitTask.bind(this.params.lifecycle),
        updateBudgetState: this.updateBudgetState.bind(this),
        transitionQueueState: this.transitionQueueState.bind(this),
        registerPendingExecution: (taskId: string, pending: PendingExecutionContext) =>
          this.params.pendingExecutions.set(taskId, pending),
        resolveWorkflowRoutes: this.resolveWorkflowRoutes.bind(this),
        resolveResearchMinistry: this.resolveResearchMinistry.bind(this),
        resolveExecutionMinistry: this.resolveExecutionMinistry.bind(this),
        resolveReviewMinistry: this.resolveReviewMinistry.bind(this),
        getMinistryLabel: this.getMinistryLabel.bind(this),
        describeActionIntent: this.params.lifecycle.describeActionIntent.bind(this.params.lifecycle),
        reviewExecution: this.reviewExecution.bind(this),
        persistReviewArtifacts: async (currentTask, goal, evaluation, review, executionSummary) => {
          await this.params.learningFlow.persistReviewArtifacts(
            currentTask,
            goal,
            evaluation,
            review,
            executionSummary,
            {
              buildMemoryRecord: this.buildMemoryRecord.bind(this),
              buildRuleRecord: this.buildRuleRecord.bind(this),
              buildSkillDraft: this.buildSkillDraft.bind(this),
              addTrace: (node, summary) => this.addTrace(currentTask.trace, node, summary)
            }
          );
        },
        enqueueTaskLearning: (currentTask, userFeedback) => {
          this.params.lifecycle.enqueueTaskLearning(currentTask, userFeedback);
        },
        shouldRunLibuDocsDelivery: this.shouldRunLibuDocsDelivery.bind(this),
        buildFreshnessSourceSummary: this.params.lifecycle.buildFreshnessSourceSummary.bind(this.params.lifecycle),
        buildCitationSourceSummary: this.params.lifecycle.buildCitationSourceSummary.bind(this.params.lifecycle),
        appendDiagnosisEvidence: this.params.lifecycle.appendDiagnosisEvidence.bind(this.params.lifecycle),
        recordDispatches: this.recordDispatches.bind(this),
        resolveTaskFlow: this.resolveTaskFlow.bind(this),
        resolveRuntimeSkillIntervention: this.params.lifecycle.resolveRuntimeSkillIntervention.bind(
          this.params.lifecycle
        ),
        resolveSkillInstallInterruptResume: this.params.lifecycle.resolveSkillInstallInterruptResume.bind(
          this.params.lifecycle
        ),
        createGraphStartState: this.createGraphStartState.bind(this),
        resolveGraphThreadId: this.resolveGraphThreadId.bind(this),
        getGraphCheckpointer: () => this.params.graphCheckpointer,
        runDirectReplyTask: this.runDirectReplyTask.bind(this),
        recordAgentError: this.params.lifecycle.recordAgentError.bind(this.params.lifecycle)
      }
    });
  }

  async runBootstrapGraph(
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'interrupt_resume';
      resume?: ApprovalResumeInput;
    }
  ): Promise<void> {
    const graph = buildTaskBootstrapInterruptGraph({
      task,
      callbacks: {
        persistAndEmitTask: this.params.lifecycle.persistAndEmitTask.bind(this.params.lifecycle),
        addTrace: (currentTask, node, summary, data) => this.addTrace(currentTask.trace, node, summary, data),
        addProgressDelta: this.addProgressDelta.bind(this),
        attachTool: this.attachTool.bind(this),
        recordToolUsage: this.recordToolUsage.bind(this),
        transitionQueueState: this.transitionQueueState.bind(this),
        registerPendingExecution: (taskId: string, pending: PendingExecutionContext) =>
          this.params.pendingExecutions.set(taskId, pending),
        resolvePreExecutionSkillIntervention: async params => {
          const resolver = this.params.lifecycle.getPreExecutionSkillInterventionResolver();
          return resolver ? resolver(params) : undefined;
        },
        resolveSkillInstallInterruptResume: this.params.lifecycle.resolveSkillInstallInterruptResume.bind(
          this.params.lifecycle
        )
      },
      checkpointer: this.params.graphCheckpointer
    });

    if (options.mode === 'interrupt_resume' && options.resume) {
      await graph.invoke(new Command({ resume: options.resume }), {
        configurable: {
          thread_id: this.resolveGraphThreadId(task)
        }
      });
      await this.params.lifecycle.persistAndEmitTask(task);
      return;
    }

    await graph.invoke(
      {
        taskId: task.id,
        goal: dto.goal,
        blocked: false
      },
      {
        configurable: {
          thread_id: this.resolveGraphThreadId(task)
        }
      }
    );
    await this.params.lifecycle.persistAndEmitTask(task);
  }

  async runApprovalRecoveryPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ): Promise<void> {
    await runApprovalRecoveryPipelineWithGraph({
      task,
      dto,
      pending,
      callbacks: {
        persistAndEmitTask: this.params.lifecycle.persistAndEmitTask.bind(this.params.lifecycle),
        recordAgentError: this.params.lifecycle.recordAgentError.bind(this.params.lifecycle),
        transitionQueueState: this.transitionQueueState.bind(this),
        runApprovalRecoveryPipeline: this.params.executionHelpers.runApprovalRecoveryPipeline.bind(
          this.params.executionHelpers
        )
      }
    });
  }

  createGraphStartState(
    task: TaskRecord,
    dto: CreateTaskDto,
    libu: LibuRouterMinistry,
    options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext }
  ): RuntimeAgentGraphState {
    return this.params.executionHelpers.createGraphStartState(task, dto, libu, options);
  }

  reviewExecution(
    task: TaskRecord,
    xingbu: XingbuReviewMinistry,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ): Promise<{ review: ReviewRecord; evaluation: EvaluationResult }> {
    return this.params.executionHelpers.reviewExecution(task, xingbu, executionResult, executionSummary);
  }

  resolveResearchMinistry(task: TaskRecord, workflow?: WorkflowPresetDefinition) {
    return this.params.executionHelpers.resolveResearchMinistry(task, workflow);
  }
  resolveExecutionMinistry(task: TaskRecord, workflow?: WorkflowPresetDefinition) {
    return this.params.executionHelpers.resolveExecutionMinistry(task, workflow);
  }
  resolveReviewMinistry(task: TaskRecord, workflow?: WorkflowPresetDefinition) {
    return this.params.executionHelpers.resolveReviewMinistry(task, workflow);
  }
  getMinistryLabel(ministry: string) {
    return this.params.executionHelpers.getMinistryLabel(ministry);
  }
  markWorkerUsage(task: TaskRecord, workerId?: string) {
    this.params.runtime.markWorkerUsage(task, workerId);
  }
  markSubgraph(task: TaskRecord, subgraphId: SubgraphId) {
    this.params.runtime.markSubgraph(task, subgraphId);
  }
  attachTool(task: TaskRecord, params: Parameters<MainGraphTaskRuntime['attachTool']>[1]) {
    this.params.runtime.attachTool(task, params);
  }
  recordToolUsage(task: TaskRecord, params: Parameters<MainGraphTaskRuntime['recordToolUsage']>[1]) {
    this.params.runtime.recordToolUsage(task, params);
  }
  shouldRunLibuDocsDelivery(workflow?: WorkflowPresetDefinition): boolean {
    return this.params.runtime.shouldRunLibuDocsDelivery(workflow);
  }
  resolveTaskFlow(task: TaskRecord, goal: string, mode: 'initial' | 'retry' | 'approval_resume') {
    return this.params.runtime.resolveTaskFlow(task, goal, mode);
  }
  resolveGraphThreadId(task: TaskRecord) {
    return task.runId ?? task.id;
  }
  async runDirectReplyTask(task: TaskRecord, libu: LibuRouterMinistry): Promise<void> {
    await this.params.executionHelpers.runDirectReplyTask(task, libu);
  }
  createAgentContext(taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') {
    return this.params.taskContextRuntime.createAgentContext(taskId, goal, flow);
  }
  resolveWorkflowRoutes(task: TaskRecord, workflow?: WorkflowPresetDefinition): ModelRouteDecision[] {
    return this.params.runtime.resolveWorkflowRoutes(task, workflow);
  }
  buildMemoryRecord(
    taskId: string,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ): MemoryRecord {
    return this.params.taskDrafts.buildMemoryRecord(taskId, goal, evaluation, review, executionSummary);
  }
  buildRuleRecord(taskId: string, executionSummary: string): RuleRecord {
    return this.params.taskDrafts.buildRuleRecord(taskId, executionSummary);
  }
  buildSkillDraft(goal: string, source: 'execution' | 'document'): SkillCard {
    return this.params.taskDrafts.buildSkillDraft(goal, source);
  }
  recordDispatches(task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']): void {
    this.params.runtime.recordDispatches(task, dispatches);
  }
  syncTaskRuntime(
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ): void {
    this.params.runtime.syncTaskRuntime(task, state);
  }
  updateBudgetState(task: TaskRecord, overrides: Partial<NonNullable<TaskRecord['budgetState']>>) {
    return this.params.runtime.updateBudgetState(task, overrides);
  }
  createQueueState(sessionId: string | undefined, now: string): QueueStateRecord {
    return this.params.runtime.createQueueState(sessionId, now);
  }
  transitionQueueState(task: TaskRecord, status: QueueStateRecord['status']): void {
    this.params.runtime.transitionQueueState(task, status);
  }
  addMessage(
    task: TaskRecord,
    type: AgentMessage['type'],
    content: string,
    from: AgentRole,
    to: AgentRole = AgentRole.MANAGER
  ): void {
    this.params.runtime.addMessage(task, type, content, from, to);
  }
  addProgressDelta(task: TaskRecord, content: string, from: AgentRole = AgentRole.MANAGER): void {
    this.params.runtime.addProgressDelta(task, content, from);
  }
  upsertAgentState(task: TaskRecord, nextState: AgentExecutionState): void {
    this.params.runtime.upsertAgentState(task, nextState);
  }
  setSubTaskStatus(task: TaskRecord, role: AgentRole, status: 'pending' | 'running' | 'completed' | 'blocked'): void {
    this.params.runtime.setSubTaskStatus(task, role, status);
  }
  addTrace(
    trace: ExecutionTrace[],
    node: string,
    summary: string,
    data?: Record<string, unknown>,
    task?: TaskRecord
  ): void {
    this.params.runtime.addTrace(trace, node, summary, data, task);
  }
  ensureTaskNotCancelled(task: TaskRecord): void {
    this.params.runtime.ensureTaskNotCancelled(task);
  }
}
