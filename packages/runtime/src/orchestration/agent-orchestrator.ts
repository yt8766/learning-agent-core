import { loadSettings } from '@agent/config';
import { ApprovalDecision as ApprovalDecisionValue } from '@agent/core';
import type {
  AgentExecutionState,
  AgentMessageRecord as AgentMessage,
  AgentTokenEvent,
  ApprovalActionDto,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto,
  ExecutionTrace,
  LearningConflictRecord,
  LearningCandidateRecord,
  ManagerPlan,
  ReviewRecord,
  RuleRecord,
  WorkerDefinition
} from '@agent/core';
import type {
  RuntimeLearningJob as LearningJob,
  RuntimeLearningQueueItem as LearningQueueItem
} from '../runtime/runtime-learning.types';
import type { RuntimeTaskRecord as TaskRecord } from '../runtime/runtime-task.types';

type ApprovalDecision = (typeof ApprovalDecisionValue)[keyof typeof ApprovalDecisionValue];

import type { PendingExecutionContext } from '../flows/approval';
import { createMainGraphRuntimeModules } from './main-graph-runtime-modules';
import type {
  AgentOrchestratorDependencies,
  AgentRuntimeSettings,
  LocalSkillSuggestionResolver,
  PreExecutionSkillInterventionResolver,
  RuntimeSkillInterventionResolver,
  SkillInstallApprovalResolver
} from '../graphs/main/main-graph.types';
import type { MainGraphRuntimeModuleBundle } from './main-graph-runtime-modules';

export type { AgentOrchestratorDependencies } from '../graphs/main/main-graph.types';

export class AgentOrchestrator {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly learningJobs = new Map<string, LearningJob>();
  private readonly learningQueue = new Map<string, LearningQueueItem>();
  private readonly pendingExecutions = new Map<string, PendingExecutionContext>();
  private readonly llm: AgentOrchestratorDependencies['llmProvider'];
  private readonly settings: ReturnType<typeof loadSettings> & AgentRuntimeSettings;
  private readonly toolRegistry: MainGraphRuntimeModuleBundle['toolRegistry'];
  private readonly workerRegistry: MainGraphRuntimeModuleBundle['workerRegistry'];
  private readonly modelRoutingPolicy: MainGraphRuntimeModuleBundle['modelRoutingPolicy'];
  private readonly learningFlow: MainGraphRuntimeModuleBundle['learningFlow'];
  private readonly taskFactory: MainGraphRuntimeModuleBundle['taskFactory'];
  private readonly taskDrafts: MainGraphRuntimeModuleBundle['taskDrafts'];
  private readonly taskContextRuntime: MainGraphRuntimeModuleBundle['taskContextRuntime'];
  private readonly runtime: MainGraphRuntimeModuleBundle['runtime'];
  private readonly backgroundRuntime: MainGraphRuntimeModuleBundle['backgroundRuntime'];
  private readonly executionHelpers: MainGraphRuntimeModuleBundle['executionHelpers'];
  private readonly learningJobsRuntime: MainGraphRuntimeModuleBundle['learningJobsRuntime'];
  private readonly lifecycle: MainGraphRuntimeModuleBundle['lifecycle'];
  private readonly bridge: MainGraphRuntimeModuleBundle['bridge'];
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

    const modules = createMainGraphRuntimeModules({
      dependencies,
      settings: this.settings,
      llm: this.llm,
      tasks: this.tasks,
      learningJobs: this.learningJobs,
      learningQueue: this.learningQueue,
      pendingExecutions: this.pendingExecutions,
      cancelledTasks: this.cancelledTasks,
      emitToken: this.emitToken.bind(this),
      emitTaskUpdate: task => {
        for (const subscriber of this.taskSubscribers) {
          subscriber(task);
        }
      },
      getLocalSkillSuggestionResolver: () => this.localSkillSuggestionResolver,
      getPreExecutionSkillInterventionResolver: () => this.preExecutionSkillInterventionResolver,
      getRuntimeSkillInterventionResolver: () => this.runtimeSkillInterventionResolver,
      getSkillInstallApprovalResolver: () => this.skillInstallApprovalResolver
    });

    this.toolRegistry = modules.toolRegistry;
    this.workerRegistry = modules.workerRegistry;
    this.modelRoutingPolicy = modules.modelRoutingPolicy;
    this.learningFlow = modules.learningFlow;
    this.taskFactory = modules.taskFactory;
    this.taskDrafts = modules.taskDrafts;
    this.taskContextRuntime = modules.taskContextRuntime;
    this.runtime = modules.runtime;
    this.backgroundRuntime = modules.backgroundRuntime;
    this.executionHelpers = modules.executionHelpers;
    this.learningJobsRuntime = modules.learningJobsRuntime;
    this.lifecycle = modules.lifecycle;
    this.bridge = modules.bridge;
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

  acquireBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return this.lifecycle.acquireBackgroundLease(taskId, owner, ttlMs);
  }

  heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return this.lifecycle.heartbeatBackgroundLease(taskId, owner, ttlMs);
  }

  releaseBackgroundLease(taskId: string, owner: string) {
    return this.lifecycle.releaseBackgroundLease(taskId, owner);
  }

  listExpiredBackgroundLeases(): TaskRecord[] {
    return this.lifecycle.listExpiredBackgroundLeases();
  }

  reclaimExpiredBackgroundLease(taskId: string, owner: string) {
    return this.lifecycle.reclaimExpiredBackgroundLease(taskId, owner);
  }

  runBackgroundTask(taskId: string) {
    return this.lifecycle.runBackgroundTask(taskId);
  }

  markBackgroundTaskRunnerFailure(taskId: string, reason: string) {
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

  retryTask(taskId: string) {
    return this.lifecycle.retryTask(taskId);
  }

  cancelTask(taskId: string, reason?: string) {
    return this.lifecycle.cancelTask(taskId, reason);
  }

  deleteSessionState(sessionId: string) {
    return this.lifecycle.deleteSessionState(sessionId);
  }

  applyApproval(taskId: string, dto: ApprovalActionDto, decision: ApprovalDecision) {
    return this.lifecycle.applyApproval(taskId, dto, decision);
  }

  ensureLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    return this.lifecycle.ensureLearningCandidates(task);
  }

  confirmLearning(taskId: string, candidateIds?: string[]) {
    return this.lifecycle.confirmLearning(taskId, candidateIds);
  }

  sweepInterruptTimeouts() {
    return this.lifecycle.sweepInterruptTimeouts();
  }

  scanLearningConflicts() {
    return this.lifecycle.scanLearningConflicts();
  }

  processLearningQueue(maxItems?: number) {
    return this.lifecycle.processLearningQueue(maxItems);
  }

  processQueuedLearningJobs(maxItems?: number) {
    return this.lifecycle.processQueuedLearningJobs(maxItems);
  }

  updateLearningConflictStatus(
    conflictId: string,
    status: LearningConflictRecord['status'],
    preferredMemoryId?: string
  ) {
    return this.lifecycle.updateLearningConflictStatus(conflictId, status, preferredMemoryId);
  }

  listRules(): Promise<RuleRecord[]> {
    return this.lifecycle.listRules();
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    return this.lifecycle.createDocumentLearningJob(dto);
  }

  createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
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
}
