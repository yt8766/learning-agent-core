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
  ManagerPlan,
  MemoryRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord,
  TaskStatus,
  ToolExecutionResult
} from '@agent/shared';
import { FileRuleRepository, MemoryRepository, PendingExecutionRecord, RuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, createDefaultToolRegistry, StubSandboxExecutor } from '@agent/tools';

import { ExecutorAgent, ManagerAgent, ResearchAgent, ReviewerAgent } from '../flows/chat';
import { createAgentGraph, createInitialState, RuntimeAgentGraphState } from './chat.graph';
import { ZhipuLlmProvider } from '../adapters/llm/zhipu-provider';

interface PendingExecutionContext {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
}

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

export class AgentOrchestrator {
  private readonly sandbox = new StubSandboxExecutor();
  private readonly ruleRepository = new FileRuleRepository();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly learningJobs = new Map<string, LearningJob>();
  private readonly pendingExecutions = new Map<string, PendingExecutionContext>();
  private readonly llm = new ZhipuLlmProvider();
  private readonly settings = loadSettings() as ReturnType<typeof loadSettings> & AgentRuntimeSettings;
  private readonly toolRegistry = createDefaultToolRegistry();
  private readonly taskSubscribers = new Set<(task: TaskRecord) => void>();
  private readonly tokenSubscribers = new Set<(event: AgentTokenEvent) => void>();
  private initializationPromise?: Promise<void>;

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly skillRegistry: SkillRegistry,
    private readonly approvalService: ApprovalService,
    private readonly runtimeStateRepository: RuntimeStateRepository
  ) {}

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
    return [
      'Goal Intake',
      'Route',
      'Manager Plan',
      'Dispatch',
      'Research',
      'Execute',
      'Review',
      'Manager Replan / Finish'
    ];
  }

  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const sessionId = (dto as CreateTaskDto & { sessionId?: string }).sessionId;
    const task: TaskRecord = {
      id: `task_${Date.now()}`,
      goal: dto.goal,
      sessionId,
      status: TaskStatus.QUEUED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
      currentStep: 'queued',
      retryCount: 0,
      maxRetries: 1
    };

    this.tasks.set(task.id, task);
    await this.persistAndEmitTask(task);
    await this.runTaskPipeline(task, dto, { mode: 'initial' });
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
      task.review = {
        taskId,
        decision: 'blocked',
        notes: ['Human approval rejected the high-risk action.'],
        createdAt: new Date().toISOString()
      };
      this.addTrace(task.trace, 'approval_gate', `Approval rejected for ${dto.intent}`);
      this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
      await this.persistAndEmitTask(task);
      return task;
    }

    this.addTrace(task.trace, 'approval_gate', `Approval granted for ${dto.intent}`);

    const pending = this.pendingExecutions.get(taskId);
    if (!pending) {
      task.status = TaskStatus.RUNNING;
      task.result = '已收到审批结果，但当前没有找到待恢复的执行上下文。';
      await this.persistAndEmitTask(task);
      return task;
    }

    this.pendingExecutions.delete(taskId);
    await this.persistAndEmitTask(task);
    await this.runTaskPipeline(
      task,
      { goal: task.goal, context: pending.researchSummary, constraints: [] },
      {
        mode: 'approval_resume',
        pending
      }
    );
    return task;
  }

  async listRules(): Promise<RuleRecord[]> {
    await this.initialize();
    return this.ruleRepository.list();
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
    await this.skillRegistry.publishToLab(skill);
    await this.persistRuntimeState();

    return job;
  }

  getLearningJob(jobId: string): LearningJob | undefined {
    return this.learningJobs.get(jobId);
  }

  private async hydrateRuntimeState(): Promise<void> {
    const snapshot = await this.runtimeStateRepository.load();
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
    const snapshot = await this.runtimeStateRepository.load();
    await this.runtimeStateRepository.save({
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
    for (const subscriber of this.tokenSubscribers) {
      subscriber(event);
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
    task.updatedAt = new Date().toISOString();
    task.result = undefined;
    await this.persistAndEmitTask(task);

    const manager = new ManagerAgent(this.createAgentContext(task.id, dto.goal));
    const research = new ResearchAgent(this.createAgentContext(task.id, dto.goal));
    const executor = new ExecutorAgent(this.createAgentContext(task.id, dto.goal));
    const reviewer = new ReviewerAgent(this.createAgentContext(task.id, dto.goal));

    if (this.shouldHandleAsDirectReply(dto.goal, options.mode)) {
      await this.runDirectReplyTask(task, manager);
      return;
    }

    const graph = createAgentGraph({
      goalIntake: async state => {
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
        this.addTrace(task.trace, 'goal_intake', `${action}: ${dto.goal}`);
        await this.persistAndEmitTask(task);
        return {
          ...state,
          currentStep: 'goal_intake',
          observations: [...state.observations, `goal:${dto.goal}`]
        };
      },
      route: async state => {
        this.syncTaskRuntime(task, {
          currentStep: 'route',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
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
        const plan = await manager.plan();
        task.plan = plan;
        task.review = undefined;
        this.syncTaskRuntime(task, {
          currentStep: 'manager_plan',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
        });
        this.upsertAgentState(task, manager.getState());
        this.addTrace(
          task.trace,
          state.retryCount > 0 ? 'manager_replan' : 'manager_plan',
          `Manager generated ${plan.subTasks.length} sub tasks${state.retryCount > 0 ? ` on retry ${state.retryCount}` : ''}`
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
        this.syncTaskRuntime(task, {
          currentStep: 'dispatch',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
        });
        this.recordDispatches(task, state.dispatches);
        await this.persistAndEmitTask(task);
        return {
          ...state,
          currentStep: 'dispatch'
        };
      },
      research: async state => {
        this.syncTaskRuntime(task, {
          currentStep: 'research',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
        });
        this.setSubTaskStatus(task, AgentRole.RESEARCH, 'running');
        const researchResult = await research.run(
          state.dispatches[0]?.objective ?? 'Research shared memory and skills'
        );
        this.upsertAgentState(task, research.getState());
        this.addMessage(task, 'research_result', researchResult.summary, AgentRole.RESEARCH);
        this.addTrace(task.trace, 'research', researchResult.summary, {
          memoryCount: researchResult.memories.length,
          skillCount: researchResult.skills.length,
          toolCandidates: this.toolRegistry.list().length
        });
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
        this.syncTaskRuntime(task, {
          currentStep: 'execute',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
        });
        this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');

        if (state.resumeFromApproval && state.toolIntent && state.toolName) {
          const approvedResult = await this.executeApprovedAction(
            task.id,
            dto.goal,
            state.toolIntent,
            state.toolName,
            state.researchSummary ?? ''
          );
          this.syncApprovedExecutorState(
            task,
            executor,
            approvedResult,
            state.toolIntent,
            state.toolName,
            state.researchSummary ?? ''
          );
          this.addMessage(task, 'execution_result', approvedResult.outputSummary, AgentRole.EXECUTOR);
          this.addTrace(task.trace, 'execute', approvedResult.outputSummary, {
            intent: state.toolIntent,
            toolName: state.toolName,
            approved: true,
            exitCode: approvedResult.exitCode
          });
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
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

        const execution = await executor.run(
          state.dispatches[1]?.objective ?? 'Execute the candidate action',
          state.researchSummary ?? 'No research summary available.'
        );
        this.upsertAgentState(task, executor.getState());
        this.addMessage(task, 'execution_result', execution.summary, AgentRole.EXECUTOR);
        this.addTrace(task.trace, 'execute', execution.summary, {
          intent: execution.intent,
          toolName: execution.toolName,
          requiresApproval: execution.requiresApproval,
          llmConfigured: this.llm.isConfigured(),
          retryCount: state.retryCount
        });

        if (execution.requiresApproval) {
          task.status = TaskStatus.WAITING_APPROVAL;
          task.result = execution.summary;
          task.approvals.push({
            taskId: task.id,
            intent: execution.intent,
            decision: 'pending',
            decidedAt: new Date().toISOString(),
            reason: `Waiting for human approval before executor can use ${execution.toolName}.`
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
            `Execution paused because ${execution.intent} via ${execution.toolName} requires approval`
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
        this.syncTaskRuntime(task, {
          currentStep: 'review',
          retryCount: state.retryCount,
          maxRetries: state.maxRetries
        });
        const reviewed = await this.reviewExecution(
          task,
          reviewer,
          state.executionResult,
          state.executionSummary ?? task.result ?? 'No execution summary available.'
        );

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

        await this.persistLearningArtifacts(
          task,
          dto.goal,
          reviewed.evaluation,
          reviewed.review,
          state.executionSummary ?? ''
        );
        const finalAnswer = await manager.finalize(
          reviewed.review,
          state.executionSummary ?? task.result ?? 'No execution summary available.'
        );
        this.upsertAgentState(task, manager.getState());
        this.addMessage(task, 'summary', finalAnswer, AgentRole.MANAGER);
        this.addTrace(task.trace, 'finish', finalAnswer);

        task.result = finalAnswer;
        task.status = reviewed.review.decision === 'approved' ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        task.updatedAt = new Date().toISOString();
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

  private async executeApprovedAction(
    taskId: string,
    goal: string,
    intent: ActionIntent,
    toolName: string,
    researchSummary: string
  ): Promise<ToolExecutionResult> {
    return this.sandbox.execute({
      taskId,
      toolName,
      intent,
      input: {
        goal,
        researchSummary,
        approved: true
      },
      requestedBy: 'agent'
    });
  }

  private syncApprovedExecutorState(
    task: TaskRecord,
    executor: ExecutorAgent,
    executionResult: ToolExecutionResult,
    intent: ActionIntent,
    toolName: string,
    researchSummary: string
  ): void {
    const executorState = executor.getState();
    executorState.status = 'completed';
    executorState.subTask = 'Execute the approved action';
    executorState.plan = ['Receive human approval', 'Execute approved high-risk action'];
    executorState.toolCalls = [`intent:${intent}`, `tool:${toolName}`];
    executorState.observations = [executionResult.outputSummary];
    executorState.shortTermMemory = [researchSummary, executionResult.outputSummary];
    executorState.finalOutput = executionResult.outputSummary;
    this.upsertAgentState(task, executorState);
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

  private async persistLearningArtifacts(
    task: TaskRecord,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ): Promise<void> {
    if (evaluation.shouldWriteMemory) {
      const memory = this.buildMemoryRecord(task.id, goal, evaluation, review, executionSummary);
      await this.memoryRepository.append(memory);
      this.addTrace(task.trace, 'memory_write', `Wrote memory record ${memory.id}`);
    }

    if (evaluation.shouldCreateRule) {
      const rule = this.buildRuleRecord(task.id, executionSummary);
      await this.ruleRepository.append(rule);
      this.addTrace(task.trace, 'rule_write', `Wrote rule record ${rule.id}`);
    }

    if (evaluation.shouldExtractSkill) {
      const skill = this.buildSkillDraft(goal, 'execution');
      await this.skillRegistry.publishToLab(skill);
      this.addTrace(task.trace, 'skill_extract', `Published skill ${skill.id} to lab`);
    }
  }

  private shouldHandleAsDirectReply(goal: string, mode: 'initial' | 'retry' | 'approval_resume'): boolean {
    if (mode === 'approval_resume') {
      return false;
    }

    const normalized = goal.trim().toLowerCase();
    if (!normalized || normalized.length > 32) {
      return false;
    }

    return ['ä½ æ¯è°', 'ä½ æ¯èª°', 'ä»ç»ä¸ä¸ä½ èªå·±', 'ä»ç»ä½ èªå·±', 'ä½ è½åä»ä¹', 'ä½ ä¼ä»ä¹', 'who are you'].some(
      pattern => normalized.includes(pattern)
    );
  }

  private async runDirectReplyTask(task: TaskRecord, manager: ManagerAgent): Promise<void> {
    this.syncTaskRuntime(task, {
      currentStep: 'direct_reply',
      retryCount: task.retryCount ?? 0,
      maxRetries: task.maxRetries ?? 1
    });
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
    await this.persistAndEmitTask(task);
  }

  private createAgentContext(taskId: string, goal: string) {
    return {
      taskId,
      goal,
      memoryRepository: this.memoryRepository,
      skillRegistry: this.skillRegistry,
      approvalService: this.approvalService,
      toolRegistry: this.toolRegistry,
      sandbox: this.sandbox,
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
}
