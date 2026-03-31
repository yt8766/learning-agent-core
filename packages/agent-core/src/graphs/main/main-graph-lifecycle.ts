import {
  ActionIntent,
  AgentExecutionState,
  AgentMessage,
  AgentRole,
  ApprovalActionDto,
  ApprovalDecision,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto,
  ExecutionTrace,
  LearningCandidateRecord,
  LearningConflictRecord,
  LearningJob,
  LearningQueueItem,
  ManagerPlan,
  RequestedExecutionHints,
  ReviewRecord,
  RuleRecord,
  SkillSearchStateRecord,
  SubgraphId,
  TaskRecord,
  TaskStatus,
  WorkerDefinition
} from '@agent/shared';
import {
  MemoryRepository,
  MemorySearchService,
  PendingExecutionRecord,
  RuleRepository,
  RuntimeStateRepository
} from '@agent/memory';

import {
  appendDiagnosisEvidence,
  buildCitationSourceSummary,
  buildFreshnessSourceSummary,
  recordAgentError,
  upsertFreshnessEvidence
} from './main-graph-knowledge';
import {
  enqueueTaskLearningItem,
  hydrateLifecycleSnapshot,
  listLearningQueueItems,
  persistLifecycleSnapshot
} from './main-graph-lifecycle-state';
import { applyApprovalAction, handleLifecycleInterruptTimeout } from './main-graph-lifecycle-approval';
import {
  createLifecycleDocumentLearningJob,
  createLifecycleResearchLearningJob,
  enqueueLifecycleTaskLearning,
  getLifecycleLearningJob,
  listLifecycleLearningJobs,
  listLifecycleLearningQueue,
  listLifecycleRules,
  processLifecycleLearningQueue,
  scanLifecycleLearningConflicts,
  updateLifecycleLearningConflictStatus
} from './main-graph-lifecycle-learning';
import {
  acquireLifecycleBackgroundLease,
  cancelLifecycleTask,
  deleteLifecycleSessionState,
  heartbeatLifecycleBackgroundLease,
  isLifecycleWorkerEnabled,
  listExpiredLifecycleBackgroundLeases,
  listLifecycleTaskTraces,
  listLifecycleWorkers,
  listQueuedLifecycleBackgroundTasks,
  markLifecycleBackgroundTaskRunnerFailure,
  reclaimExpiredLifecycleBackgroundLease,
  registerLifecycleWorker,
  releaseLifecycleBackgroundLease,
  retryLifecycleTask,
  runLifecycleBackgroundTask,
  setLifecycleWorkerEnabled
} from './main-graph-lifecycle-background';
import {
  applyLifecycleCounselorSelectorGovernance,
  resolveLifecycleKnowledgeReuse
} from './main-graph-lifecycle-governance';
import { MainGraphBackgroundRuntime } from './main-graph-background';
import { MainGraphLearningJobsRuntime } from './main-graph-learning-jobs';
import { MainGraphTaskFactory } from './main-graph-task-factory';
import { MainGraphTaskRuntime } from './main-graph-task-runtime';
import { PendingExecutionContext } from '../../flows/approval';
import { LearningFlow } from '../../flows/learning';
import { WorkerRegistry } from '../../governance/worker-registry';
import { isFreshnessSensitiveGoal } from '../../shared/prompts/temporal-context';
import { resolveSpecialistRoute } from '../../workflows/specialist-routing';
import { resolveWorkflowPreset } from '../../workflows/workflow-preset-registry';

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

interface MainGraphLifecycleParams {
  tasks: Map<string, TaskRecord>;
  learningJobs: Map<string, LearningJob>;
  learningQueue: Map<string, LearningQueueItem>;
  pendingExecutions: Map<string, PendingExecutionContext>;
  runtimeStateRepository: RuntimeStateRepository;
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  ruleRepository: RuleRepository;
  workerRegistry: WorkerRegistry;
  taskFactory: MainGraphTaskFactory;
  runtime: MainGraphTaskRuntime;
  backgroundRuntime: MainGraphBackgroundRuntime;
  learningFlow: LearningFlow;
  learningJobsRuntime: MainGraphLearningJobsRuntime;
  getLocalSkillSuggestionResolver: () => LocalSkillSuggestionResolver | undefined;
  getPreExecutionSkillInterventionResolver: () => PreExecutionSkillInterventionResolver | undefined;
  getRuntimeSkillInterventionResolver: () => RuntimeSkillInterventionResolver | undefined;
  getSkillInstallApprovalResolver: () => SkillInstallApprovalResolver | undefined;
  emitTaskUpdate: (task: TaskRecord) => void;
  runTaskPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: import('@agent/shared').ApprovalResumeInput;
    }
  ) => Promise<void>;
  runBootstrapGraph: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'interrupt_resume';
      resume?: import('@agent/shared').ApprovalResumeInput;
    }
  ) => Promise<void>;
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
  addTrace: (trace: ExecutionTrace[], node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  markSubgraph: (task: TaskRecord, subgraphId: SubgraphId) => void;
  transitionQueueState: (task: TaskRecord, status: NonNullable<TaskRecord['queueState']>['status']) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  upsertAgentState: (task: TaskRecord, nextState: AgentExecutionState) => void;
  getMinistryLabel: (ministry: string) => string;
}

export class MainGraphLifecycle {
  private initializationPromise?: Promise<void>;

  constructor(private readonly params: MainGraphLifecycleParams) {}

  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.hydrateRuntimeState();
    }
    await this.initializationPromise;
  }

  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}`;
    const runId = `run_${Date.now()}`;
    const workflowResolution = resolveWorkflowPreset(dto.goal, {
      constraints: dto.constraints,
      context: dto.context
    });
    const governedDto = await applyLifecycleCounselorSelectorGovernance({
      dto,
      workflowResolution,
      runtimeStateRepository: this.params.runtimeStateRepository
    });
    const knowledgeReuse = await resolveLifecycleKnowledgeReuse({
      taskId,
      runId,
      goal: workflowResolution.normalizedGoal,
      createdAt: now,
      memoryRepository: this.params.memoryRepository,
      memorySearchService: this.params.memorySearchService
    });
    const { task, normalizedGoal } = await this.params.taskFactory.createTaskRecord(
      governedDto,
      knowledgeReuse,
      this.params.getLocalSkillSuggestionResolver(),
      this.params.getPreExecutionSkillInterventionResolver(),
      { now, taskId, runId },
      { deferPreExecutionSkillIntervention: true }
    );
    this.upsertFreshnessEvidence(task);
    this.params.tasks.set(task.id, task);
    await this.persistAndEmitTask(task);
    if (task.sessionId) {
      await this.params.runBootstrapGraph(task, { ...governedDto, goal: normalizedGoal }, { mode: 'initial' });
    }
    if (task.status === TaskStatus.WAITING_APPROVAL) {
      if (task.pendingApproval?.intent === ActionIntent.INSTALL_SKILL) {
        this.params.pendingExecutions.set(task.id, {
          taskId: task.id,
          intent: ActionIntent.INSTALL_SKILL,
          toolName: task.pendingApproval.toolName,
          researchSummary: task.goal,
          kind: 'skill_install',
          receiptId: task.trace
            .slice()
            .reverse()
            .find(item => item.node === 'approval_gate')?.data?.receiptId as string | undefined,
          goal: normalizedGoal,
          usedInstalledSkills: task.usedInstalledSkills,
          currentSkillExecution: task.currentSkillExecution,
          skillDisplayName: task.trace
            .slice()
            .reverse()
            .find(item => item.node === 'approval_gate')?.data?.skillDisplayName as string | undefined
        });
      }
      return task;
    }
    if (task.sessionId) {
      await this.params.runTaskPipeline(task, { ...dto, goal: normalizedGoal }, { mode: 'initial' });
      return task;
    }

    this.params.addTrace(task.trace, 'background_queued', '后台任务已入队，等待后台 runner 消费执行。', {
      mode: 'background',
      runId: task.runId
    });
    this.params.markSubgraph(task, 'background-runner');
    this.params.addProgressDelta(task, '后台任务已入队，等待后台执行器调度。');
    await this.persistAndEmitTask(task);
    return task;
  }

  async resolveRuntimeSkillIntervention(params: {
    task: TaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: SkillSearchStateRecord;
    usedInstalledSkills?: string[];
  }) {
    const resolver = this.params.getRuntimeSkillInterventionResolver();
    return resolver ? resolver(params) : undefined;
  }

  getPreExecutionSkillInterventionResolver() {
    return this.params.getPreExecutionSkillInterventionResolver();
  }

  async resolveSkillInstallInterruptResume(params: {
    task: TaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) {
    const resolver = this.params.getSkillInstallApprovalResolver();
    if (!resolver) {
      return undefined;
    }

    return resolver({
      task: params.task,
      pending: {
        taskId: params.task.id,
        intent: ActionIntent.INSTALL_SKILL,
        toolName: params.task.pendingApproval?.toolName ?? 'npx skills add',
        researchSummary: params.task.goal,
        kind: 'skill_install',
        receiptId: params.receiptId,
        goal: params.task.goal,
        usedInstalledSkills: params.usedInstalledSkills,
        skillDisplayName: params.skillDisplayName,
        currentSkillExecution: params.task.currentSkillExecution
      },
      actor: params.actor
    });
  }

  getTask(taskId: string) {
    return this.params.tasks.get(taskId);
  }
  listTasks(): TaskRecord[] {
    return [...this.params.tasks.values()].sort(
      (l, r) => new Date(r.updatedAt).getTime() - new Date(l.updatedAt).getTime()
    );
  }
  listPendingApprovals(): TaskRecord[] {
    return this.listTasks().filter(task => task.approvals.some(approval => approval.decision === 'pending'));
  }
  listWorkers() {
    return listLifecycleWorkers(this.params.workerRegistry);
  }
  registerWorker(worker: WorkerDefinition) {
    registerLifecycleWorker(this.params.workerRegistry, worker);
  }
  setWorkerEnabled(workerId: string, enabled: boolean) {
    setLifecycleWorkerEnabled(this.params.workerRegistry, workerId, enabled);
  }
  isWorkerEnabled(workerId: string) {
    return isLifecycleWorkerEnabled(this.params.workerRegistry, workerId);
  }
  listQueuedBackgroundTasks(): TaskRecord[] {
    return listQueuedLifecycleBackgroundTasks(this.params.backgroundRuntime, () => this.listTasks());
  }
  async acquireBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return acquireLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner, ttlMs);
  }
  async heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return heartbeatLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner, ttlMs);
  }
  async releaseBackgroundLease(taskId: string, owner: string) {
    return releaseLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner);
  }
  listExpiredBackgroundLeases(): TaskRecord[] {
    return listExpiredLifecycleBackgroundLeases(this.params.backgroundRuntime, () => this.listTasks());
  }
  async reclaimExpiredBackgroundLease(taskId: string, owner: string) {
    return reclaimExpiredLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner);
  }
  async runBackgroundTask(taskId: string) {
    return runLifecycleBackgroundTask(this.getBackgroundLifecycleDeps(), taskId);
  }
  async markBackgroundTaskRunnerFailure(taskId: string, reason: string) {
    return markLifecycleBackgroundTaskRunnerFailure(this.getBackgroundLifecycleDeps(), taskId, reason);
  }
  listTaskTraces(taskId: string): ExecutionTrace[] {
    return listLifecycleTaskTraces(this.params.tasks, taskId);
  }
  getTaskAgents(taskId: string): AgentExecutionState[] {
    return this.params.tasks.get(taskId)?.agentStates ?? [];
  }
  getTaskMessages(taskId: string): AgentMessage[] {
    return this.params.tasks.get(taskId)?.messages ?? [];
  }
  getTaskPlan(taskId: string): ManagerPlan | undefined {
    return this.params.tasks.get(taskId)?.plan;
  }
  getTaskReview(taskId: string): ReviewRecord | undefined {
    return this.params.tasks.get(taskId)?.review;
  }
  async retryTask(taskId: string) {
    return retryLifecycleTask(this.getBackgroundLifecycleDeps(), taskId);
  }
  async cancelTask(taskId: string, reason?: string) {
    return cancelLifecycleTask(this.getBackgroundLifecycleDeps(), taskId, reason);
  }
  async deleteSessionState(sessionId: string) {
    await deleteLifecycleSessionState(this.getBackgroundLifecycleDeps(), sessionId);
  }

  async applyApproval(
    taskId: string,
    dto: ApprovalActionDto,
    decision: ApprovalDecision
  ): Promise<TaskRecord | undefined> {
    await this.initialize();
    return applyApprovalAction(
      {
        ...this.params,
        persistAndEmitTask: task => this.persistAndEmitTask(task)
      },
      taskId,
      dto,
      decision
    );
  }

  ensureLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    return this.params.learningFlow.ensureCandidates(task);
  }

  async confirmLearning(taskId: string, candidateIds?: string[]): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.params.tasks.get(taskId);
    if (!task) return undefined;
    this.params.learningFlow.ensureCandidates(task);
    await this.params.learningFlow.confirmCandidates(task, candidateIds);
    task.updatedAt = new Date().toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  async sweepInterruptTimeouts(): Promise<TaskRecord[]> {
    await this.initialize();
    const now = new Date().toISOString();
    const timedOut = this.listTasks().filter(task => {
      const interrupt = task.activeInterrupt;
      return Boolean(
        interrupt &&
        interrupt.status === 'pending' &&
        interrupt.timeoutMinutes &&
        new Date(interrupt.createdAt).getTime() + interrupt.timeoutMinutes * 60_000 <= new Date(now).getTime()
      );
    });

    const updated: TaskRecord[] = [];
    for (const task of timedOut) {
      const result = await this.handleInterruptTimeout(task, now);
      if (result) {
        updated.push(result);
      }
    }
    return updated;
  }

  async scanLearningConflicts() {
    await this.initialize();
    return scanLifecycleLearningConflicts(this.params);
  }

  async processLearningQueue(maxItems?: number): Promise<LearningQueueItem[]> {
    await this.initialize();
    return processLifecycleLearningQueue(
      {
        tasks: this.params.tasks,
        learningQueue: this.params.learningQueue,
        learningFlow: this.params.learningFlow,
        persistAndEmitTask: task => this.persistAndEmitTask(task)
      },
      maxItems
    );
  }

  async processQueuedLearningJobs(maxItems?: number): Promise<LearningJob[]> {
    await this.initialize();
    return this.params.learningJobsRuntime.processQueuedLearningJobs(maxItems);
  }

  async updateLearningConflictStatus(
    conflictId: string,
    status: LearningConflictRecord['status'],
    preferredMemoryId?: string
  ) {
    await this.initialize();
    return updateLifecycleLearningConflictStatus(this.params, conflictId, status, preferredMemoryId);
  }

  async listRules(): Promise<RuleRecord[]> {
    await this.initialize();
    return listLifecycleRules(this.params);
  }
  async createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    return createLifecycleDocumentLearningJob(this.params, dto);
  }
  async createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    return createLifecycleResearchLearningJob(this.params, dto);
  }
  getLearningJob(jobId: string): LearningJob | undefined {
    return getLifecycleLearningJob(this.params, jobId);
  }
  listLearningJobs(): LearningJob[] {
    return listLifecycleLearningJobs(this.params);
  }
  listLearningQueue(): LearningQueueItem[] {
    return listLifecycleLearningQueue(this.params);
  }
  enqueueTaskLearning(task: TaskRecord, userFeedback?: string): LearningQueueItem {
    return enqueueLifecycleTaskLearning(this.params, task, userFeedback);
  }

  private async handleInterruptTimeout(task: TaskRecord, now: string): Promise<TaskRecord | undefined> {
    return handleLifecycleInterruptTimeout(
      {
        addTrace: this.params.addTrace,
        addProgressDelta: this.params.addProgressDelta,
        transitionQueueState: this.params.transitionQueueState,
        runTaskPipeline: this.params.runTaskPipeline,
        persistAndEmitTask: currentTask => this.persistAndEmitTask(currentTask)
      },
      task,
      now
    );
  }
  buildFreshnessSourceSummary(task: TaskRecord): string | undefined {
    return buildFreshnessSourceSummary(task, isFreshnessSensitiveGoal(task.goal));
  }

  buildCitationSourceSummary(task: TaskRecord): string | undefined {
    return buildCitationSourceSummary(task);
  }

  describeActionIntent(intent: string): string {
    switch (intent) {
      case ActionIntent.WRITE_FILE:
        return '文件写入';
      case ActionIntent.DELETE_FILE:
        return '文件删除';
      case ActionIntent.SCHEDULE_TASK:
        return '定时任务';
      case ActionIntent.CALL_EXTERNAL_API:
        return '外部请求';
      case ActionIntent.READ_FILE:
        return '文件读取';
      default:
        return intent;
    }
  }

  recordAgentError(
    task: TaskRecord,
    error: unknown,
    context: {
      phase: 'task_pipeline' | 'approval_recovery' | 'background_runner';
      mode?: 'initial' | 'retry' | 'approval_resume';
      goal?: string;
      routeFlow?: string;
      toolName?: string;
      intent?: ActionIntent;
    }
  ): void {
    recordAgentError(task, error, context, {
      getMinistryLabel: this.params.getMinistryLabel,
      addTrace: (currentTask, node, summary, data) => this.params.addTrace(currentTask.trace, node, summary, data),
      addProgressDelta: (currentTask, content) => this.params.addProgressDelta(currentTask, content),
      upsertAgentState: (currentTask, state) =>
        this.params.upsertAgentState(currentTask, state as unknown as AgentExecutionState)
    });
  }

  appendDiagnosisEvidence(task: TaskRecord, review: ReviewRecord, executionSummary: string, finalAnswer: string) {
    appendDiagnosisEvidence(task, review, executionSummary, finalAnswer);
  }

  async persistRuntimeState(): Promise<void> {
    await persistLifecycleSnapshot({
      runtimeStateRepository: this.params.runtimeStateRepository,
      tasks: this.params.tasks,
      learningJobs: this.params.learningJobs,
      learningQueue: this.params.learningQueue,
      pendingExecutions: this.params.pendingExecutions
    });
  }

  emitTaskUpdate(task: TaskRecord): void {
    this.params.emitTaskUpdate(task);
  }

  async persistAndEmitTask(task: TaskRecord): Promise<void> {
    this.enforceInterruptControllerPolicy(task);
    this.finalizePartialAggregation(task);
    this.ensureDiagnosisEvidence(task);
    this.upsertFreshnessEvidence(task);
    await this.persistRuntimeState();
    this.params.emitTaskUpdate(task);
  }

  private enforceInterruptControllerPolicy(task: TaskRecord): void {
    const interrupt = task.activeInterrupt;
    if (!interrupt) {
      return;
    }

    if (interrupt.origin) {
      task.interruptOrigin = interrupt.origin;
    }

    const payload = interrupt.payload;
    const questionPayload =
      payload && typeof payload === 'object' && Array.isArray((payload as { questions?: unknown[] }).questions)
        ? ((payload as { questions: Array<Record<string, unknown>> }).questions ?? [])
        : undefined;

    if (interrupt.kind === 'user-input' && interrupt.proxySourceAgentId && interrupt.origin !== 'counselor_proxy') {
      interrupt.status = 'cancelled';
      interrupt.resolvedAt = new Date().toISOString();
      task.interruptHistory = [...(task.interruptHistory ?? []), { ...interrupt }];
      this.params.addTrace(task.trace, 'interrupt_proxy_violation', '属官越权试图直接创建用户中断，司礼监已拒绝。', {
        proxySourceAgentId: interrupt.proxySourceAgentId,
        origin: interrupt.origin
      });
      task.activeInterrupt = undefined;
      return;
    }

    if (interrupt.origin === 'counselor_proxy' && questionPayload && questionPayload.length > 3) {
      const truncatedQuestions = questionPayload.slice(0, 3);
      interrupt.payload = {
        ...(typeof payload === 'object' && payload ? payload : {}),
        questions: truncatedQuestions
      };
      this.params.addTrace(task.trace, 'interrupt_controller', '群辅已将属官提问压缩为最多 3 个高层问题。', {
        interactionKind: interrupt.interactionKind,
        originalQuestionCount: questionPayload.length,
        compressedQuestionCount: truncatedQuestions.length
      });
    }
  }

  private finalizePartialAggregation(task: TaskRecord): void {
    if (!task.partialAggregation) {
      return;
    }
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      task.status === TaskStatus.CANCELLED
    ) {
      task.partialAggregation = undefined;
      task.internalSubAgents = undefined;
    }
  }

  private upsertFreshnessEvidence(task: TaskRecord): void {
    upsertFreshnessEvidence(task, isFreshnessSensitiveGoal(task.goal), this.buildFreshnessSourceSummary(task));
  }

  private ensureDiagnosisEvidence(task: TaskRecord): void {
    if (!task.review || !task.result) {
      return;
    }

    appendDiagnosisEvidence(task, task.review, task.result, task.result);
  }

  private async hydrateRuntimeState(): Promise<void> {
    await hydrateLifecycleSnapshot({
      runtimeStateRepository: this.params.runtimeStateRepository,
      tasks: this.params.tasks,
      learningJobs: this.params.learningJobs,
      learningQueue: this.params.learningQueue,
      pendingExecutions: this.params.pendingExecutions
    });
  }

  private getBackgroundLifecycleDeps() {
    return {
      workerRegistry: this.params.workerRegistry,
      backgroundRuntime: this.params.backgroundRuntime,
      listTasks: () => this.listTasks(),
      initialize: () => this.initialize()
    };
  }
}
