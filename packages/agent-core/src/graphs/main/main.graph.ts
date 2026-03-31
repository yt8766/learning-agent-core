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
  CreateResearchLearningJobDto,
  CreateTaskDto,
  EvaluationResult,
  EvidenceRecord,
  ExecutionTrace,
  LlmUsageRecord,
  LearningJob,
  LearningQueueItem,
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
  ModelRouteDecision,
  SkillSearchStateRecord,
  QueueStateRecord,
  RequestedExecutionHints,
  SubgraphId,
  WorkerDefinition
} from '@agent/shared';
import { MemoryRepository, MemorySearchService, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { MemorySaver } from '@langchain/langgraph';
import {
  ApprovalService,
  McpClientManager,
  SandboxExecutor,
  ToolRegistry,
  createDefaultToolRegistry
} from '@agent/tools';

import { createApprovalRecoveryGraph } from '../recovery.graph';
import { MainGraphBackgroundRuntime } from './main-graph-background';
import { MainGraphBridge } from './main-graph-bridge';
import { MainGraphExecutionHelpers } from './main-graph-execution-helpers';
import { MainGraphLifecycle } from './main-graph-lifecycle';
import { MainGraphTaskContextRuntime } from './main-graph-task-context';
import { MainGraphTaskDrafts } from './main-graph-task-drafts';
import { MainGraphTaskFactory } from './main-graph-task-factory';
import { MainGraphLearningJobsRuntime } from './main-graph-learning-jobs';
import { MainGraphTaskRuntime } from './main-graph-task-runtime';
import { executeApprovedAction, PendingExecutionContext } from '../../flows/approval';
import { LibuRouterMinistry, XingbuReviewMinistry } from '../../flows/ministries';
import { buildResearchSourcePlan, mergeEvidence } from '../../workflows/research-source-planner';
import { LearningFlow } from '../../flows/learning';
import { RuntimeAgentGraphState } from '../chat.graph';
import { LlmProvider } from '../../adapters/llm/llm-provider';
import { buildWorkflowPresetPlan, resolveWorkflowPreset } from '../../workflows/workflow-preset-registry';
import { resolveWorkflowRoute } from '../../workflows/workflow-route-registry';
import {
  createDefaultWorkerRegistry,
  WorkerRegistry,
  WorkerSelectionConstraints
} from '../../governance/worker-registry';
import { ModelRoutingPolicy } from '../../governance/model-routing-policy';
import { describeConnectorProfilePolicy } from '../../governance/profile-policy';

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
  memorySearchService?: MemorySearchService;
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

type LocalSkillSuggestionResolver = (params: {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: string;
}) => Promise<SkillSearchStateRecord>;

type PreExecutionSkillInterventionResolver = (params: {
  goal: string;
  taskId: string;
  runId: string;
  sessionId?: string;
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
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

type RuntimeSkillInterventionResolver = (params: {
  task: TaskRecord;
  goal: string;
  currentStep: 'direct_reply' | 'research';
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
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

type SkillInstallApprovalResolver = (params: {
  task: TaskRecord;
  pending: PendingExecutionContext;
  actor?: string;
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
      usedInstalledSkills?: string[];
      traceSummary?: string;
      progressSummary?: string;
    }
  | undefined
>;

export class AgentOrchestrator {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly learningJobs = new Map<string, LearningJob>();
  private readonly learningQueue = new Map<string, LearningQueueItem>();
  private readonly pendingExecutions = new Map<string, PendingExecutionContext>();
  private readonly llm: LlmProvider;
  private readonly settings: ReturnType<typeof loadSettings> & AgentRuntimeSettings;
  private readonly toolRegistry: ToolRegistry;
  private readonly workerRegistry: WorkerRegistry;
  private readonly modelRoutingPolicy: ModelRoutingPolicy;
  private readonly learningFlow: LearningFlow;
  private readonly taskFactory: MainGraphTaskFactory;
  private readonly taskDrafts: MainGraphTaskDrafts;
  private readonly taskContextRuntime: MainGraphTaskContextRuntime;
  private readonly runtime: MainGraphTaskRuntime;
  private readonly backgroundRuntime: MainGraphBackgroundRuntime;
  private readonly executionHelpers: MainGraphExecutionHelpers;
  private readonly learningJobsRuntime: MainGraphLearningJobsRuntime;
  private readonly lifecycle: MainGraphLifecycle;
  private readonly bridge: MainGraphBridge;
  private readonly graphCheckpointer = new MemorySaver();
  private localSkillSuggestionResolver?: LocalSkillSuggestionResolver;
  private preExecutionSkillInterventionResolver?: PreExecutionSkillInterventionResolver;
  private runtimeSkillInterventionResolver?: RuntimeSkillInterventionResolver;
  private skillInstallApprovalResolver?: SkillInstallApprovalResolver;
  private readonly taskSubscribers = new Set<(task: TaskRecord) => void>();
  private readonly tokenSubscribers = new Set<(event: AgentTokenEvent) => void>();
  private readonly cancelledTasks = new Set<string>();

  constructor(private readonly dependencies: AgentOrchestratorDependencies) {
    this.llm = dependencies.llmProvider;
    this.settings = dependencies.settings ?? (loadSettings() as ReturnType<typeof loadSettings> & AgentRuntimeSettings);
    this.toolRegistry = dependencies.toolRegistry ?? createDefaultToolRegistry();
    this.workerRegistry = dependencies.workerRegistry ?? createDefaultWorkerRegistry();
    this.modelRoutingPolicy = new ModelRoutingPolicy(this.workerRegistry);
    this.learningFlow = new LearningFlow({
      memoryRepository: dependencies.memoryRepository,
      memorySearchService: dependencies.memorySearchService,
      ruleRepository: dependencies.ruleRepository,
      skillRegistry: dependencies.skillRegistry,
      llmProvider: this.llm,
      thinking: this.settings.zhipuThinking.manager,
      settings: this.settings,
      localSkillSuggestionResolver: async task =>
        this.localSkillSuggestionResolver
          ? this.localSkillSuggestionResolver({
              goal: task.goal,
              usedInstalledSkills: task.usedInstalledSkills,
              requestedHints: task.requestedHints,
              specialistDomain: task.specialistLead?.domain
            })
          : undefined
    });
    this.taskFactory = new MainGraphTaskFactory(
      this.settings,
      (...args) => this.bridge.createQueueState(...args),
      (task, node, summary, data) => this.bridge.addTrace(task.trace, node, summary, data),
      (...args) => this.bridge.addProgressDelta(...args),
      (...args) => this.bridge.markSubgraph(...args),
      (...args) => this.bridge.attachTool(...args),
      (...args) => this.bridge.recordToolUsage(...args)
    );
    this.taskDrafts = new MainGraphTaskDrafts(this.tasks);
    this.taskContextRuntime = new MainGraphTaskContextRuntime(
      dependencies,
      this.settings,
      this.llm,
      this.toolRegistry,
      this.workerRegistry,
      this.tasks,
      (task, node, summary, data) => this.bridge.addTrace(task.trace, node, summary, data, task),
      (...args) => this.bridge.updateBudgetState(...args),
      this.emitToken.bind(this),
      task => this.lifecycle.persistAndEmitTask(task)
    );
    this.runtime = new MainGraphTaskRuntime(
      dependencies,
      this.settings,
      this.workerRegistry,
      this.modelRoutingPolicy,
      this.cancelledTasks,
      task => this.lifecycle.emitTaskUpdate(task)
    );
    this.backgroundRuntime = new MainGraphBackgroundRuntime(
      this.tasks,
      this.pendingExecutions,
      this.cancelledTasks,
      (...args) => this.bridge.updateBudgetState(...args),
      (...args) => this.bridge.transitionQueueState(...args),
      (task, node, summary, data) => this.bridge.addTrace(task.trace, node, summary, data),
      (...args) => this.bridge.addProgressDelta(...args),
      (...args) => this.bridge.markSubgraph(...args),
      task => this.lifecycle.persistAndEmitTask(task),
      () => this.lifecycle.persistRuntimeState(),
      () => this.bridge.runBootstrapGraph.bind(this.bridge),
      () => this.runTaskPipeline.bind(this)
    );
    this.executionHelpers = new MainGraphExecutionHelpers(
      (...args) => this.bridge.createAgentContext(...args),
      task => this.lifecycle.persistAndEmitTask(task),
      (...args) => this.bridge.ensureTaskNotCancelled(...args),
      (...args) => this.bridge.syncTaskRuntime(...args),
      (...args) => this.bridge.transitionQueueState(...args),
      (...args) => this.bridge.setSubTaskStatus(...args),
      (...args) => this.bridge.upsertAgentState(...args),
      (...args) => this.bridge.addMessage(...args),
      (task, node, summary, data) => this.bridge.addTrace(task.trace, node, summary, data),
      (...args) => this.bridge.addProgressDelta(...args),
      () => this.runTaskPipeline.bind(this)
    );
    this.learningJobsRuntime = new MainGraphLearningJobsRuntime(
      this.settings,
      this.learningJobs,
      this.learningFlow,
      this.dependencies.skillRegistry,
      this.dependencies.mcpClientManager,
      (...args) => this.bridge.buildSkillDraft(...args),
      () => this.lifecycle.persistRuntimeState()
    );
    this.lifecycle = new MainGraphLifecycle({
      tasks: this.tasks,
      learningJobs: this.learningJobs,
      learningQueue: this.learningQueue,
      pendingExecutions: this.pendingExecutions,
      runtimeStateRepository: dependencies.runtimeStateRepository,
      memoryRepository: dependencies.memoryRepository,
      memorySearchService: dependencies.memorySearchService,
      ruleRepository: dependencies.ruleRepository,
      workerRegistry: this.workerRegistry,
      taskFactory: this.taskFactory,
      runtime: this.runtime,
      backgroundRuntime: this.backgroundRuntime,
      learningFlow: this.learningFlow,
      learningJobsRuntime: this.learningJobsRuntime,
      getLocalSkillSuggestionResolver: () => this.localSkillSuggestionResolver,
      getPreExecutionSkillInterventionResolver: () => this.preExecutionSkillInterventionResolver,
      getRuntimeSkillInterventionResolver: () => this.runtimeSkillInterventionResolver,
      getSkillInstallApprovalResolver: () => this.skillInstallApprovalResolver,
      emitTaskUpdate: task => {
        for (const subscriber of this.taskSubscribers) subscriber(task);
      },
      runBootstrapGraph: (...args) => this.bridge.runBootstrapGraph(...args),
      runTaskPipeline: (...args) => this.bridge.runTaskPipeline(...args),
      runApprovalRecoveryPipeline: (...args) => this.bridge.runApprovalRecoveryPipeline(...args),
      addTrace: (...args) => this.bridge.addTrace(...args),
      addProgressDelta: (...args) => this.bridge.addProgressDelta(...args),
      markSubgraph: (...args) => this.bridge.markSubgraph(...args),
      transitionQueueState: (...args) => this.bridge.transitionQueueState(...args),
      setSubTaskStatus: (...args) => this.bridge.setSubTaskStatus(...args),
      upsertAgentState: (...args) => this.bridge.upsertAgentState(...args),
      getMinistryLabel: (...args) => this.bridge.getMinistryLabel(...args)
    });
    this.bridge = new MainGraphBridge({
      pendingExecutions: this.pendingExecutions,
      llmConfigured: () => this.llm.isConfigured(),
      sourcePolicyMode: () => this.settings.policy?.sourcePolicyMode,
      lifecycle: this.lifecycle,
      learningFlow: this.learningFlow,
      taskDrafts: this.taskDrafts,
      taskContextRuntime: this.taskContextRuntime,
      runtime: this.runtime,
      executionHelpers: this.executionHelpers,
      graphCheckpointer: this.graphCheckpointer
    });
  }

  async initialize(): Promise<void> {
    await this.lifecycle.initialize();
  }
  subscribe(listener: (task: TaskRecord) => void): () => void {
    this.taskSubscribers.add(listener);
    return () => this.taskSubscribers.delete(listener);
  }
  subscribeTokens(listener: (event: AgentTokenEvent) => void): () => void {
    this.tokenSubscribers.add(listener);
    return () => this.tokenSubscribers.delete(listener);
  }
  describeGraph(): string[] {
    return ['Main Graph Router', 'Chat Graph', 'Approval Recovery Graph', 'Learning Graph'];
  }
  setLocalSkillSuggestionResolver(resolver?: LocalSkillSuggestionResolver) {
    this.localSkillSuggestionResolver = resolver;
  }
  setPreExecutionSkillInterventionResolver(resolver?: PreExecutionSkillInterventionResolver) {
    this.preExecutionSkillInterventionResolver = resolver;
  }
  setRuntimeSkillInterventionResolver(resolver?: RuntimeSkillInterventionResolver) {
    this.runtimeSkillInterventionResolver = resolver;
  }
  setSkillInstallApprovalResolver(resolver?: SkillInstallApprovalResolver) {
    this.skillInstallApprovalResolver = resolver;
  }
  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    return this.lifecycle.createTask(dto);
  }
  getTask(taskId: string): TaskRecord | undefined {
    return this.lifecycle.getTask(taskId);
  }
  listTasks(): TaskRecord[] {
    return this.lifecycle.listTasks();
  }
  listPendingApprovals(): TaskRecord[] {
    return this.lifecycle.listPendingApprovals();
  }
  listWorkers() {
    return this.lifecycle.listWorkers();
  }
  registerWorker(worker: WorkerDefinition) {
    this.lifecycle.registerWorker(worker);
  }
  setWorkerEnabled(workerId: string, enabled: boolean) {
    this.lifecycle.setWorkerEnabled(workerId, enabled);
  }
  isWorkerEnabled(workerId: string) {
    return this.lifecycle.isWorkerEnabled(workerId);
  }
  listQueuedBackgroundTasks(): TaskRecord[] {
    return this.lifecycle.listQueuedBackgroundTasks();
  }
  async acquireBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<TaskRecord | undefined> {
    return this.lifecycle.acquireBackgroundLease(taskId, owner, ttlMs);
  }
  async heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<TaskRecord | undefined> {
    return this.lifecycle.heartbeatBackgroundLease(taskId, owner, ttlMs);
  }
  async releaseBackgroundLease(taskId: string, owner: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.releaseBackgroundLease(taskId, owner);
  }
  listExpiredBackgroundLeases(): TaskRecord[] {
    return this.lifecycle.listExpiredBackgroundLeases();
  }
  async reclaimExpiredBackgroundLease(taskId: string, owner: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.reclaimExpiredBackgroundLease(taskId, owner);
  }
  async runBackgroundTask(taskId: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.runBackgroundTask(taskId);
  }
  async markBackgroundTaskRunnerFailure(taskId: string, reason: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.markBackgroundTaskRunnerFailure(taskId, reason);
  }
  listTaskTraces(taskId: string): ExecutionTrace[] {
    return this.lifecycle.listTaskTraces(taskId);
  }
  getTaskAgents(taskId: string): AgentExecutionState[] {
    return this.lifecycle.getTaskAgents(taskId);
  }
  getTaskMessages(taskId: string): AgentMessage[] {
    return this.lifecycle.getTaskMessages(taskId);
  }
  getTaskPlan(taskId: string): ManagerPlan | undefined {
    return this.lifecycle.getTaskPlan(taskId);
  }
  getTaskReview(taskId: string): ReviewRecord | undefined {
    return this.lifecycle.getTaskReview(taskId);
  }
  async retryTask(taskId: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.retryTask(taskId);
  }
  async cancelTask(taskId: string, reason?: string): Promise<TaskRecord | undefined> {
    return this.lifecycle.cancelTask(taskId, reason);
  }
  async deleteSessionState(sessionId: string): Promise<void> {
    await this.lifecycle.deleteSessionState(sessionId);
  }
  async applyApproval(
    taskId: string,
    dto: ApprovalActionDto,
    decision: ApprovalDecision
  ): Promise<TaskRecord | undefined> {
    return this.lifecycle.applyApproval(taskId, dto, decision);
  }
  ensureLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    return this.lifecycle.ensureLearningCandidates(task);
  }
  async confirmLearning(taskId: string, candidateIds?: string[]): Promise<TaskRecord | undefined> {
    return this.lifecycle.confirmLearning(taskId, candidateIds);
  }
  async sweepInterruptTimeouts(): Promise<TaskRecord[]> {
    return this.lifecycle.sweepInterruptTimeouts();
  }
  async scanLearningConflicts() {
    return this.lifecycle.scanLearningConflicts();
  }
  async processLearningQueue(maxItems?: number) {
    return this.lifecycle.processLearningQueue(maxItems);
  }
  async processQueuedLearningJobs(maxItems?: number) {
    return this.lifecycle.processQueuedLearningJobs(maxItems);
  }
  async updateLearningConflictStatus(
    conflictId: string,
    status: import('@agent/shared').LearningConflictRecord['status'],
    preferredMemoryId?: string
  ) {
    return this.lifecycle.updateLearningConflictStatus(conflictId, status, preferredMemoryId);
  }
  async listRules(): Promise<RuleRecord[]> {
    return this.lifecycle.listRules();
  }
  async createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    return this.lifecycle.createDocumentLearningJob(dto);
  }
  async createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
    return this.lifecycle.createResearchLearningJob(dto);
  }
  getLearningJob(jobId: string): LearningJob | undefined {
    return this.lifecycle.getLearningJob(jobId);
  }
  listLearningJobs(): LearningJob[] {
    return this.lifecycle.listLearningJobs();
  }
  listLearningQueue(): LearningQueueItem[] {
    return this.lifecycle.listLearningQueue();
  }

  private emitToken(event: AgentTokenEvent): void {
    if (this.cancelledTasks.has(event.taskId)) {
      return;
    }
    for (const subscriber of this.tokenSubscribers) {
      subscriber(event);
    }
  }

  private runTaskPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: import('@agent/shared').ApprovalResumeInput;
    }
  ) {
    return this.bridge.runTaskPipeline(task, dto, options);
  }
  private runApprovalRecoveryPipeline(task: TaskRecord, dto: CreateTaskDto, pending: PendingExecutionContext) {
    return this.bridge.runApprovalRecoveryPipeline(task, dto, pending);
  }
  private syncTaskRuntime(
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) {
    this.bridge.syncTaskRuntime(task, state);
  }
}
