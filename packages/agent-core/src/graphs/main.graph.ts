import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  AgentExecutionState,
  AgentTokenEvent,
  AgentMessage,
  AgentRole,
  ApprovalActionDto,
  ApprovalDecision,
  CreateDocumentLearningJobDto,
  CreateTaskDto,
  EvaluationResult,
  ExecutionTrace,
  LearningJob,
  LearningCandidateRecord,
  ManagerPlan,
  MemoryRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord,
  TaskStatus,
  ToolExecutionResult,
  WorkflowPresetDefinition,
  ModelRouteDecision
} from '@agent/shared';
import { MemoryRepository, PendingExecutionRecord, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import {
  ApprovalService,
  McpClientManager,
  SandboxExecutor,
  ToolRegistry,
  createDefaultToolRegistry
} from '@agent/tools';

import { createApprovalRecoveryGraph } from './recovery.graph';
import { executeApprovedAction, PendingExecutionContext, syncApprovedExecutorState } from '../flows/approval';
import { ExecutorAgent, ManagerAgent, ResearchAgent, ReviewerAgent } from '../flows/chat';
import { LearningFlow } from '../flows/learning';
import { createAgentGraph, createInitialState, RuntimeAgentGraphState } from './chat.graph';
import { LlmProvider } from '../adapters/llm/llm-provider';
import { buildWorkflowPresetPlan, resolveWorkflowPreset } from '../workflows/workflow-preset-registry';
import { createDefaultWorkerRegistry, WorkerRegistry } from '../governance/worker-registry';
import { ModelRoutingPolicy } from '../governance/model-routing-policy';

interface AgentRuntimeSettings {
  zhipuModels: {
    manager: string;
    research: string;
    executor: string;
    reviewer: string;
  };
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
}

export interface AgentOrchestratorDependencies {
  memoryRepository: MemoryRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  runtimeStateRepository: RuntimeStateRepository;
  llmProvider: LlmProvider;
  ruleRepository: RuleRepository;
  sandboxExecutor: SandboxExecutor;
  toolRegistry?: ToolRegistry;
  workerRegistry?: WorkerRegistry;
  mcpClientManager?: McpClientManager;
  settings?: ReturnType<typeof loadSettings> & AgentRuntimeSettings;
}

export class AgentOrchestrator {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly learningJobs = new Map<string, LearningJob>();
  private readonly pendingExecutions = new Map<string, PendingExecutionContext>();
  private readonly llm: LlmProvider;
  private readonly settings: ReturnType<typeof loadSettings> & AgentRuntimeSettings;
  private readonly toolRegistry: ToolRegistry;
  private readonly workerRegistry: WorkerRegistry;
  private readonly modelRoutingPolicy: ModelRoutingPolicy;
  private readonly learningFlow: LearningFlow;
  private readonly taskSubscribers = new Set<(task: TaskRecord) => void>();
  private readonly tokenSubscribers = new Set<(event: AgentTokenEvent) => void>();
  private readonly cancelledTasks = new Set<string>();
  private initializationPromise?: Promise<void>;

  constructor(private readonly dependencies: AgentOrchestratorDependencies) {
    this.llm = dependencies.llmProvider;
    this.settings = dependencies.settings ?? (loadSettings() as ReturnType<typeof loadSettings> & AgentRuntimeSettings);
    this.toolRegistry = dependencies.toolRegistry ?? createDefaultToolRegistry();
    this.workerRegistry = dependencies.workerRegistry ?? createDefaultWorkerRegistry();
    this.modelRoutingPolicy = new ModelRoutingPolicy(this.workerRegistry);
    this.learningFlow = new LearningFlow({
      memoryRepository: dependencies.memoryRepository,
      ruleRepository: dependencies.ruleRepository,
      skillRegistry: dependencies.skillRegistry
    });
  }

  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.hydrateRuntimeState();
    }
    await this.initializationPromise;
  }

  subscribe(listener: (task: TaskRecord) => void): () => void {
    this.taskSubscribers.add(listener);
    return () => {
      this.taskSubscribers.delete(listener);
    };
  }

  subscribeTokens(listener: (event: AgentTokenEvent) => void): () => void {
    this.tokenSubscribers.add(listener);
    return () => {
      this.tokenSubscribers.delete(listener);
    };
  }

  describeGraph(): string[] {
    return ['Main Graph Router', 'Chat Graph', 'Approval Recovery Graph', 'Learning Graph'];
  }

  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const sessionId = (dto as CreateTaskDto & { sessionId?: string }).sessionId;
    const workflowResolution = resolveWorkflowPreset(dto.goal);
    const task: TaskRecord = {
      id: `task_${Date.now()}`,
      runId: `run_${Date.now()}`,
      goal: workflowResolution.normalizedGoal,
      sessionId,
      status: TaskStatus.QUEUED,
      skillId: workflowResolution.preset.id,
      skillStage: 'skill_resolved',
      resolvedWorkflow: workflowResolution.preset,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
      currentNode: 'receive_decree',
      currentStep: 'queued',
      retryCount: 0,
      maxRetries: 1
    };

    this.addTrace(task.trace, 'decree_received', `已接收圣旨：${workflowResolution.normalizedGoal}`, {
      runId: task.runId
    });
    this.addProgressDelta(task, '收到你的任务，首辅正在拆解目标并准备调度六部。');
    this.addTrace(task.trace, 'skill_resolved', `已解析流程模板：${workflowResolution.preset.displayName}`, {
      skillId: workflowResolution.preset.id,
      command: workflowResolution.command,
      source: workflowResolution.source,
      requiredMinistries: workflowResolution.preset.requiredMinistries,
      allowedCapabilities: workflowResolution.preset.allowedCapabilities
    });
    this.addProgressDelta(task, `本轮已切换到 ${workflowResolution.preset.displayName} 流程。`);
    this.tasks.set(task.id, task);
    await this.persistAndEmitTask(task);
    await this.runTaskPipeline(task, { ...dto, goal: workflowResolution.normalizedGoal }, { mode: 'initial' });
    return task;
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): TaskRecord[] {
    return [...this.tasks.values()].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  listPendingApprovals(): TaskRecord[] {
    return this.listTasks().filter(task => task.approvals.some(approval => approval.decision === 'pending'));
  }

  listTaskTraces(taskId: string): ExecutionTrace[] {
    return this.tasks.get(taskId)?.trace ?? [];
  }

  getTaskAgents(taskId: string): AgentExecutionState[] {
    return this.tasks.get(taskId)?.agentStates ?? [];
  }

  getTaskMessages(taskId: string): AgentMessage[] {
    return this.tasks.get(taskId)?.messages ?? [];
  }

  getTaskPlan(taskId: string): ManagerPlan | undefined {
    return this.tasks.get(taskId)?.plan;
  }

  getTaskReview(taskId: string): ReviewRecord | undefined {
    return this.tasks.get(taskId)?.review;
  }

  async retryTask(taskId: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    this.pendingExecutions.delete(taskId);
    task.status = TaskStatus.QUEUED;
    task.review = undefined;
    task.result = undefined;
    task.currentStep = 'queued';
    task.retryCount = 0;
    task.maxRetries = 1;
    task.updatedAt = new Date().toISOString();
    this.addTrace(task.trace, 'manager_replan', 'Manual retry requested for multi-agent pipeline', undefined, task);

    await this.persistAndEmitTask(task);
    await this.runTaskPipeline(task, { goal: task.goal, constraints: [] }, { mode: 'retry' });
    return task;
  }

  async cancelTask(taskId: string, reason?: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    this.cancelledTasks.add(taskId);
    this.pendingExecutions.delete(taskId);
    task.status = TaskStatus.CANCELLED;
    task.currentNode = 'run_cancelled';
    task.currentStep = 'cancelled';
    task.result = reason ? `已终止当前执行：${reason}` : '已手动终止当前执行。';
    task.updatedAt = new Date().toISOString();
    task.pendingAction = undefined;
    task.pendingApproval = undefined;
    this.addTrace(task.trace, 'run_cancelled', task.result, {
      reason
    });
    await this.persistAndEmitTask(task);
    return task;
  }

  async deleteSessionState(sessionId: string): Promise<void> {
    await this.initialize();

    const taskIds = [...this.tasks.values()].filter(task => task.sessionId === sessionId).map(task => task.id);

    for (const taskId of taskIds) {
      this.tasks.delete(taskId);
      this.pendingExecutions.delete(taskId);
      this.cancelledTasks.delete(taskId);
    }

    await this.persistRuntimeState();
  }

  async applyApproval(
    taskId: string,
    dto: ApprovalActionDto,
    decision: ApprovalDecision
  ): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    task.approvals.push({
      taskId,
      intent: dto.intent,
      reason: dto.reason,
      actor: dto.actor,
      decision,
      decidedAt: new Date().toISOString()
    });
    task.updatedAt = new Date().toISOString();

    if (decision === ApprovalDecision.REJECTED) {
      task.status = TaskStatus.BLOCKED;
      task.result = 'Approval rejected. Task is blocked.';
      task.approvalFeedback = dto.feedback;
      task.pendingApproval = task.pendingApproval
        ? { ...task.pendingApproval, feedback: dto.feedback }
        : task.pendingAction
          ? { ...task.pendingAction, feedback: dto.feedback }
          : undefined;
      task.review = {
        taskId,
        decision: 'blocked',
        notes: [
          'Human approval rejected the high-risk action.',
          ...(dto.feedback ? [`Feedback: ${dto.feedback}`] : [])
        ],
        createdAt: new Date().toISOString()
      };
      this.addTrace(
        task.trace,
        dto.feedback ? 'approval_rejected_with_feedback' : 'approval_gate',
        dto.feedback
          ? `Approval rejected for ${dto.intent} with feedback: ${dto.feedback}`
          : `Approval rejected for ${dto.intent}`
      );
      this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
      await this.persistAndEmitTask(task);
      return task;
    }

    this.addTrace(task.trace, 'approval_gate', `Approval granted for ${dto.intent}`);
    task.pendingApproval = undefined;
    task.pendingAction = undefined;

    const pending = this.pendingExecutions.get(taskId);
    if (!pending) {
      task.status = TaskStatus.RUNNING;
      task.result = '已收到审批结果，但当前没有找到待恢复的执行上下文。';
      await this.persistAndEmitTask(task);
      return task;
    }

    this.pendingExecutions.delete(taskId);
    await this.persistAndEmitTask(task);
    await this.runApprovalRecoveryPipeline(
      task,
      { goal: task.goal, context: pending.researchSummary, constraints: [] },
      pending
    );
    return task;
  }

  ensureLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    return this.learningFlow.ensureCandidates(task);
  }

  async confirmLearning(taskId: string, candidateIds?: string[]): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    this.learningFlow.ensureCandidates(task);
    await this.learningFlow.confirmCandidates(task, candidateIds);
    task.updatedAt = new Date().toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  async listRules(): Promise<RuleRecord[]> {
    await this.initialize();
    return this.dependencies.ruleRepository.list();
  }

  async createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    const now = new Date().toISOString();
    const job: LearningJob = {
      id: `learn_${Date.now()}`,
      sourceType: 'document',
      status: 'completed',
      documentUri: dto.documentUri,
      summary: dto.title ?? 'Document learning job created and summarized into the skill lab.',
      createdAt: now,
      updatedAt: now
    };
    this.learningJobs.set(job.id, job);

    const skill = this.buildSkillDraft(dto.title ?? dto.documentUri, 'document');
    await this.dependencies.skillRegistry.publishToLab(skill);
    await this.persistRuntimeState();

    return job;
  }

  getLearningJob(jobId: string): LearningJob | undefined {
    return this.learningJobs.get(jobId);
  }

  private async hydrateRuntimeState(): Promise<void> {
    const snapshot = await this.dependencies.runtimeStateRepository.load();
    this.tasks.clear();
    this.learningJobs.clear();
    this.pendingExecutions.clear();

    for (const task of snapshot.tasks) {
      this.tasks.set(task.id, task);
    }

    for (const job of snapshot.learningJobs) {
      this.learningJobs.set(job.id, job);
    }

    for (const pending of snapshot.pendingExecutions) {
      this.pendingExecutions.set(pending.taskId, pending);
    }
  }

  private async persistRuntimeState(): Promise<void> {
    const snapshot = await this.dependencies.runtimeStateRepository.load();
    await this.dependencies.runtimeStateRepository.save({
      ...snapshot,
      tasks: [...this.tasks.values()],
      learningJobs: [...this.learningJobs.values()],
      pendingExecutions: [...this.pendingExecutions.values()]
    });
  }

  private emitTaskUpdate(task: TaskRecord): void {
    for (const subscriber of this.taskSubscribers) {
      subscriber(task);
    }
  }

  private emitToken(event: AgentTokenEvent): void {
    if (this.cancelledTasks.has(event.taskId)) {
      return;
    }
    for (const subscriber of this.tokenSubscribers) {
      subscriber(event);
    }
  }

  private describeActionIntent(intent: ActionIntent): string {
    switch (intent) {
      case ActionIntent.WRITE_FILE:
        return '文件写入';
      case ActionIntent.CALL_EXTERNAL_API:
        return '外部请求';
      case ActionIntent.READ_FILE:
        return '文件读取';
      default:
        return intent;
    }
  }

  private async persistAndEmitTask(task: TaskRecord): Promise<void> {
    await this.persistRuntimeState();
    this.emitTaskUpdate(task);
  }

  private async runTaskPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext }
  ): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.skillStage = 'preset_plan_expansion';
    task.currentNode = 'supervisor_plan';
    task.updatedAt = new Date().toISOString();
    this.addTrace(
      task.trace,
      'skill_stage_started',
      `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 进入计划展开阶段。`,
      {
        skillId: task.skillId,
        skillStage: task.skillStage
      }
    );
    task.result = undefined;
    await this.persistAndEmitTask(task);

    const manager = new ManagerAgent(this.createAgentContext(task.id, dto.goal, 'chat'));
    const research = new ResearchAgent(this.createAgentContext(task.id, dto.goal, 'chat'));
    const executor = new ExecutorAgent(this.createAgentContext(task.id, dto.goal, 'chat'));
    const reviewer = new ReviewerAgent(this.createAgentContext(task.id, dto.goal, 'chat'));

    try {
      this.ensureTaskNotCancelled(task);
      if (this.shouldHandleAsDirectReply(dto.goal, options.mode)) {
        await this.runDirectReplyTask(task, manager);
        return;
      }

      const graph = createAgentGraph({
        goalIntake: async state => {
          this.ensureTaskNotCancelled(task);
          const action =
            options.mode === 'approval_resume'
              ? 'Resuming approved goal'
              : options.mode === 'retry'
                ? 'Retrying goal'
                : 'Received goal';
          this.syncTaskRuntime(task, {
            currentStep: 'goal_intake',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          task.currentNode = 'receive_decree';
          this.addTrace(task.trace, 'goal_intake', `${action}: ${dto.goal}`);
          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'goal_intake',
            observations: [...state.observations, `goal:${dto.goal}`]
          };
        },
        route: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'route',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          task.currentNode = 'libu_route';
          const modelRoute = this.resolveWorkflowRoutes(task.resolvedWorkflow);
          task.modelRoute = modelRoute;
          task.currentMinistry = 'libu-router';
          task.currentWorker = modelRoute.find(item => item.ministry === 'libu-router')?.workerId;
          this.addTrace(task.trace, 'libu_routed', '吏部已完成流程路由与选模。', {
            modelRoute
          });
          if (state.resumeFromApproval) {
            this.addTrace(task.trace, 'route', 'Resuming graph from approved execution state');
            await this.persistAndEmitTask(task);
          }
          return {
            ...state,
            currentStep: 'route'
          };
        },
        managerPlan: async state => {
          this.ensureTaskNotCancelled(task);
          const plan = task.resolvedWorkflow
            ? buildWorkflowPresetPlan(task.id, dto.goal, task.resolvedWorkflow)
            : await manager.plan();
          task.plan = plan;
          task.review = undefined;
          task.skillStage = 'ministry_execution';
          task.currentNode = 'supervisor_plan';
          this.syncTaskRuntime(task, {
            currentStep: 'manager_plan',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          this.upsertAgentState(task, manager.getState());
          this.addTrace(
            task.trace,
            state.retryCount > 0 ? 'manager_replan' : 'supervisor_planned',
            `Manager generated ${plan.subTasks.length} sub tasks${state.retryCount > 0 ? ` on retry ${state.retryCount}` : ''}`
          );
          this.addProgressDelta(task, `首辅已完成规划，接下来会按 ${plan.subTasks.length} 个步骤推进。`);
          this.addTrace(
            task.trace,
            'skill_stage_started',
            `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 进入尚书执行阶段。`,
            {
              skillId: task.skillId,
              skillStage: task.skillStage,
              requiredMinistries: task.resolvedWorkflow?.requiredMinistries
            }
          );
          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'manager_plan',
            currentPlan: plan.steps,
            dispatches: manager.dispatch(plan),
            shouldRetry: false,
            approvalRequired: false,
            approvalStatus: undefined,
            executionResult: undefined,
            executionSummary: undefined,
            finalAnswer: undefined,
            reviewDecision: undefined
          };
        },
        dispatch: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'dispatch',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          task.currentNode = 'worker_execute';
          this.recordDispatches(task, state.dispatches);
          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'dispatch'
          };
        },
        research: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'research',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          const researchMinistry = this.resolveResearchMinistry(task.resolvedWorkflow);
          task.currentMinistry = researchMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === researchMinistry)?.workerId;
          this.addTrace(task.trace, 'ministry_started', '户部开始检索上下文与资料。', {
            ministry: task.currentMinistry,
            workerId: task.currentWorker
          });
          this.addProgressDelta(task, `户部已开始检索资料与上下文。`, AgentRole.RESEARCH);
          this.setSubTaskStatus(task, AgentRole.RESEARCH, 'running');
          const researchResult =
            researchMinistry === 'libu-docs'
              ? await this.runLibuDocsResearch(task)
              : await research.run(state.dispatches[0]?.objective ?? 'Research shared memory and skills');
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, research.getState());
          this.addMessage(task, 'research_result', researchResult.summary, AgentRole.RESEARCH);
          this.addTrace(task.trace, 'research', researchResult.summary, {
            ministry: task.currentMinistry,
            memoryCount: researchResult.memories.length,
            skillCount: researchResult.skills.length,
            toolCandidates: this.toolRegistry.list().length
          });
          this.addTrace(task.trace, 'ministry_reported', '户部已提交检索战报。', {
            ministry: task.currentMinistry,
            workerId: task.currentWorker
          });
          this.addProgressDelta(task, `户部战报：${researchResult.summary}`, AgentRole.RESEARCH);
          this.setSubTaskStatus(task, AgentRole.RESEARCH, 'completed');
          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'research',
            observations: [...state.observations, researchResult.summary],
            retrievedMemories: researchResult.memories,
            retrievedSkills: researchResult.skills,
            researchSummary: researchResult.summary,
            resumeFromApproval: false
          };
        },
        execute: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'execute',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          const executionMinistry = this.resolveExecutionMinistry(task.resolvedWorkflow);
          task.currentMinistry = executionMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === executionMinistry)?.workerId;
          this.addTrace(task.trace, 'ministry_started', `${this.getMinistryLabel(executionMinistry)}开始执行方案。`, {
            ministry: task.currentMinistry,
            workerId: task.currentWorker
          });
          this.addProgressDelta(
            task,
            `${this.getMinistryLabel(executionMinistry)}已接到任务，正在执行方案。`,
            AgentRole.EXECUTOR
          );
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');

          if (state.resumeFromApproval && state.toolIntent && state.toolName) {
            const approvedResult = await executeApprovedAction(this.createAgentContext(task.id, dto.goal, 'approval'), {
              taskId: task.id,
              intent: state.toolIntent,
              toolName: state.toolName,
              researchSummary: state.researchSummary ?? ''
            });
            this.ensureTaskNotCancelled(task);
            this.upsertAgentState(
              task,
              syncApprovedExecutorState(executor, approvedResult, {
                taskId: task.id,
                intent: state.toolIntent,
                toolName: state.toolName,
                researchSummary: state.researchSummary ?? ''
              })
            );
            this.addMessage(task, 'execution_result', approvedResult.outputSummary, AgentRole.EXECUTOR);
            this.addTrace(task.trace, 'execute', approvedResult.outputSummary, {
              ministry: task.currentMinistry,
              intent: state.toolIntent,
              toolName: state.toolName,
              approved: true,
              exitCode: approvedResult.exitCode
            });
            this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
            this.addTrace(task.trace, 'ministry_reported', '工部已提交执行结果。', {
              ministry: task.currentMinistry,
              workerId: task.currentWorker
            });
            this.addProgressDelta(task, `执行结果：${approvedResult.outputSummary}`, AgentRole.EXECUTOR);
            await this.persistAndEmitTask(task);
            return {
              ...state,
              currentStep: 'execute',
              approvalRequired: false,
              approvalStatus: ApprovalDecision.APPROVED,
              executionSummary: approvedResult.outputSummary,
              executionResult: approvedResult,
              finalAnswer: approvedResult.outputSummary,
              resumeFromApproval: false,
              shouldRetry: false
            };
          }

          const execution =
            executionMinistry === 'libu-docs'
              ? await this.runLibuDocsExecution(task, state.executionSummary ?? state.researchSummary ?? '')
              : await executor.run(
                  state.dispatches[1]?.objective ??
                    (executionMinistry === 'bingbu-ops'
                      ? 'Run controlled ops and validation tasks'
                      : 'Execute the candidate action'),
                  state.researchSummary ?? 'No research summary available.'
                );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, executor.getState());
          this.addMessage(task, 'execution_result', execution.summary, AgentRole.EXECUTOR);
          this.addTrace(task.trace, 'execute', execution.summary, {
            ministry: task.currentMinistry,
            intent: execution.intent,
            toolName: execution.toolName,
            requiresApproval: execution.requiresApproval,
            llmConfigured: this.llm.isConfigured(),
            retryCount: state.retryCount
          });
          this.addProgressDelta(task, `执行进展：${execution.summary}`, AgentRole.EXECUTOR);

          if (execution.requiresApproval) {
            const approvalReason = `准备使用 ${execution.toolName} 执行 ${this.describeActionIntent(execution.intent)}，该动作会影响外部环境，因此需要人工审批。`;
            task.status = TaskStatus.WAITING_APPROVAL;
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
              reason: approvalReason
            };
            task.approvals.push({
              taskId: task.id,
              intent: execution.intent,
              decision: 'pending',
              decidedAt: new Date().toISOString(),
              reason: approvalReason
            });
            this.pendingExecutions.set(task.id, {
              taskId: task.id,
              intent: execution.intent,
              toolName: execution.toolName,
              researchSummary: state.researchSummary ?? ''
            });
            this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
            this.setSubTaskStatus(task, AgentRole.REVIEWER, 'pending');
            this.addTrace(
              task.trace,
              'approval_gate',
              `执行已暂停：${this.describeActionIntent(execution.intent)} 需要先审批（工具：${execution.toolName}）`
            );
            this.addProgressDelta(
              task,
              `执行已暂停，准备使用 ${execution.toolName} 执行 ${this.describeActionIntent(execution.intent)}。等待你审批后继续。`,
              AgentRole.EXECUTOR
            );
          } else {
            this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
          }

          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'execute',
            toolIntent: execution.intent,
            toolName: execution.toolName,
            approvalRequired: execution.requiresApproval,
            approvalStatus: execution.requiresApproval ? 'pending' : ApprovalDecision.APPROVED,
            executionSummary: execution.summary,
            executionResult: execution.executionResult,
            finalAnswer: execution.summary,
            shouldRetry: false,
            resumeFromApproval: false
          };
        },
        review: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'review',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          task.currentNode = 'review_and_govern';
          const reviewMinistry = this.resolveReviewMinistry(task.resolvedWorkflow);
          task.currentMinistry = reviewMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === reviewMinistry)?.workerId;
          this.addTrace(
            task.trace,
            'ministry_started',
            `${this.getMinistryLabel(reviewMinistry)}开始审查与交付整理。`,
            {
              ministry: task.currentMinistry,
              workerId: task.currentWorker
            }
          );
          this.addProgressDelta(
            task,
            `${this.getMinistryLabel(reviewMinistry)}开始审查并整理交付。`,
            AgentRole.REVIEWER
          );
          const reviewed =
            reviewMinistry === 'libu-docs'
              ? this.createDocsReview(task, state.executionSummary ?? task.result ?? 'No execution summary available.')
              : await this.reviewExecution(
                  task,
                  reviewer,
                  state.executionResult,
                  state.executionSummary ?? task.result ?? 'No execution summary available.'
                );
          this.ensureTaskNotCancelled(task);

          if (reviewed.evaluation.shouldRetry && state.retryCount < state.maxRetries) {
            task.status = TaskStatus.RUNNING;
            task.result = undefined;
            this.syncTaskRuntime(task, {
              currentStep: 'manager_plan',
              retryCount: state.retryCount + 1,
              maxRetries: state.maxRetries
            });
            this.addTrace(
              task.trace,
              'manager_replan',
              `Reviewer requested retry ${state.retryCount + 1}/${state.maxRetries}`
            );
            await this.persistAndEmitTask(task);
            return {
              ...state,
              currentStep: 'review',
              evaluation: reviewed.evaluation,
              reviewDecision: reviewed.review.decision,
              shouldRetry: true,
              retryCount: state.retryCount + 1,
              approvalRequired: false,
              approvalStatus: undefined,
              executionResult: undefined,
              executionSummary: undefined,
              finalAnswer: undefined,
              toolIntent: undefined,
              toolName: undefined,
              researchSummary: undefined,
              dispatches: []
            };
          }

          await this.learningFlow.persistReviewArtifacts(
            task,
            dto.goal,
            reviewed.evaluation,
            reviewed.review,
            state.executionSummary ?? '',
            {
              buildMemoryRecord: this.buildMemoryRecord.bind(this),
              buildRuleRecord: this.buildRuleRecord.bind(this),
              buildSkillDraft: this.buildSkillDraft.bind(this),
              addTrace: (node, summary) => this.addTrace(task.trace, node, summary)
            }
          );
          const docsSummary = this.shouldRunLibuDocsDelivery(task.resolvedWorkflow)
            ? this.buildLibuDocsDelivery(
                task,
                state.executionSummary ?? task.result ?? 'No execution summary available.'
              )
            : undefined;
          if (docsSummary) {
            this.addTrace(task.trace, 'ministry_reported', docsSummary, {
              ministry: 'libu-docs'
            });
            this.addMessage(task, 'review_result', docsSummary, AgentRole.REVIEWER);
            this.addProgressDelta(task, docsSummary, AgentRole.REVIEWER);
          }
          const finalAnswer = await manager.finalize(
            reviewed.review,
            docsSummary
              ? `${state.executionSummary ?? task.result ?? ''}\n${docsSummary}`
              : (state.executionSummary ?? task.result ?? 'No execution summary available.')
          );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, manager.getState());
          this.addMessage(task, 'summary', finalAnswer, AgentRole.MANAGER);
          this.addTrace(task.trace, 'finish', finalAnswer);

          task.result = finalAnswer;
          task.status = reviewed.review.decision === 'approved' ? TaskStatus.COMPLETED : TaskStatus.FAILED;
          task.skillStage = 'completed';
          task.currentNode = 'finalize_response';
          task.updatedAt = new Date().toISOString();
          this.addTrace(task.trace, 'ministry_reported', '刑部已提交审查结论。', {
            ministry: task.currentMinistry,
            workerId: task.currentWorker,
            decision: reviewed.review.decision
          });
          this.addTrace(task.trace, 'final_response_completed', '首辅已汇总最终答复。', {
            currentNode: task.currentNode
          });
          this.addProgressDelta(task, '首辅正在整理最终答复。');
          this.addTrace(
            task.trace,
            'skill_stage_completed',
            `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 已完成。`,
            {
              skillId: task.skillId,
              skillStage: task.skillStage,
              outputType: task.resolvedWorkflow?.outputContract.type
            }
          );
          await this.persistAndEmitTask(task);

          return {
            ...state,
            currentStep: 'review',
            evaluation: reviewed.evaluation,
            reviewDecision: reviewed.review.decision,
            shouldRetry: false,
            finalAnswer
          };
        },
        finish: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'finish',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          await this.persistAndEmitTask(task);
          return {
            ...state,
            currentStep: 'finish',
            finalAnswer: task.result ?? state.finalAnswer
          };
        }
      }).compile();

      await graph.invoke(this.createGraphStartState(task, dto, manager, options));
      await this.persistAndEmitTask(task);
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        await this.persistAndEmitTask(task);
        return;
      }
      throw error;
    }
  }

  private async runApprovalRecoveryPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.currentNode = 'resume_after_approval';
    task.updatedAt = new Date().toISOString();
    this.addTrace(task.trace, 'run_resumed', '皇帝已批准高风险动作，流程恢复执行。', {
      runId: task.runId
    });
    await this.persistAndEmitTask(task);

    const executor = new ExecutorAgent(this.createAgentContext(task.id, dto.goal, 'approval'));
    try {
      const graph = createApprovalRecoveryGraph({
        executeApproved: async state => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'execute',
            retryCount: task.retryCount ?? 0,
            maxRetries: task.maxRetries ?? 1
          });
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');
          const executionResult = await executeApprovedAction(
            this.createAgentContext(task.id, dto.goal, 'approval'),
            state.pending
          );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, syncApprovedExecutorState(executor, executionResult, state.pending));
          this.addMessage(task, 'execution_result', executionResult.outputSummary, AgentRole.EXECUTOR);
          this.addTrace(task.trace, 'execute', executionResult.outputSummary, {
            ministry: 'gongbu-code',
            intent: state.pending.intent,
            toolName: state.pending.toolName,
            approved: true,
            exitCode: executionResult.exitCode
          });
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
          await this.persistAndEmitTask(task);
          return {
            ...state,
            approvalStatus: ApprovalDecision.APPROVED,
            executionResult,
            executionSummary: executionResult.outputSummary
          };
        },
        finish: async state => {
          this.ensureTaskNotCancelled(task);
          await this.runTaskPipeline(task, dto, { mode: 'approval_resume', pending });
          return state;
        }
      }).compile();

      await graph.invoke({
        taskId: task.id,
        goal: dto.goal,
        pending,
        approvalStatus: ApprovalDecision.APPROVED
      });
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        await this.persistAndEmitTask(task);
        return;
      }
      throw error;
    }
  }

  private createGraphStartState(
    task: TaskRecord,
    dto: CreateTaskDto,
    manager: ManagerAgent,
    options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext }
  ): RuntimeAgentGraphState {
    const base = createInitialState(task.id, dto.goal, dto.context);

    if (options.mode !== 'approval_resume' || !options.pending) {
      return base;
    }

    return {
      ...base,
      currentPlan: task.plan?.steps ?? [],
      dispatches: task.plan ? manager.dispatch(task.plan) : [],
      researchSummary: options.pending.researchSummary,
      toolIntent: options.pending.intent,
      toolName: options.pending.toolName,
      approvalRequired: false,
      approvalStatus: ApprovalDecision.APPROVED,
      resumeFromApproval: true
    };
  }

  private async reviewExecution(
    task: TaskRecord,
    reviewer: ReviewerAgent,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ): Promise<{ review: ReviewRecord; evaluation: EvaluationResult }> {
    this.setSubTaskStatus(task, AgentRole.REVIEWER, 'running');
    const reviewed = await reviewer.review(executionResult, executionSummary);
    task.review = reviewed.review;
    this.upsertAgentState(task, reviewer.getState());
    this.addMessage(task, 'review_result', reviewed.review.notes.join(' '), AgentRole.REVIEWER);
    this.addTrace(task.trace, 'review', `Reviewer decision: ${reviewed.review.decision}`);
    this.setSubTaskStatus(task, AgentRole.REVIEWER, 'completed');
    return reviewed;
  }

  private resolveResearchMinistry(workflow?: WorkflowPresetDefinition): 'hubu-search' | 'libu-docs' {
    if (workflow?.requiredMinistries.includes('hubu-search')) {
      return 'hubu-search';
    }
    return 'libu-docs';
  }

  private resolveExecutionMinistry(workflow?: WorkflowPresetDefinition): 'gongbu-code' | 'bingbu-ops' | 'libu-docs' {
    if (workflow?.requiredMinistries.includes('gongbu-code')) {
      return 'gongbu-code';
    }
    if (workflow?.requiredMinistries.includes('bingbu-ops')) {
      return 'bingbu-ops';
    }
    return 'libu-docs';
  }

  private resolveReviewMinistry(workflow?: WorkflowPresetDefinition): 'xingbu-review' | 'libu-docs' {
    if (workflow?.requiredMinistries.includes('xingbu-review')) {
      return 'xingbu-review';
    }
    return 'libu-docs';
  }

  private getMinistryLabel(ministry: string): string {
    switch (ministry) {
      case 'libu-router':
        return '吏部';
      case 'hubu-search':
        return '户部';
      case 'libu-docs':
        return '礼部';
      case 'bingbu-ops':
        return '兵部';
      case 'xingbu-review':
        return '刑部';
      case 'gongbu-code':
        return '工部';
      default:
        return ministry;
    }
  }

  private async runLibuDocsResearch(
    task: TaskRecord
  ): Promise<{ summary: string; memories: MemoryRecord[]; skills: SkillCard[] }> {
    const summary = `礼部已整理目标所需的交付规范：${task.resolvedWorkflow?.outputContract.requiredSections.join('、') ?? 'summary'}。`;
    return {
      summary,
      memories: [],
      skills: []
    };
  }

  private async runLibuDocsExecution(
    task: TaskRecord,
    executionSummary: string
  ): Promise<{
    intent: ActionIntent;
    toolName: string;
    requiresApproval: boolean;
    tool?: never;
    executionResult?: ToolExecutionResult;
    summary: string;
  }> {
    const summary = this.buildLibuDocsDelivery(task, executionSummary);
    return {
      intent: ActionIntent.READ_FILE,
      toolName: 'documentation',
      requiresApproval: false,
      executionResult: {
        ok: true,
        outputSummary: summary,
        rawOutput: {
          outputType: task.resolvedWorkflow?.outputContract.type
        },
        durationMs: 1,
        exitCode: 0
      },
      summary
    };
  }

  private createDocsReview(
    task: TaskRecord,
    executionSummary: string
  ): { review: ReviewRecord; evaluation: EvaluationResult } {
    return {
      review: {
        taskId: task.id,
        decision: 'approved',
        notes: ['礼部已确认当前产出可整理为正式交付文档。'],
        createdAt: new Date().toISOString()
      },
      evaluation: {
        success: true,
        quality: 'high',
        shouldRetry: false,
        shouldWriteMemory: false,
        shouldCreateRule: false,
        shouldExtractSkill: false,
        notes: [`礼部复核通过：${executionSummary}`]
      }
    };
  }

  private shouldRunLibuDocsDelivery(workflow?: WorkflowPresetDefinition): boolean {
    return Boolean(workflow?.requiredMinistries.includes('libu-docs'));
  }

  private buildLibuDocsDelivery(task: TaskRecord, executionSummary: string): string {
    const sections = task.resolvedWorkflow?.outputContract.requiredSections.join('、') ?? 'summary';
    return `礼部已整理 ${task.resolvedWorkflow?.displayName ?? '当前流程'} 的交付说明，重点覆盖：${sections}。当前执行摘要：${executionSummary}`;
  }

  private shouldHandleAsDirectReply(goal: string, mode: 'initial' | 'retry' | 'approval_resume'): boolean {
    if (mode === 'approval_resume') {
      return false;
    }

    const normalized = goal.trim().toLowerCase();
    if (!normalized || normalized.length > 32) {
      return false;
    }

    return ['你是谁', '你是誰', '介绍一下你自己', '介绍你自己', '你能做什么', '你会什么', 'who are you'].some(pattern =>
      normalized.includes(pattern)
    );
  }

  private async runDirectReplyTask(task: TaskRecord, manager: ManagerAgent): Promise<void> {
    this.syncTaskRuntime(task, {
      currentStep: 'direct_reply',
      retryCount: task.retryCount ?? 0,
      maxRetries: task.maxRetries ?? 1
    });
    task.currentNode = 'finalize_response';
    this.addTrace(
      task.trace,
      'direct_reply',
      'Manager replied directly without invoking full multi-agent pipeline.',
      undefined,
      task
    );
    const answer = await manager.replyDirectly();
    this.upsertAgentState(task, manager.getState());
    task.result = answer;
    task.status = TaskStatus.COMPLETED;
    task.skillStage = 'completed';
    task.updatedAt = new Date().toISOString();
    task.review = {
      taskId: task.id,
      decision: 'approved',
      notes: ['Direct reply mode for conversational identity request.'],
      createdAt: new Date().toISOString()
    };
    task.messages.push({
      id: `msg_${Date.now()}_${task.messages.length}`,
      taskId: task.id,
      from: AgentRole.MANAGER,
      to: AgentRole.MANAGER,
      type: 'summary',
      content: answer,
      createdAt: new Date().toISOString()
    });
    this.addTrace(
      task.trace,
      'skill_stage_completed',
      `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 已直接完成。`,
      {
        skillId: task.skillId,
        skillStage: task.skillStage,
        outputType: task.resolvedWorkflow?.outputContract.type
      }
    );
    this.addTrace(task.trace, 'final_response_completed', '首辅已直接完成最终答复。', {
      currentNode: task.currentNode
    });
    await this.persistAndEmitTask(task);
  }

  private createAgentContext(taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') {
    const task = this.tasks.get(taskId);
    return {
      taskId,
      goal,
      flow,
      memoryRepository: this.dependencies.memoryRepository,
      ruleRepository: this.dependencies.ruleRepository,
      runtimeStateRepository: this.dependencies.runtimeStateRepository,
      skillRegistry: this.dependencies.skillRegistry,
      approvalService: this.dependencies.approvalService,
      toolRegistry: this.toolRegistry,
      workflowPreset: task?.resolvedWorkflow,
      mcpClientManager: this.dependencies.mcpClientManager,
      sandbox: this.dependencies.sandboxExecutor,
      llm: this.llm,
      thinking: this.settings.zhipuThinking,
      onToken: (payload: {
        token: string;
        role: 'manager' | 'research' | 'executor' | 'reviewer';
        messageId: string;
        model?: string;
      }) => {
        this.emitToken({
          taskId,
          role:
            payload.role === 'manager'
              ? AgentRole.MANAGER
              : payload.role === 'research'
                ? AgentRole.RESEARCH
                : payload.role === 'executor'
                  ? AgentRole.EXECUTOR
                  : AgentRole.REVIEWER,
          messageId: payload.messageId,
          token: payload.token,
          model: payload.model,
          createdAt: new Date().toISOString()
        });
      }
    };
  }

  private resolveWorkflowRoutes(workflow?: WorkflowPresetDefinition): ModelRouteDecision[] {
    const ministries = workflow?.requiredMinistries ?? ['libu-router', 'hubu-search', 'gongbu-code', 'xingbu-review'];
    const routes = ministries
      .map(ministry => this.modelRoutingPolicy.resolveRoute(ministry, workflow?.displayName ?? 'general workflow'))
      .filter((item): item is ModelRouteDecision => Boolean(item));

    const hasRouter = routes.some(item => item.ministry === 'libu-router');
    if (!hasRouter) {
      const routerRoute = this.modelRoutingPolicy.resolveRoute(
        'libu-router',
        workflow?.displayName ?? 'general workflow'
      );
      if (routerRoute) {
        routes.unshift(routerRoute);
      }
    }
    return routes;
  }

  private buildMemoryRecord(
    taskId: string,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ): MemoryRecord {
    return {
      id: `mem_${Date.now()}`,
      type: evaluation.success ? 'success_case' : 'failure_case',
      taskId,
      summary: evaluation.success
        ? `Successful multi-agent pattern for goal: ${goal}`
        : `Failure pattern for goal: ${goal}`,
      content: JSON.stringify({ review, executionSummary }),
      tags: ['multi-agent', 'manager', 'review', evaluation.success ? 'success' : 'failure'],
      qualityScore: evaluation.success ? 0.85 : 0.7,
      createdAt: new Date().toISOString()
    };
  }

  private buildRuleRecord(taskId: string, executionSummary: string): RuleRecord {
    return {
      id: `rule_${Date.now()}`,
      name: '升级失败模式规则',
      summary: '当评审给出阻断或重试时，沉淀一条更安全的重规划规则。',
      conditions: [`taskId=${taskId}`],
      action: executionSummary,
      sourceTaskId: taskId,
      createdAt: new Date().toISOString()
    };
  }

  private buildSkillDraft(goal: string, source: 'execution' | 'document'): SkillCard {
    const now = new Date().toISOString();
    const normalizedGoal = goal.toLowerCase();
    const isChatGoal =
      normalizedGoal.includes('你是') ||
      normalizedGoal.includes('扮演') ||
      normalizedGoal.includes('角色') ||
      normalizedGoal.includes('persona') ||
      normalizedGoal.includes('roleplay') ||
      normalizedGoal.includes('聊天');

    if (isChatGoal) {
      return {
        id: `skill_${Date.now()}`,
        name: '中文聊天角色技能',
        description: '用于处理“你是……”类设定、角色扮演和中文对话风格控制的实验技能。',
        applicableGoals: [goal],
        requiredTools: ['search_memory'],
        steps: [
          {
            title: '识别人设与语气',
            instruction: '先识别用户正在定义的角色、人设、语气和聊天边界。',
            toolNames: ['search_memory']
          },
          {
            title: '检索现有聊天技能',
            instruction: '优先检索已有聊天技能、历史记忆和相关规则，若缺失则标记为技能缺口。',
            toolNames: ['search_memory']
          },
          {
            title: '用中文稳定回复',
            instruction: '按照设定的人设和中文语境生成自然回复，并在任务结束后沉淀成技能候选。',
            toolNames: ['search_memory']
          }
        ],
        constraints: ['默认使用中文回复', '缺少现成技能时生成技能候选而不是静默忽略'],
        successSignals: ['用户获得符合设定的人设回复', '生成聊天技能候选', '后续相似对话可复用'],
        riskLevel: 'medium',
        source,
        status: 'lab',
        createdAt: now,
        updatedAt: now
      };
    }

    return {
      id: `skill_${Date.now()}`,
      name: source === 'execution' ? '多 Agent 执行模式' : '文档学习技能模式',
      description: '从主 Agent 与子 Agent 协作过程中抽取出的可复用实验技能。',
      applicableGoals: [goal],
      requiredTools: ['search_memory', 'read_local_file'],
      steps: [
        {
          title: '研究共享上下文',
          instruction: '先由研究 Agent 检索记忆、规则和可复用技能。',
          toolNames: ['search_memory', 'read_local_file']
        },
        {
          title: '带审批意识地执行',
          instruction: '由执行 Agent 选择安全工具，遇到高风险动作先暂停等待审批。',
          toolNames: ['read_local_file']
        },
        {
          title: '评审并学习',
          instruction: '由评审 Agent 判断质量，并决定是否写回记忆、规则或技能。',
          toolNames: ['search_memory']
        }
      ],
      constraints: ['写入类动作需要审批', '外部请求需要审批'],
      successSignals: ['评审通过结果', '成功写入记忆', '实验技能可再次复用'],
      riskLevel: 'medium',
      source,
      status: 'lab',
      createdAt: now,
      updatedAt: now
    };
  }

  private recordDispatches(task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']): void {
    for (const dispatch of dispatches) {
      this.addMessage(task, 'dispatch', dispatch.objective, AgentRole.MANAGER, dispatch.to);
      this.addTrace(task.trace, 'dispatch', `Manager dispatched ${dispatch.to} for ${dispatch.objective}`);
      this.addProgressDelta(task, `已分派给 ${dispatch.to}：${dispatch.objective}`);
    }
  }

  private syncTaskRuntime(
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ): void {
    task.currentStep = state.currentStep;
    task.retryCount = state.retryCount;
    task.maxRetries = state.maxRetries;
    task.updatedAt = new Date().toISOString();
    this.emitTaskUpdate(task);
  }

  private addMessage(
    task: TaskRecord,
    type: AgentMessage['type'],
    content: string,
    from: AgentRole,
    to: AgentRole = AgentRole.MANAGER
  ): void {
    task.messages.push({
      id: `msg_${Date.now()}_${task.messages.length}`,
      taskId: task.id,
      from,
      to,
      type,
      content,
      createdAt: new Date().toISOString()
    });
  }

  private addProgressDelta(task: TaskRecord, content: string, from: AgentRole = AgentRole.MANAGER): void {
    const normalized = content.trim();
    if (!normalized) {
      return;
    }

    task.messages.push({
      id: `progress_${task.id}`,
      taskId: task.id,
      from,
      to: AgentRole.MANAGER,
      type: 'summary_delta',
      content: `${normalized}\n`,
      createdAt: new Date().toISOString()
    });
  }

  private upsertAgentState(task: TaskRecord, nextState: AgentExecutionState): void {
    const index = task.agentStates.findIndex(item => item.role === nextState.role);
    if (index >= 0) {
      task.agentStates[index] = { ...nextState };
      this.emitTaskUpdate(task);
      return;
    }
    task.agentStates.push({ ...nextState });
    this.emitTaskUpdate(task);
  }

  private setSubTaskStatus(
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ): void {
    const target = task.plan?.subTasks.find(subTask => subTask.assignedTo === role);
    if (target) {
      target.status = status;
      this.emitTaskUpdate(task);
    }
  }

  private addTrace(
    trace: ExecutionTrace[],
    node: string,
    summary: string,
    data?: Record<string, unknown>,
    task?: TaskRecord
  ): void {
    trace.push({
      node,
      at: new Date().toISOString(),
      summary,
      data
    });
    if (task) {
      this.emitTaskUpdate(task);
    }
  }

  private ensureTaskNotCancelled(task: TaskRecord): void {
    if (!this.cancelledTasks.has(task.id) && task.status !== TaskStatus.CANCELLED) {
      return;
    }
    throw new TaskCancelledError(task.id);
  }
}

class TaskCancelledError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled.`);
  }
}
