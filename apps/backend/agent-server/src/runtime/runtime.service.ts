import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import {
  AgentOrchestrator,
  AgentRuntime,
  SessionCoordinator,
  describeConnectorProfilePolicy,
  describeSkillSourceProfilePolicy,
  listSubgraphDescriptors,
  listWorkflowVersions
} from '@agent/agent-core';
import { evaluateBenchmarks } from '@agent/evals';
import {
  FileMemoryRepository,
  FileRuleRepository,
  FileRuntimeStateRepository,
  RuntimeStateSnapshot
} from '@agent/memory';
import {
  AppendChatMessageDto,
  ApprovalActionDto,
  ApprovalDecision,
  ApprovalPolicyRecord,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ConfigureConnectorDto,
  ConfiguredConnectorRecord,
  ConnectorHealthRecord,
  ConnectorDiscoveryHistoryRecord,
  CreateChatSessionDto,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto,
  InstallSkillDto,
  LearningConfirmationDto,
  LocalSkillSuggestionRecord,
  MemoryRecord,
  MinistryId,
  SkillSourceRecord,
  SkillManifestRecord,
  SkillSearchStatus,
  InstalledSkillRecord,
  SkillInstallReceipt,
  RetireKnowledgeDto,
  SearchMemoryDto,
  SessionCancelDto,
  SessionApprovalDto,
  SkillCard,
  SkillStatus,
  TaskStatus,
  TaskRecord,
  ResolveSkillInstallDto,
  InvalidateKnowledgeDto,
  SupersedeKnowledgeDto,
  UpdateChatSessionDto
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';
import { loadAgentSkillManifests } from '@agent/skills';
import {
  ApprovalService,
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  SandboxExecutor,
  createDefaultToolRegistry
} from '@agent/tools';

import {
  fetchProviderUsageAudit,
  ProviderAuditDailyRecord,
  ProviderAuditSyncResult,
  summarizeProviderBilling
} from './provider-audit';
import { RemoteSkillDiscoveryService } from './remote-skill-discovery.service';
import { SkillArtifactFetcher } from './skill-artifact-fetcher';
import { SkillSourceSyncService } from './skill-source-sync.service';

type UsageHistoryPoint = NonNullable<RuntimeStateSnapshot['usageHistory']>[number];
type EvalHistoryPoint = NonNullable<RuntimeStateSnapshot['evalHistory']>[number];
type UsageAuditRecord = NonNullable<RuntimeStateSnapshot['usageAudit']>[number];
type GovernanceConnectorPolicyOverride = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['connectorPolicyOverrides']
>[number];
type GovernanceCapabilityPolicyOverride = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['capabilityPolicyOverrides']
>[number];
@Injectable()
export class RuntimeService implements OnModuleInit {
  private readonly backgroundRunnerId = `runtime-${process.pid}`;
  private readonly backgroundWorkerPoolSize = 2;
  private readonly backgroundLeaseTtlMs = 30_000;
  private readonly backgroundHeartbeatMs = 10_000;
  private readonly backgroundPollMs = 3_000;
  private readonly runtime = new AgentRuntime({
    profile: 'platform',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });
  private readonly settings = this.runtime.settings;
  private readonly memoryRepository: FileMemoryRepository = this.runtime.memoryRepository;
  private readonly ruleRepository: FileRuleRepository = this.runtime.ruleRepository;
  private readonly skillRegistry: SkillRegistry = this.runtime.skillRegistry;
  private readonly approvalService: ApprovalService = this.runtime.approvalService;
  private readonly runtimeStateRepository: FileRuntimeStateRepository = this.runtime.runtimeStateRepository;
  private readonly llmProvider = this.runtime.llmProvider;
  private readonly sandboxExecutor: SandboxExecutor = this.runtime.sandboxExecutor;
  private readonly toolRegistry = this.runtime.toolRegistry;
  private readonly mcpServerRegistry: McpServerRegistry = this.runtime.mcpServerRegistry;
  private readonly mcpCapabilityRegistry: McpCapabilityRegistry = this.runtime.mcpCapabilityRegistry;
  private readonly mcpClientManager: McpClientManager = this.runtime.mcpClientManager;
  private readonly orchestrator: AgentOrchestrator = this.runtime.orchestrator;
  private readonly sessionCoordinator: SessionCoordinator = this.runtime.sessionCoordinator;
  private readonly skillSourceSyncService = new SkillSourceSyncService({
    workspaceRoot: this.settings.workspaceRoot,
    profile: this.settings.profile
  });
  private readonly remoteSkillDiscoveryService = new RemoteSkillDiscoveryService();
  private readonly skillArtifactFetcher = new SkillArtifactFetcher(this.settings.workspaceRoot);
  private backgroundRunnerTimer?: NodeJS.Timeout;
  private backgroundRunnerSweepInFlight = false;
  private readonly backgroundWorkerSlots = new Map<string, { taskId: string; startedAt: string }>();

  constructor() {}

  async onModuleInit() {
    await this.sessionCoordinator.initialize();
    await this.syncEnabledRemoteSkillSources();
    await this.syncInstalledSkillWorkers();
    await this.applyGovernanceOverrides();
    if ('setLocalSkillSuggestionResolver' in this.orchestrator) {
      this.orchestrator.setLocalSkillSuggestionResolver(async ({ goal, usedInstalledSkills }) =>
        this.resolveTaskSkillSearch(goal, usedInstalledSkills)
      );
    }
    this.startBackgroundRunnerLoop();
  }

  describeGraph() {
    return this.orchestrator.describeGraph();
  }

  createTask(dto: CreateTaskDto) {
    return this.orchestrator.createTask(dto);
  }

  listTasks() {
    return this.orchestrator.listTasks();
  }

  listPendingApprovals() {
    return this.orchestrator.listPendingApprovals();
  }

  getTask(taskId: string) {
    const task = this.orchestrator.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    return task;
  }

  listTaskTraces(taskId: string) {
    return this.getTask(taskId).trace;
  }

  async getTaskAudit(taskId: string) {
    const task = this.getTask(taskId);
    const snapshot = await this.runtimeStateRepository.load();
    const relatedGovernanceTargets = new Set<string>([
      ...(task.connectorRefs ?? []),
      ...(task.usedInstalledSkills ?? []),
      ...(task.usedCompanyWorkers ?? []),
      task.currentWorker ?? ''
    ]);
    const governanceEntries = (snapshot.governanceAudit ?? [])
      .filter(entry => relatedGovernanceTargets.has(entry.targetId))
      .map(entry => ({
        id: entry.id,
        at: entry.at,
        type: 'governance' as const,
        title: entry.action,
        summary: `${entry.scope}:${entry.targetId}`,
        detail: entry.reason,
        outcome: entry.outcome
      }));
    const traceEntries = task.trace.map((trace, index) => ({
      id: `${task.id}:trace:${index}`,
      at: trace.at,
      type: 'trace' as const,
      title: trace.node,
      summary: trace.summary,
      detail: trace.data
    }));
    const approvalEntries = task.approvals.map((approval, index) => ({
      id: `${task.id}:approval:${index}`,
      at: task.updatedAt,
      type: 'approval' as const,
      title: approval.intent,
      summary: approval.decision,
      detail: approval.reason
    }));
    const usageEntry = (snapshot.usageAudit ?? []).find(entry => entry.taskId === taskId);
    const usageAuditEntries = usageEntry
      ? [
          {
            id: `${task.id}:usage`,
            at: usageEntry.updatedAt,
            type: 'usage' as const,
            title: 'usage-audit',
            summary: `${usageEntry.totalTokens} tokens / $${usageEntry.totalCostUsd.toFixed(4)}`,
            detail: usageEntry.modelBreakdown
          }
        ]
      : [];
    const browserReplays = task.trace
      .map(trace => this.extractBrowserReplay(trace.data))
      .filter(Boolean)
      .map(replay => ({
        sessionId: replay!.sessionId,
        url: replay!.url,
        artifactRef: replay!.artifactRef,
        snapshotRef: replay!.snapshotRef,
        screenshotRef: replay!.screenshotRef,
        stepCount: replay!.steps?.length ?? replay!.stepTrace?.length ?? 0
      }));

    return {
      taskId,
      entries: [...traceEntries, ...approvalEntries, ...governanceEntries, ...usageAuditEntries].sort((left, right) =>
        right.at.localeCompare(left.at)
      ),
      browserReplays
    };
  }

  listTaskAgents(taskId: string) {
    this.getTask(taskId);
    return this.orchestrator.getTaskAgents(taskId);
  }

  listTaskMessages(taskId: string) {
    this.getTask(taskId);
    return this.orchestrator.getTaskMessages(taskId);
  }

  getTaskPlan(taskId: string) {
    const plan = this.orchestrator.getTaskPlan(taskId);
    if (!plan) {
      throw new NotFoundException(`Task plan for ${taskId} not found`);
    }
    return plan;
  }

  async getTaskLocalSkillSuggestions(taskId: string) {
    const task = this.getTask(taskId);
    return this.searchLocalSkillSuggestions(task.goal, {
      usedInstalledSkills: task.usedInstalledSkills,
      limit: 6
    });
  }

  getTaskReview(taskId: string) {
    const review = this.orchestrator.getTaskReview(taskId);
    if (!review) {
      throw new NotFoundException(`Task review for ${taskId} not found`);
    }
    return review;
  }

  retryTask(taskId: string) {
    return this.orchestrator.retryTask(taskId).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  approveTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  rejectTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED).then(task => {
      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }
      return task;
    });
  }

  listSessions(): ChatSessionRecord[] {
    return this.sessionCoordinator.listSessions();
  }

  createSession(dto: CreateChatSessionDto): Promise<ChatSessionRecord> {
    return this.sessionCoordinator.createSession(dto);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.getSession(sessionId);
    await this.sessionCoordinator.deleteSession(sessionId);
  }

  updateSession(sessionId: string, dto: UpdateChatSessionDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.updateSession(sessionId, dto);
  }

  getSession(sessionId: string): ChatSessionRecord {
    const session = this.sessionCoordinator.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  listSessionMessages(sessionId: string): ChatMessageRecord[] {
    this.getSession(sessionId);
    return this.sessionCoordinator.getMessages(sessionId);
  }

  listSessionEvents(sessionId: string): ChatEventRecord[] {
    this.getSession(sessionId);
    return this.sessionCoordinator.getEvents(sessionId);
  }

  getSessionCheckpoint(sessionId: string): ChatCheckpointRecord | undefined {
    this.getSession(sessionId);
    return this.sessionCoordinator.getCheckpoint(sessionId);
  }

  appendSessionMessage(sessionId: string, dto: AppendChatMessageDto): Promise<ChatMessageRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.appendMessage(sessionId, dto);
  }

  approveSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.approve(sessionId, dto);
  }

  rejectSessionAction(sessionId: string, dto: SessionApprovalDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.reject(sessionId, dto);
  }

  confirmLearning(sessionId: string, dto: LearningConfirmationDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.confirmLearning(sessionId, dto);
  }

  recoverSession(sessionId: string): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.recover(sessionId);
  }

  cancelSession(sessionId: string, dto: SessionCancelDto): Promise<ChatSessionRecord> {
    this.getSession(sessionId);
    return this.sessionCoordinator.cancel(sessionId, dto);
  }

  subscribeSession(sessionId: string, listener: (event: ChatEventRecord) => void): () => void {
    this.getSession(sessionId);
    return this.sessionCoordinator.subscribe(sessionId, listener);
  }

  searchMemory(dto: SearchMemoryDto): Promise<MemoryRecord[]> {
    return this.memoryRepository.search(dto.query, dto.limit ?? 10);
  }

  async getMemory(memoryId: string): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.getById(memoryId);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async invalidateMemory(memoryId: string, dto: InvalidateKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.invalidate(memoryId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async supersedeMemory(memoryId: string, dto: SupersedeKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.supersede(memoryId, dto.replacementId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async restoreMemory(memoryId: string): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.restore(memoryId);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  async retireMemory(memoryId: string, dto: RetireKnowledgeDto): Promise<MemoryRecord> {
    const memory = await this.memoryRepository.retire(memoryId, dto.reason);
    if (!memory) {
      throw new NotFoundException(`Memory ${memoryId} not found`);
    }
    return memory;
  }

  listSkills(status?: SkillStatus): Promise<SkillCard[]> {
    return this.skillRegistry.list(status);
  }

  listLabSkills(): Promise<SkillCard[]> {
    return this.skillRegistry.list('lab');
  }

  async getSkill(skillId: string): Promise<SkillCard> {
    const skill = await this.skillRegistry.getById(skillId);
    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    return skill;
  }

  promoteSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.promote(skillId);
  }

  disableSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.disable(skillId, 'disabled_from_admin');
  }

  restoreSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.restore(skillId);
  }

  retireSkill(skillId: string): Promise<SkillCard> {
    return this.skillRegistry.retire(skillId, 'retired_from_admin');
  }

  listRules() {
    return this.orchestrator.listRules();
  }

  async invalidateRule(ruleId: string, dto: InvalidateKnowledgeDto) {
    const rule = await this.ruleRepository.invalidate(ruleId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async supersedeRule(ruleId: string, dto: SupersedeKnowledgeDto) {
    const rule = await this.ruleRepository.supersede(ruleId, dto.replacementId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async restoreRule(ruleId: string) {
    const rule = await this.ruleRepository.restore(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  async retireRule(ruleId: string, dto: RetireKnowledgeDto) {
    const rule = await this.ruleRepository.retire(ruleId, dto.reason);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return rule;
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.orchestrator.createDocumentLearningJob(dto);
  }

  createResearchLearningJob(dto: CreateResearchLearningJobDto) {
    return this.orchestrator.createResearchLearningJob(dto);
  }

  getLearningJob(jobId: string) {
    const job = this.orchestrator.getLearningJob(jobId);
    if (!job) {
      throw new NotFoundException(`Learning job ${jobId} not found`);
    }
    return job;
  }

  async getRuntimeCenter(days = 30, filters?: { status?: string; model?: string; pricingSource?: string }) {
    const tasks = this.orchestrator.listTasks();
    const sessions = this.sessionCoordinator.listSessions();
    const pendingApprovals = this.orchestrator.listPendingApprovals();
    const usageAnalytics = await this.summarizeAndPersistUsageAnalytics(tasks, days, filters);

    const activeTasks = tasks.filter(task =>
      ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
    );
    const activeMinistries = Array.from(
      new Set(activeTasks.map(task => task.currentMinistry).filter(Boolean))
    ) as string[];
    const activeWorkers = Array.from(new Set(activeTasks.map(task => task.currentWorker).filter(Boolean))) as string[];

    const filteredRecentRuns = tasks
      .filter(task => !filters?.status || String(task.status) === filters.status)
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 10);

    return {
      runtimeProfile: this.settings.profile,
      policy: {
        approvalMode: this.settings.policy.approvalMode,
        skillInstallMode: this.settings.policy.skillInstallMode,
        learningMode: this.settings.policy.learningMode,
        sourcePolicyMode: this.settings.policy.sourcePolicyMode,
        budget: this.settings.policy.budget
      },
      taskCount: tasks.length,
      activeTaskCount: activeTasks.length,
      backgroundRunCount: tasks.filter(task => task.queueState?.backgroundRun).length,
      foregroundRunCount: tasks.filter(task => !task.queueState?.backgroundRun).length,
      leasedBackgroundRunCount: tasks.filter(task => task.queueState?.backgroundRun && task.queueState?.leaseOwner)
        .length,
      staleLeaseCount: tasks.filter(task => {
        const leaseExpiresAt = task.queueState?.leaseExpiresAt;
        return Boolean(
          task.queueState?.backgroundRun &&
          task.queueState?.status === 'running' &&
          leaseExpiresAt &&
          new Date(leaseExpiresAt).getTime() <= Date.now()
        );
      }).length,
      queueDepth: tasks.filter(task => String(task.status) === 'queued').length,
      blockedRunCount: tasks.filter(task => String(task.status) === 'blocked').length,
      workerPoolSize: this.backgroundWorkerPoolSize,
      activeWorkerSlotCount: this.backgroundWorkerSlots.size,
      availableWorkerSlotCount: Math.max(0, this.backgroundWorkerPoolSize - this.backgroundWorkerSlots.size),
      activeWorkerSlots: [...this.backgroundWorkerSlots.entries()].map(([slotId, slot]) => ({
        slotId,
        taskId: slot.taskId,
        startedAt: slot.startedAt
      })),
      budgetExceededCount: tasks.filter(task => task.currentStep === 'budget_exhausted').length,
      pendingApprovalCount: pendingApprovals.length,
      sessionCount: sessions.length,
      activeSessionCount: sessions.filter(session =>
        ['running', 'waiting_approval', 'waiting_learning_confirmation'].includes(String(session.status))
      ).length,
      activeMinistries,
      activeWorkers,
      subgraphs: listSubgraphDescriptors(),
      workflowVersions: listWorkflowVersions(),
      usageAnalytics,
      recentGovernanceAudit: await this.getRecentGovernanceAudit(),
      appliedFilters: {
        status: filters?.status,
        model: filters?.model,
        pricingSource: filters?.pricingSource
      },
      recentRuns: filteredRecentRuns
    };
  }

  private startBackgroundRunnerLoop(): void {
    this.backgroundRunnerTimer = setInterval(() => {
      void this.runBackgroundRunnerTick();
    }, this.backgroundPollMs);
    this.backgroundRunnerTimer.unref?.();
    void this.runBackgroundRunnerTick();
  }

  private async runBackgroundRunnerTick(): Promise<void> {
    if (this.backgroundRunnerSweepInFlight) {
      return;
    }
    this.backgroundRunnerSweepInFlight = true;

    try {
      if (
        typeof (this.orchestrator as unknown as { listQueuedBackgroundTasks?: unknown }).listQueuedBackgroundTasks !==
          'function' ||
        typeof (this.orchestrator as unknown as { listExpiredBackgroundLeases?: unknown })
          .listExpiredBackgroundLeases !== 'function'
      ) {
        return;
      }

      const expiredLeases = this.orchestrator.listExpiredBackgroundLeases();
      for (const task of expiredLeases) {
        await this.orchestrator.reclaimExpiredBackgroundLease(task.id, task.queueState?.leaseOwner ?? 'unknown-runner');
      }

      const capacity = this.backgroundWorkerPoolSize - this.backgroundWorkerSlots.size;
      if (capacity <= 0) {
        return;
      }

      const queuedTasks = this.orchestrator.listQueuedBackgroundTasks();
      for (const nextTask of queuedTasks.slice(0, capacity)) {
        const leasedTask = await this.orchestrator.acquireBackgroundLease(
          nextTask.id,
          this.backgroundRunnerId,
          this.backgroundLeaseTtlMs
        );
        if (!leasedTask) {
          continue;
        }

        this.startBackgroundWorker(leasedTask.id);
      }
    } finally {
      this.backgroundRunnerSweepInFlight = false;
    }
  }

  private startBackgroundWorker(taskId: string): void {
    const slotId = this.allocateBackgroundWorkerSlot();
    if (!slotId) {
      return;
    }

    this.backgroundWorkerSlots.set(slotId, {
      taskId,
      startedAt: new Date().toISOString()
    });

    const heartbeatTimer = setInterval(() => {
      void this.orchestrator.heartbeatBackgroundLease(taskId, this.backgroundRunnerId, this.backgroundLeaseTtlMs);
    }, this.backgroundHeartbeatMs);
    heartbeatTimer.unref?.();

    void (async () => {
      try {
        await this.orchestrator.runBackgroundTask(taskId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '后台 worker 执行异常终止。';
        await this.orchestrator.markBackgroundTaskRunnerFailure(taskId, reason);
      } finally {
        clearInterval(heartbeatTimer);
        await this.orchestrator.releaseBackgroundLease(taskId, this.backgroundRunnerId);
        this.backgroundWorkerSlots.delete(slotId);
      }
    })();
  }

  private allocateBackgroundWorkerSlot(): string | undefined {
    for (let index = 1; index <= this.backgroundWorkerPoolSize; index += 1) {
      const slotId = `slot-${index}`;
      if (!this.backgroundWorkerSlots.has(slotId)) {
        return slotId;
      }
    }
    return undefined;
  }

  getApprovalsCenter() {
    return this.orchestrator.listPendingApprovals().map(task => ({
      taskId: task.id,
      goal: task.goal,
      status: task.status,
      sessionId: task.sessionId,
      currentMinistry: task.currentMinistry,
      currentWorker: task.currentWorker,
      approvals: task.approvals ?? []
    }));
  }

  getLearningCenter() {
    const tasks = this.orchestrator.listTasks();
    const jobs = this.orchestrator.listLearningJobs();
    const invalidatedMemoriesPromise = this.memoryRepository
      .list()
      .then(items => items.filter(item => item.status === 'invalidated').length);
    const invalidatedRulesPromise = this.ruleRepository
      .list()
      .then(items => items.filter(item => item.status === 'invalidated').length);
    const learningCandidates = tasks.flatMap(task =>
      (task.learningCandidates ?? []).map(candidate => ({
        ...candidate,
        taskGoal: task.goal,
        currentMinistry: task.currentMinistry,
        currentWorker: task.currentWorker,
        confidenceScore: candidate.confidenceScore,
        autoConfirmEligible: candidate.autoConfirmEligible,
        provenanceCount: candidate.provenance?.length ?? 0,
        evaluationScore: task.learningEvaluation?.score,
        evaluationConfidence: task.learningEvaluation?.confidence
      }))
    );

    return Promise.all([
      invalidatedMemoriesPromise,
      invalidatedRulesPromise,
      Promise.all(
        tasks
          .slice()
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
          .slice(0, 10)
          .map(async task => ({
            taskId: task.id,
            goal: task.goal,
            ...(await this.searchLocalSkillSuggestions(task.goal, {
              usedInstalledSkills: task.usedInstalledSkills,
              limit: 3
            }))
          }))
      )
    ]).then(([invalidatedMemories, invalidatedRules, localSkillSuggestions]) => ({
      totalCandidates: learningCandidates.length,
      pendingCandidates: learningCandidates.filter(candidate => candidate.status === 'pending_confirmation').length,
      confirmedCandidates: learningCandidates.filter(candidate => candidate.status === 'confirmed').length,
      researchJobs: jobs.filter(job => job.sourceType === 'research').length,
      autoPersistedResearchJobs: jobs.filter(job => (job.persistedMemoryIds?.length ?? 0) > 0).length,
      conflictingResearchJobs: jobs.filter(job => job.conflictDetected).length,
      invalidatedMemories,
      invalidatedRules,
      recentJobs: jobs
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 10)
        .map(job => ({
          ...job,
          sourceCount: job.sources?.length ?? 0,
          evaluationScore: job.learningEvaluation?.score,
          evaluationConfidence: job.learningEvaluation?.confidence
        })),
      averageEvaluationScore:
        tasks
          .filter(task => task.learningEvaluation?.score != null)
          .reduce((sum, task) => sum + (task.learningEvaluation?.score ?? 0), 0) /
        Math.max(1, tasks.filter(task => task.learningEvaluation?.score != null).length),
      autoConfirmableCandidates: learningCandidates.filter(candidate => candidate.autoConfirmEligible).length,
      candidates: learningCandidates,
      recentSkillGovernance: tasks
        .flatMap(task => {
          const recommendations = (
            task.learningEvaluation as
              | {
                  skillGovernanceRecommendations?: Array<{
                    skillId: string;
                    recommendation: string;
                    successRate?: number;
                    promotionState?: string;
                  }>;
                }
              | undefined
          )?.skillGovernanceRecommendations;

          return (recommendations ?? []).map(item => ({
            taskId: task.id,
            goal: task.goal,
            skillId: item.skillId,
            recommendation: item.recommendation,
            successRate: item.successRate,
            promotionState: item.promotionState,
            updatedAt: task.updatedAt
          }));
        })
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 12),
      localSkillSuggestions
    }));
  }

  getEvidenceCenter() {
    const taskEvidence = this.orchestrator.listTasks().flatMap(task =>
      task.externalSources?.length
        ? task.externalSources.map(source => ({
            ...source,
            taskGoal: task.goal
          }))
        : task.trace.map((trace, index) => {
            const browserReplay = this.extractBrowserReplay(trace.data);
            return {
              id: `${task.id}:${index}`,
              taskId: task.id,
              taskGoal: task.goal,
              sourceType: browserReplay ? 'browser_trace' : 'trace',
              sourceUrl: browserReplay?.url,
              trustClass: 'internal' as const,
              summary: trace.summary,
              detail: trace.data,
              linkedRunId: task.runId,
              createdAt: trace.at,
              replay: browserReplay
            };
          })
    );
    const learningEvidence = this.orchestrator.listLearningJobs().flatMap(job =>
      (job.sources ?? []).map(source => {
        const browserReplay = this.extractBrowserReplay(source.detail);
        return {
          ...source,
          taskGoal: job.goal ?? job.summary ?? job.documentUri,
          replay: source.replay ?? browserReplay
        };
      })
    );
    return [...learningEvidence, ...taskEvidence];
  }

  async getConnectorsCenter() {
    await this.mcpClientManager.sweepIdleSessions(this.settings.mcp.stdioSessionIdleTtlMs);
    await this.mcpClientManager.refreshAllServerDiscovery({ includeStdio: false });
    const snapshot = await this.runtimeStateRepository.load();
    const tasks = this.orchestrator.listTasks();
    const configuredConnectors = new Map(
      (snapshot.governance?.configuredConnectors ?? []).map(item => [item.connectorId, item])
    );
    const discoveryHistory = this.groupConnectorDiscoveryHistory(snapshot.governance?.connectorDiscoveryHistory ?? []);
    const governanceAuditByConnector = this.groupGovernanceAuditByTarget(snapshot.governanceAudit ?? []);
    const policyOverrides = new Map(
      (snapshot.governance?.connectorPolicyOverrides ?? []).map(item => [item.connectorId, item])
    );
    const capabilityOverrides = new Map(
      (snapshot.governance?.capabilityPolicyOverrides ?? []).map(item => [item.capabilityId, item])
    );
    return this.mcpClientManager.describeServers().map(connector => {
      const profilePolicy = describeConnectorProfilePolicy(connector.id, this.settings.profile);
      const connectorConfig = configuredConnectors.get(connector.id);
      const connectorHistory = discoveryHistory.get(connector.id) ?? [];
      const latestDiscovery = connectorHistory[0];
      const override = policyOverrides.get(connector.id);
      const enrichedCapabilities = connector.capabilities.map(capability => {
        const capabilityOverride = capabilityOverrides.get(capability.id);
        const capabilityTasks = tasks
          .filter(task => (task.connectorRefs ?? []).includes(connector.id))
          .filter(task => this.taskTouchesCapability(task, capability.toolName))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        return {
          ...capability,
          effectiveApprovalMode: capabilityOverride?.effect ?? override?.effect ?? 'default',
          policyReason:
            capabilityOverride?.reason ??
            override?.reason ??
            (capability.requiresApproval
              ? this.describeCapabilityApprovalReason(connector.displayName, capability.toolName, capability.riskLevel)
              : 'inherits default connector policy'),
          usageCount: capabilityTasks.length,
          recentTaskGoals: capabilityTasks.slice(0, 3).map(task => task.goal),
          recentTasks: capabilityTasks.slice(0, 3).map(task => ({
            taskId: task.id,
            goal: task.goal,
            status: String(task.status),
            approvalCount: task.approvals?.length ?? 0,
            latestTraceSummary: this.findCapabilityTraceSummary(task, capability.toolName)
          }))
        };
      });
      const healthChecks: ConnectorHealthRecord[] = [
        {
          connectorId: connector.id,
          healthState: profilePolicy.enabledByProfile
            ? (connector.healthState as ConnectorHealthRecord['healthState'])
            : 'disabled',
          reason: profilePolicy.enabledByProfile ? connector.healthReason : profilePolicy.reason,
          checkedAt: latestDiscovery?.discoveredAt ?? connector.lastDiscoveredAt ?? new Date().toISOString(),
          transport: connector.transport,
          implementedCapabilityCount: connector.implementedCapabilityCount,
          discoveredCapabilityCount: connector.discoveredCapabilityCount
        }
      ];
      const approvalPolicies: ApprovalPolicyRecord[] = connector.capabilities
        .filter(capability => capability.requiresApproval)
        .map(capability => ({
          id: `${connector.id}:${capability.id}`,
          scope: 'capability',
          targetId: capability.id,
          capabilityId: capability.id,
          connectorId: connector.id,
          mode:
            capability.riskLevel === 'critical' || capability.riskLevel === 'high' ? 'all-actions' : 'high-risk-only',
          effect: 'require-approval',
          matchedCount: 1,
          reason: this.describeCapabilityApprovalReason(
            connector.displayName,
            capability.toolName,
            capability.riskLevel
          )
        }));
      if (override) {
        approvalPolicies.unshift({
          id: `${connector.id}:override`,
          scope: 'connector',
          targetId: connector.id,
          connectorId: connector.id,
          mode: override.effect,
          effect: override.effect,
          matchedCount: connector.capabilityCount,
          reason: override.reason ?? `connector policy override: ${override.effect}`
        });
      }
      for (const capability of connector.capabilities) {
        const capabilityOverride = capabilityOverrides.get(capability.id);
        if (!capabilityOverride) {
          continue;
        }
        approvalPolicies.unshift({
          id: `${connector.id}:${capability.id}:override`,
          scope: 'capability',
          targetId: capability.id,
          capabilityId: capability.id,
          connectorId: connector.id,
          mode: capabilityOverride.effect,
          effect: capabilityOverride.effect,
          matchedCount: 1,
          reason: capabilityOverride.reason ?? `capability policy override: ${capabilityOverride.effect}`
        });
      }

      const relatedTasks = tasks
        .filter(task => (task.connectorRefs ?? []).includes(connector.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const completedTasks = relatedTasks.filter(task =>
        [String(TaskStatus.COMPLETED), String(TaskStatus.FAILED)].includes(String(task.status))
      );
      const successfulTasks = completedTasks.filter(task => String(task.status) === String(TaskStatus.COMPLETED));
      const failedTask = relatedTasks.find(task => String(task.status) === String(TaskStatus.FAILED));

      return {
        ...connector,
        enabled: connector.enabled && profilePolicy.enabledByProfile,
        healthState: profilePolicy.enabledByProfile ? connector.healthState : 'disabled',
        healthReason: profilePolicy.enabledByProfile ? connector.healthReason : profilePolicy.reason,
        trustClass: connector.trustClass,
        source: connector.source,
        authMode: connector.headers ? 'header' : connector.command ? 'token' : 'none',
        dataScope: connector.dataScope,
        writeScope: connector.writeScope,
        installationMode: connector.installationMode ?? 'builtin',
        allowedProfiles: connector.allowedProfiles,
        endpoint: connector.endpoint,
        command: connector.command,
        args: connector.args,
        configuredAt: connectorConfig?.configuredAt,
        configurationTemplateId: connectorConfig?.templateId,
        activeTaskCount: relatedTasks.filter(task =>
          ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
        ).length,
        totalTaskCount: relatedTasks.length,
        successRate: completedTasks.length ? successfulTasks.length / completedTasks.length : undefined,
        recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
        firstUsedAt: relatedTasks.length ? relatedTasks[relatedTasks.length - 1]?.createdAt : undefined,
        lastUsedAt: relatedTasks[0]?.updatedAt,
        recentFailureReason:
          failedTask?.result ??
          failedTask?.trace.find(
            trace => /fail|error/i.test(trace.summary ?? '') || /fail|error/i.test(trace.node ?? '')
          )?.summary,
        lastDiscoveredAt: latestDiscovery?.discoveredAt ?? connector.lastDiscoveredAt,
        lastDiscoveryError: latestDiscovery?.error ?? connector.lastDiscoveryError,
        discoveryHistory: connectorHistory.slice(0, 5),
        recentGovernanceAudits: governanceAuditByConnector.get(connector.id)?.slice(0, 5) ?? [],
        profilePolicy,
        healthChecks,
        approvalPolicies,
        capabilities: enrichedCapabilities
      };
    });
  }

  async getBrowserReplay(sessionId: string) {
    const replayPath = join(this.settings.workspaceRoot, 'data', 'browser-replays', sessionId, 'replay.json');
    try {
      const raw = await readFile(replayPath, 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new NotFoundException(`Browser replay ${sessionId} not found`);
    }
  }

  async getSkillSourcesCenter() {
    const [sources, manifests, installed, receipts] = await Promise.all([
      this.listSkillSources(),
      this.listSkillManifests(),
      this.readInstalledSkillRecords(),
      this.readSkillInstallReceipts()
    ]);
    const skillCards = await this.skillRegistry.list();
    const tasks = this.orchestrator.listTasks();

    return {
      sources,
      manifests,
      installed: installed.map(item => {
        const workerId = `installed-skill:${item.skillId}`;
        const skillCard = skillCards.find(skill => skill.id === item.skillId);
        const relatedTasks = tasks
          .filter(task => (task.usedInstalledSkills ?? []).includes(workerId))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const completedTasks = relatedTasks.filter(task =>
          [String(TaskStatus.COMPLETED), String(TaskStatus.FAILED)].includes(String(task.status))
        );
        const successfulTasks = completedTasks.filter(task => String(task.status) === String(TaskStatus.COMPLETED));
        const failedTask = relatedTasks.find(task => String(task.status) === String(TaskStatus.FAILED));
        return {
          ...item,
          governanceRecommendation: skillCard?.governanceRecommendation,
          allowedTools: skillCard?.allowedTools,
          compatibility: skillCard?.compatibility,
          activeTaskCount: relatedTasks.filter(task =>
            ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
          ).length,
          totalTaskCount: relatedTasks.length,
          recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
          firstUsedAt: relatedTasks.length ? relatedTasks[relatedTasks.length - 1]?.createdAt : undefined,
          lastUsedAt: relatedTasks[0]?.updatedAt,
          successRate:
            skillCard?.successRate ??
            (completedTasks.length ? successfulTasks.length / completedTasks.length : undefined),
          lastOutcome:
            relatedTasks.length > 0
              ? String(relatedTasks[0]?.status) === String(TaskStatus.COMPLETED)
                ? 'success'
                : String(relatedTasks[0]?.status) === String(TaskStatus.FAILED)
                  ? 'failure'
                  : undefined
              : undefined,
          recentFailureReason:
            failedTask?.result ??
            failedTask?.trace.find(
              trace => /fail|error/i.test(trace.summary ?? '') || /fail|error/i.test(trace.node ?? '')
            )?.summary,
          recentTasks: relatedTasks.slice(0, 3).map(task => ({
            taskId: task.id,
            goal: task.goal,
            status: String(task.status),
            approvalCount: task.approvals?.length ?? 0,
            latestTraceSummary: (task.trace ?? [])[0]?.summary ?? (task.trace ?? [])[0]?.node
          }))
        };
      }),
      receipts: receipts.sort((left, right) => (right.installedAt ?? '').localeCompare(left.installedAt ?? ''))
    };
  }

  async syncSkillSource(sourceId: string) {
    const source = (await this.listSkillSources()).find(item => item.id === sourceId);
    if (!source) {
      throw new NotFoundException(`Skill source ${sourceId} not found`);
    }

    const result = await this.skillSourceSyncService.syncSource(source);
    await this.appendGovernanceAudit({
      actor: 'agent-admin-user',
      action: 'skill-source.synced',
      scope: 'skill-source',
      targetId: sourceId,
      outcome: result.status === 'failed' ? 'rejected' : 'success',
      reason: result.error ?? `manifestCount=${result.manifestCount}`
    });
    return (await this.listSkillSources()).find(item => item.id === sourceId)!;
  }

  async installSkill(dto: InstallSkillDto) {
    const [sources, manifests] = await Promise.all([this.listSkillSources(), this.listSkillManifests()]);
    const manifest = manifests.find(item => item.id === dto.manifestId);
    if (!manifest) {
      throw new NotFoundException(`Skill manifest ${dto.manifestId} not found`);
    }
    const source = sources.find(item => item.id === (dto.sourceId ?? manifest.sourceId));
    if (!source) {
      throw new NotFoundException(`Skill source ${dto.sourceId ?? manifest.sourceId} not found`);
    }
    if (!source.enabled) {
      throw new NotFoundException(`Skill source ${source.id} is disabled`);
    }

    const safety = this.evaluateSkillManifestSafety(manifest, source);
    const requiresApproval =
      safety.verdict === 'needs-approval' || source.trustClass === 'community' || source.trustClass === 'unverified';

    if (safety.verdict === 'blocked') {
      throw new NotFoundException(`Skill manifest ${dto.manifestId} is blocked by local safety evaluation`);
    }

    const receipt: SkillInstallReceipt = {
      id: `receipt_${manifest.id}_${Date.now()}`,
      skillId: manifest.id,
      version: manifest.version,
      sourceId: source.id,
      phase: requiresApproval ? 'requested' : 'approved',
      integrity: manifest.integrity,
      approvedBy: requiresApproval ? undefined : (dto.actor ?? 'system'),
      installedAt: requiresApproval ? undefined : new Date().toISOString(),
      status: requiresApproval ? 'pending' : 'installed',
      result: requiresApproval ? 'waiting_for_install_approval' : 'installed_to_lab'
    };

    await this.writeSkillInstallReceipt(receipt);
    await this.appendGovernanceAudit({
      actor: dto.actor ?? 'system',
      action: 'skill.install.requested',
      scope: 'skill-install',
      targetId: manifest.id,
      outcome: requiresApproval ? 'pending' : 'success',
      reason: requiresApproval ? 'waiting_for_install_approval' : 'installed_to_lab'
    });
    if (!requiresApproval) {
      await this.finalizeSkillInstall(manifest, source, receipt);
    }
    return receipt;
  }

  async approveSkillInstall(receiptId: string, dto: ResolveSkillInstallDto) {
    const receipt = await this.getSkillInstallReceipt(receiptId);
    if (receipt.status === 'installed') {
      return receipt;
    }
    const [sources, manifests] = await Promise.all([this.listSkillSources(), this.listSkillManifests()]);
    const manifest = manifests.find(item => item.id === receipt.skillId);
    const source = sources.find(item => item.id === receipt.sourceId);
    if (!manifest || !source) {
      throw new NotFoundException(`Install dependencies for receipt ${receiptId} not found`);
    }

    receipt.status = 'approved';
    receipt.approvedBy = dto.actor ?? 'agent-admin-user';
    receipt.phase = 'approved';
    receipt.result = 'approved_pending_install';
    await this.writeSkillInstallReceipt(receipt);
    await this.finalizeSkillInstall(manifest, source, receipt);
    await this.appendGovernanceAudit({
      actor: dto.actor ?? 'agent-admin-user',
      action: 'skill.install.approved',
      scope: 'skill-install',
      targetId: receipt.skillId,
      outcome: 'success',
      reason: receiptId
    });
    return await this.getSkillInstallReceipt(receiptId);
  }

  async rejectSkillInstall(receiptId: string, dto: ResolveSkillInstallDto) {
    const receipt = await this.getSkillInstallReceipt(receiptId);
    receipt.status = 'rejected';
    receipt.phase = 'failed';
    receipt.rejectedBy = dto.actor ?? 'agent-admin-user';
    receipt.reason = dto.reason;
    receipt.result = dto.reason ?? 'install_rejected';
    await this.writeSkillInstallReceipt(receipt);
    await this.appendGovernanceAudit({
      actor: dto.actor ?? 'agent-admin-user',
      action: 'skill.install.rejected',
      scope: 'skill-install',
      targetId: receipt.skillId,
      outcome: 'rejected',
      reason: dto.reason
    });
    return receipt;
  }

  async setSkillSourceEnabled(sourceId: string, enabled: boolean) {
    const sources = await this.listSkillSources();
    const source = sources.find(item => item.id === sourceId);
    if (!source) {
      throw new NotFoundException(`Skill source ${sourceId} not found`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    const disabled = new Set(snapshot.governance?.disabledSkillSourceIds ?? []);
    if (enabled) {
      disabled.delete(sourceId);
    } else {
      disabled.add(sourceId);
    }
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      disabledSkillSourceIds: Array.from(disabled)
    };
    await this.runtimeStateRepository.save(snapshot);
    await this.appendGovernanceAudit({
      actor: 'agent-admin-user',
      action: enabled ? 'skill-source.enabled' : 'skill-source.disabled',
      scope: 'skill-source',
      targetId: sourceId,
      outcome: 'success'
    });
    return (await this.listSkillSources()).find(item => item.id === sourceId)!;
  }

  getCompanyAgentsCenter() {
    const tasks = this.orchestrator.listTasks();
    const disabledWorkerIds = new Set(this.getDisabledCompanyWorkerIdsSync());
    const workers = this.orchestrator
      .listWorkers()
      .filter(worker => worker.kind === 'company')
      .map(worker => {
        const relatedTasks = tasks
          .filter(task => task.currentWorker === worker.id || (task.usedCompanyWorkers ?? []).includes(worker.id))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const completedTasks = relatedTasks.filter(task =>
          ['completed', 'failed', 'cancelled'].includes(String(task.status))
        );
        const successfulTasks = completedTasks.filter(task => String(task.status) === 'completed');
        const successRate = completedTasks.length ? successfulTasks.length / completedTasks.length : undefined;

        return {
          ...worker,
          enabled: !disabledWorkerIds.has(worker.id),
          activeTaskCount: relatedTasks.filter(task =>
            ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
          ).length,
          totalTaskCount: relatedTasks.length,
          successRate,
          promotionState:
            successRate == null
              ? 'warming'
              : successRate >= 0.8
                ? 'validated'
                : successRate >= 0.5
                  ? 'warming'
                  : 'needs-review',
          sourceRuns: Array.from(new Set(relatedTasks.map(task => task.runId).filter(Boolean))),
          recentTaskGoals: relatedTasks.slice(0, 3).map(task => task.goal),
          governanceStatus: disabledWorkerIds.has(worker.id)
            ? 'disabled'
            : worker.requiredConnectors?.length
              ? 'connector-bound'
              : 'ready'
        };
      });

    return workers;
  }

  async setCompanyAgentEnabled(workerId: string, enabled: boolean) {
    const worker = this.orchestrator.listWorkers().find(item => item.id === workerId && item.kind === 'company');
    if (!worker) {
      throw new NotFoundException(`Company worker ${workerId} not found`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    const disabled = new Set(snapshot.governance?.disabledCompanyWorkerIds ?? []);
    if (enabled) {
      disabled.delete(workerId);
    } else {
      disabled.add(workerId);
    }
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      disabledCompanyWorkerIds: Array.from(disabled)
    };
    await this.runtimeStateRepository.save(snapshot);
    this.orchestrator.setWorkerEnabled(workerId, enabled);
    await this.appendGovernanceAudit({
      actor: 'agent-admin-user',
      action: enabled ? 'company-worker.enabled' : 'company-worker.disabled',
      scope: 'company-worker',
      targetId: workerId,
      outcome: 'success'
    });
    return this.getCompanyAgentsCenter().find(item => item.id === workerId)!;
  }

  async setConnectorEnabled(connectorId: string, enabled: boolean) {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    const profilePolicy = describeConnectorProfilePolicy(connectorId, this.settings.profile);
    if (enabled && !profilePolicy.enabledByProfile) {
      throw new NotFoundException(
        `Connector ${connectorId} is unavailable for ${this.settings.profile} profile: ${profilePolicy.reason}`
      );
    }
    const snapshot = await this.runtimeStateRepository.load();
    const disabled = new Set(snapshot.governance?.disabledConnectorIds ?? []);
    if (enabled) {
      disabled.delete(connectorId);
    } else {
      disabled.add(connectorId);
    }
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      disabledConnectorIds: Array.from(disabled)
    };
    await this.runtimeStateRepository.save(snapshot);
    this.mcpServerRegistry.setEnabled(connectorId, enabled);
    if (!enabled) {
      await this.mcpClientManager.closeServerSession(connectorId).catch(() => false);
    }
    await this.appendGovernanceAudit({
      actor: 'agent-admin-user',
      action: enabled ? 'connector.enabled' : 'connector.disabled',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success'
    });
    return this.mcpServerRegistry.get(connectorId)!;
  }

  async setConnectorApprovalPolicy(
    connectorId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe',
    actor = 'agent-admin-user'
  ) {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    const overrides = (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
      item => item.connectorId !== connectorId
    );
    overrides.push({
      connectorId,
      effect,
      reason: `updated_from_admin:${effect}`,
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    });
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      connectorPolicyOverrides: overrides
    };
    await this.runtimeStateRepository.save(snapshot);
    this.mcpCapabilityRegistry.setServerApprovalOverride(connectorId, effect);
    if (effect === 'deny') {
      await this.mcpClientManager.closeServerSession(connectorId).catch(() => false);
    }
    await this.appendGovernanceAudit({
      actor,
      action: 'connector.policy.updated',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success',
      reason: effect
    });
    return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
  }

  async clearConnectorApprovalPolicy(connectorId: string, actor = 'agent-admin-user') {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      connectorPolicyOverrides: (snapshot.governance?.connectorPolicyOverrides ?? []).filter(
        item => item.connectorId !== connectorId
      )
    };
    await this.runtimeStateRepository.save(snapshot);
    this.mcpCapabilityRegistry.setServerApprovalOverride(connectorId, undefined);
    await this.appendGovernanceAudit({
      actor,
      action: 'connector.policy.cleared',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success'
    });
    return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
  }

  async setCapabilityApprovalPolicy(
    connectorId: string,
    capabilityId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe',
    actor = 'agent-admin-user'
  ) {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    const capability = this.mcpCapabilityRegistry.get(capabilityId);
    if (!capability || capability.serverId !== connectorId) {
      throw new NotFoundException(`Capability ${capabilityId} not found for connector ${connectorId}`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    const overrides = (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
      item => item.capabilityId !== capabilityId
    );
    overrides.push({
      capabilityId,
      connectorId,
      effect,
      reason: `updated_from_admin:${effect}`,
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    });
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      capabilityPolicyOverrides: overrides
    };
    await this.runtimeStateRepository.save(snapshot);
    this.mcpCapabilityRegistry.setCapabilityApprovalOverride(capabilityId, effect);
    await this.appendGovernanceAudit({
      actor,
      action: 'connector.capability.policy.updated',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success',
      reason: `${capabilityId}:${effect}`
    });
    return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
  }

  async clearCapabilityApprovalPolicy(connectorId: string, capabilityId: string, actor = 'agent-admin-user') {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    const capability = this.mcpCapabilityRegistry.get(capabilityId);
    if (!capability || capability.serverId !== connectorId) {
      throw new NotFoundException(`Capability ${capabilityId} not found for connector ${connectorId}`);
    }
    const snapshot = await this.runtimeStateRepository.load();
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      capabilityPolicyOverrides: (snapshot.governance?.capabilityPolicyOverrides ?? []).filter(
        item => item.capabilityId !== capabilityId
      )
    };
    await this.runtimeStateRepository.save(snapshot);
    this.mcpCapabilityRegistry.setCapabilityApprovalOverride(capabilityId, undefined);
    await this.appendGovernanceAudit({
      actor,
      action: 'connector.capability.policy.cleared',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success',
      reason: capabilityId
    });
    return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
  }

  async closeConnectorSession(connectorId: string) {
    const closed = await this.mcpClientManager.closeServerSession(connectorId);
    await this.appendGovernanceAudit({
      actor: 'agent-admin-user',
      action: 'connector.session.closed',
      scope: 'connector',
      targetId: connectorId,
      outcome: closed ? 'success' : 'rejected',
      reason: closed ? undefined : 'session_not_open'
    });
    return {
      connectorId,
      closed
    };
  }

  async refreshConnectorDiscovery(connectorId: string) {
    const connector = this.mcpServerRegistry.get(connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    try {
      await this.mcpClientManager.refreshServerDiscovery(connectorId);
      this.registerDiscoveredCapabilities(connectorId);
      await this.persistConnectorDiscoverySnapshot(connectorId);
      await this.appendGovernanceAudit({
        actor: 'agent-admin-user',
        action: 'connector.discovery.refreshed',
        scope: 'connector',
        targetId: connectorId,
        outcome: 'success'
      });
      return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
    } catch (error) {
      await this.persistConnectorDiscoverySnapshot(connectorId, error);
      await this.appendGovernanceAudit({
        actor: 'agent-admin-user',
        action: 'connector.discovery.refreshed',
        scope: 'connector',
        targetId: connectorId,
        outcome: 'rejected',
        reason: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async configureConnector(dto: ConfigureConnectorDto) {
    const connectorId = dto.templateId === 'github-mcp-template' ? 'github-mcp' : 'browser-mcp';
    const snapshot = await this.runtimeStateRepository.load();
    const configuredConnectors = (snapshot.governance?.configuredConnectors ?? []).filter(
      item => item.connectorId !== connectorId
    );
    configuredConnectors.push({
      ...dto,
      connectorId,
      configuredAt: new Date().toISOString(),
      enabled: dto.enabled ?? true
    });
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      configuredConnectors
    };
    await this.runtimeStateRepository.save(snapshot);
    this.registerConfiguredConnector(configuredConnectors[configuredConnectors.length - 1]!);
    await this.mcpClientManager.refreshServerDiscovery(connectorId).catch(() => undefined);
    this.registerDiscoveredCapabilities(connectorId);
    await this.persistConnectorDiscoverySnapshot(connectorId).catch(() => undefined);
    await this.appendGovernanceAudit({
      actor: dto.actor ?? 'agent-admin-user',
      action: 'connector.configured',
      scope: 'connector',
      targetId: connectorId,
      outcome: 'success',
      reason: dto.templateId
    });
    return this.getConnectorsCenter().then(items => items.find(item => item.id === connectorId)!);
  }

  async getEvalsCenter(days = 30, filters?: { scenarioId?: string; outcome?: string }) {
    return this.summarizeAndPersistEvalHistory(this.orchestrator.listTasks(), days, filters);
  }

  async getPlatformConsole(days = 30) {
    const [skills, rules, learning, skillSources, connectors] = await Promise.all([
      this.skillRegistry.list(),
      this.orchestrator.listRules(),
      this.getLearningCenter(),
      this.getSkillSourcesCenter(),
      this.getConnectorsCenter()
    ]);
    const tasks = this.orchestrator.listTasks();
    const sessions = this.sessionCoordinator.listSessions();
    const checkpoints = sessions
      .map(session => {
        const checkpoint = this.sessionCoordinator.getCheckpoint(session.id);
        return checkpoint ? { session, checkpoint } : undefined;
      })
      .filter((item): item is { session: ChatSessionRecord; checkpoint: ChatCheckpointRecord } => Boolean(item));

    return {
      runtime: await this.getRuntimeCenter(days),
      approvals: this.getApprovalsCenter(),
      learning,
      evals: await this.getEvalsCenter(days),
      skills,
      evidence: this.getEvidenceCenter(),
      connectors,
      skillSources,
      companyAgents: this.getCompanyAgentsCenter(),
      rules,
      tasks,
      sessions,
      checkpoints
    };
  }

  async exportRuntimeCenter(options?: {
    days?: number;
    status?: string;
    model?: string;
    pricingSource?: string;
    format?: string;
  }) {
    const runtime = await this.getRuntimeCenter(options?.days ?? 30, options);
    const format = options?.format === 'json' ? 'json' : 'csv';
    if (format === 'json') {
      return {
        filename: `runtime-center-${options?.days ?? 30}d.json`,
        mimeType: 'application/json',
        content: JSON.stringify(runtime, null, 2)
      };
    }

    const lines = [
      'day,tokens,costUsd,costCny,runs,overBudget',
      ...(runtime.usageAnalytics.persistedDailyHistory ?? runtime.usageAnalytics.daily).map(
        point =>
          `${point.day},${point.tokens},${point.costUsd},${point.costCny},${point.runs},${point.overBudget ? 'true' : 'false'}`
      ),
      '',
      'taskId,status,currentMinistry,currentWorker,updatedAt',
      ...runtime.recentRuns.map(
        task =>
          `${csv(task.id)},${csv(task.status)},${csv(task.currentMinistry)},${csv(task.currentWorker)},${csv(task.updatedAt)}`
      )
    ];

    return {
      filename: `runtime-center-${options?.days ?? 30}d.csv`,
      mimeType: 'text/csv',
      content: lines.join('\n')
    };
  }

  async exportEvalsCenter(options?: { days?: number; scenarioId?: string; outcome?: string; format?: string }) {
    const evals = await this.getEvalsCenter(options?.days ?? 30, options);
    const format = options?.format === 'json' ? 'json' : 'csv';
    if (format === 'json') {
      return {
        filename: `evals-center-${options?.days ?? 30}d.json`,
        mimeType: 'application/json',
        content: JSON.stringify(evals, null, 2)
      };
    }

    const lines = [
      'day,runCount,passCount,passRate',
      ...(evals.persistedDailyHistory ?? evals.dailyTrend).map(
        point => `${point.day},${point.runCount},${point.passCount},${point.passRate}`
      ),
      '',
      'taskId,createdAt,success,scenarioIds',
      ...evals.recentRuns.map(
        run =>
          `${csv(run.taskId)},${csv(run.createdAt)},${run.success ? 'pass' : 'fail'},${csv(run.scenarioIds.join('|'))}`
      )
    ];

    return {
      filename: `evals-center-${options?.days ?? 30}d.csv`,
      mimeType: 'text/csv',
      content: lines.join('\n')
    };
  }

  private async listSkillSources(): Promise<SkillSourceRecord[]> {
    const disabledSourceIds = new Set(await this.getDisabledSkillSourceIds());
    const baseSources: Array<Omit<SkillSourceRecord, 'enabled' | 'healthState' | 'healthReason' | 'profilePolicy'>> = [
      {
        id: 'workspace-skills',
        name: 'Workspace Skills',
        kind: 'internal',
        baseUrl: `${this.settings.workspaceRoot}/skills`,
        discoveryMode: 'local-dir',
        syncStrategy: 'manual',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        trustClass: 'internal',
        priority: 'workspace/internal',
        authMode: 'none'
      },
      {
        id: 'managed-local-skills',
        name: 'Managed Local Skill Lab',
        kind: 'internal',
        baseUrl: this.settings.skillsRoot,
        discoveryMode: 'local-dir',
        syncStrategy: 'manual',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        trustClass: 'internal',
        priority: 'managed/local',
        authMode: 'none'
      },
      {
        id: 'bundled-marketplace',
        name: 'Bundled Marketplace',
        kind: 'marketplace',
        baseUrl: this.settings.skillSourcesRoot,
        discoveryMode: 'remote-index',
        indexUrl: join(this.settings.skillSourcesRoot, 'index.json'),
        packageBaseUrl: this.settings.skillSourcesRoot,
        syncStrategy: 'on-demand',
        allowedProfiles: ['platform', 'personal', 'cli'],
        trustClass: 'curated',
        priority: 'bundled/marketplace',
        authMode: 'none'
      }
    ];
    const sources = await Promise.all(
      baseSources.map(async source => {
        const remoteState =
          source.discoveryMode && source.discoveryMode !== 'local-dir'
            ? await this.skillSourceSyncService.readCachedSyncState({
                ...source,
                enabled: true
              } as SkillSourceRecord)
            : undefined;
        const profilePolicy = describeSkillSourceProfilePolicy(
          source.id,
          this.settings.profile,
          this.settings.policy.sourcePolicyMode
        );
        const explicitlyDisabled = disabledSourceIds.has(source.id);
        return {
          ...source,
          enabled: !explicitlyDisabled && profilePolicy.enabledByProfile,
          lastSyncedAt: remoteState?.lastSyncedAt,
          healthState:
            explicitlyDisabled || !profilePolicy.enabledByProfile
              ? 'disabled'
              : (remoteState?.healthState ?? 'healthy'),
          healthReason: explicitlyDisabled
            ? '该来源已在控制台停用。'
            : !profilePolicy.enabledByProfile
              ? profilePolicy.reason
              : remoteState?.healthReason,
          profilePolicy
        };
      })
    );
    return sources;
  }

  private async listSkillManifests(): Promise<SkillManifestRecord[]> {
    const sources = await this.listSkillSources();
    const localSources = sources.filter(
      source =>
        (source.discoveryMode ?? 'local-dir') === 'local-dir' && (source.enabled || source.id === 'workspace-skills')
    );
    const [localManifests, remoteManifestsBySource] = await Promise.all([
      loadAgentSkillManifests(localSources),
      Promise.all(
        sources
          .filter(source => source.enabled && (source.discoveryMode ?? 'local-dir') !== 'local-dir')
          .map(async source => this.skillSourceSyncService.readCachedManifests(source))
      )
    ]);
    const merged = [...localManifests, ...remoteManifestsBySource.flat()];
    const manifests = Array.from(
      new Map(merged.map(item => [`${item.sourceId}:${item.id}:${item.version}`, item])).values()
    );
    return manifests.map(manifest => ({
      ...manifest,
      safety: this.evaluateSkillManifestSafety(
        manifest,
        sources.find(source => source.id === manifest.sourceId)
      )
    }));
  }

  private async searchLocalSkillSuggestions(
    goal: string,
    options?: { usedInstalledSkills?: string[]; limit?: number }
  ) {
    const [installedSkills, sources, manifests] = await Promise.all([
      this.skillRegistry.list(),
      this.listSkillSources(),
      this.listSkillManifests()
    ]);

    return this.remoteSkillDiscoveryService.discover({
      goal,
      installedSkills,
      manifests,
      sources,
      profile: this.settings.profile,
      usedInstalledSkills: options?.usedInstalledSkills,
      limit: options?.limit ?? 5
    });
  }

  private async resolveTaskSkillSearch(goal: string, usedInstalledSkills?: string[]) {
    let searchResult = await this.searchLocalSkillSuggestions(goal, {
      usedInstalledSkills,
      limit: 5
    });
    const hasReadySuggestion = searchResult.suggestions.some(
      item => item.kind === 'installed' && item.availability === 'ready'
    );
    const manifests = await this.listSkillManifests();

    const enrichedSuggestions = searchResult.suggestions.map(suggestion => {
      const manifest = manifests.find(item => item.id === suggestion.id);
      return {
        ...suggestion,
        safety: this.evaluateSkillManifestSafety(manifest)
      };
    });
    searchResult = {
      ...searchResult,
      suggestions: [...enrichedSuggestions, ...this.buildConnectorTemplateSuggestions(goal)].slice(0, 6)
    };

    const safetyNotes = searchResult.suggestions.slice(0, 3).map(suggestion => {
      const safety = suggestion.safety;
      return safety
        ? `${suggestion.displayName}：${suggestion.availability}，${safety.verdict}，trust=${safety.trustScore}，${safety.reasons.join(
            '；'
          )}`
        : `${suggestion.displayName}：${suggestion.availability}`;
    });

    let status: SkillSearchStatus = searchResult.capabilityGapDetected
      ? searchResult.suggestions.some(item =>
          ['installable', 'installable-local', 'installable-remote', 'approval-required'].includes(item.availability)
        )
        ? 'suggested'
        : 'blocked'
      : 'not-needed';

    if (
      this.settings.policy.skillInstallMode === 'low-risk-auto' &&
      searchResult.capabilityGapDetected &&
      !hasReadySuggestion
    ) {
      const manifest = await this.findAutoInstallableManifest(searchResult.suggestions);
      if (manifest) {
        await this.autoInstallLocalManifest(manifest);
        searchResult = await this.searchLocalSkillSuggestions(goal, {
          usedInstalledSkills,
          limit: 5
        });
        status = 'auto-installed';
        safetyNotes.unshift(`已按当前 profile=${this.settings.profile} 自动安装低风险技能 ${manifest.id}。`);
      }
    }

    return {
      capabilityGapDetected: searchResult.capabilityGapDetected,
      status,
      suggestions: searchResult.suggestions,
      safetyNotes
    } as const;
  }

  private buildConnectorTemplateSuggestions(goal: string): LocalSkillSuggestionRecord[] {
    const loweredGoal = goal.toLowerCase();
    const suggestions: LocalSkillSuggestionRecord[] = [];
    if (/(github|pull request|pr|issue|workflow|release)/.test(loweredGoal)) {
      suggestions.push({
        id: 'github-mcp-template',
        kind: 'connector-template',
        displayName: 'GitHub MCP Template',
        summary: '为仓库、PR、Issue、Actions 和 code security 提供受控连接能力。',
        sourceId: 'github-official-template',
        score: 0.66,
        availability: 'approval-required',
        reason: '当前任务涉及 GitHub 工作流，建议在 Connector & Policy Center 配置 GitHub MCP。',
        requiredCapabilities: ['repo', 'issues', 'pull_requests', 'actions'],
        version: 'template',
        sourceLabel: 'Official MCP Template',
        sourceTrustClass: 'official',
        installationMode: 'configured'
      });
    }
    if (/(browser|playwright|ui|页面|截图|回放)/.test(loweredGoal)) {
      suggestions.push({
        id: 'browser-mcp-template',
        kind: 'connector-template',
        displayName: 'Browser MCP Template',
        summary: '为浏览器会话、截图、抽取和回放提供模板化连接入口。',
        sourceId: 'browserbase-playwright-template',
        score: 0.6,
        availability: 'approval-required',
        reason: '当前任务涉及浏览器操作或页面证据，建议配置 Browserbase 或 Playwright MCP。',
        requiredCapabilities: ['browse_page', 'screenshot', 'replay'],
        requiredConnectors: ['browser'],
        version: 'template',
        sourceLabel: 'Official MCP Template',
        sourceTrustClass: 'official',
        installationMode: 'configured'
      });
    }
    return suggestions;
  }

  private async findAutoInstallableManifest(
    suggestions: Awaited<ReturnType<RuntimeService['searchLocalSkillSuggestions']>>['suggestions']
  ) {
    const installable = suggestions.find(
      item =>
        item.kind === 'manifest' &&
        ['installable', 'installable-local', 'installable-remote'].includes(item.availability)
    );
    if (!installable) {
      return undefined;
    }

    const manifests = await this.listSkillManifests();
    const manifest = manifests.find(item => item.id === installable.id);
    if (!manifest) {
      return undefined;
    }

    const safety = this.evaluateSkillManifestSafety(manifest);
    if (
      safety.verdict !== 'allow' ||
      safety.trustScore < 80 ||
      !['official', 'curated', 'internal'].includes(safety.sourceTrustClass ?? '') ||
      !manifest.license
    ) {
      return undefined;
    }

    return manifest;
  }

  private evaluateSkillManifestSafety(
    manifest?: SkillManifestRecord,
    source?: SkillSourceRecord
  ): NonNullable<SkillManifestRecord['safety']> {
    if (!manifest) {
      return {
        verdict: 'blocked',
        trustScore: 0,
        maxRiskLevel: 'critical',
        reasons: ['未找到 skill manifest，无法评估安全性。'],
        riskyTools: [],
        missingDeclarations: ['manifest']
      };
    }

    const toolNames = manifest.allowedTools ?? manifest.requiredCapabilities ?? [];
    const riskyToolNames = new Set<string>();
    const missingDeclarations: string[] = [];
    let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = manifest.riskLevel;
    for (const toolName of toolNames) {
      const tool = this.toolRegistry.get(toolName);
      if (!tool) {
        missingDeclarations.push(`tool:${toolName}`);
        continue;
      }
      if (tool.riskLevel === 'critical' || tool.riskLevel === 'high') {
        riskyToolNames.add(toolName);
      }
      if (tool.riskLevel === 'critical') {
        maxRiskLevel = 'critical';
      } else if (tool.riskLevel === 'high' && maxRiskLevel !== 'critical') {
        maxRiskLevel = 'high';
      } else if (tool.riskLevel === 'medium' && maxRiskLevel === 'low') {
        maxRiskLevel = 'medium';
      }
    }

    const reasons = [
      manifest.license ? `license=${manifest.license}` : '未声明 license',
      manifest.compatibility ? `compatibility=${manifest.compatibility}` : '未声明 compatibility',
      toolNames.length ? `allowed tools=${toolNames.join(', ')}` : '未声明 allowed tools'
    ];
    if (!manifest.license) {
      missingDeclarations.push('license');
    }
    if (!manifest.compatibility) {
      missingDeclarations.push('compatibility');
    }
    if (!toolNames.length) {
      missingDeclarations.push('allowed-tools');
    }
    const sourceTrustClass =
      source?.trustClass ?? this.listSkillSourcesSnapshot().find(item => item.id === manifest.sourceId)?.trustClass;
    const profileCompatible =
      source?.profilePolicy?.enabledByProfile ??
      this.listSkillSourcesSnapshot().find(item => item.id === manifest.sourceId)?.profilePolicy?.enabledByProfile ??
      true;
    const trustClassScore =
      sourceTrustClass === 'internal'
        ? 30
        : sourceTrustClass === 'official'
          ? 24
          : sourceTrustClass === 'curated'
            ? 18
            : sourceTrustClass === 'community'
              ? 10
              : 0;
    const declarationScore = Math.max(0, 30 - missingDeclarations.length * 10);
    const riskPenalty =
      maxRiskLevel === 'critical' ? 40 : maxRiskLevel === 'high' ? 25 : maxRiskLevel === 'medium' ? 10 : 0;
    const connectorPenalty = Math.min(15, (manifest.requiredConnectors?.length ?? 0) * 5);
    const trustScore = Math.max(
      0,
      Math.min(
        100,
        trustClassScore + declarationScore + 40 - riskPenalty - connectorPenalty - (profileCompatible ? 0 : 40)
      )
    );

    if (riskyToolNames.size > 0) {
      reasons.push(`包含高风险工具：${[...riskyToolNames].join(', ')}`);
    }
    if (manifest.requiredConnectors?.length) {
      reasons.push(`依赖连接器：${manifest.requiredConnectors.join(', ')}`);
    }
    if (manifest.integrity) {
      reasons.push(`integrity=${manifest.integrity}`);
    } else {
      missingDeclarations.push('integrity');
      reasons.push('未声明 integrity');
    }
    if (sourceTrustClass) {
      reasons.push(`source trust=${sourceTrustClass}`);
    }
    if (!profileCompatible) {
      reasons.push(`当前 profile=${this.settings.profile} 下该来源受限`);
    }

    if (!profileCompatible || manifest.approvalPolicy === 'all-actions' || maxRiskLevel === 'critical') {
      return {
        verdict: 'blocked',
        trustScore,
        sourceTrustClass,
        profileCompatible,
        maxRiskLevel,
        reasons,
        riskyTools: [...riskyToolNames],
        missingDeclarations
      };
    }
    if (
      manifest.approvalPolicy === 'high-risk-only' ||
      maxRiskLevel === 'high' ||
      !manifest.license ||
      !manifest.compatibility ||
      !manifest.integrity ||
      sourceTrustClass === 'community' ||
      sourceTrustClass === 'unverified'
    ) {
      return {
        verdict: 'needs-approval',
        trustScore,
        sourceTrustClass,
        profileCompatible,
        maxRiskLevel,
        reasons,
        riskyTools: [...riskyToolNames],
        missingDeclarations
      };
    }
    return {
      verdict: 'allow',
      trustScore,
      sourceTrustClass,
      profileCompatible,
      maxRiskLevel,
      reasons,
      riskyTools: [...riskyToolNames],
      missingDeclarations
    };
  }

  private listSkillSourcesSnapshot() {
    return [
      {
        id: 'workspace-skills',
        name: 'Workspace Skills',
        kind: 'internal' as const,
        baseUrl: join(this.settings.workspaceRoot, 'skills'),
        discoveryMode: 'local-dir' as const,
        syncStrategy: 'manual' as const,
        allowedProfiles: ['platform', 'company', 'personal', 'cli'] as const,
        trustClass: 'internal' as const,
        priority: 'workspace/internal' as const,
        enabled: true,
        healthState: 'healthy' as const,
        profilePolicy: describeSkillSourceProfilePolicy(
          'workspace-skills',
          this.settings.profile,
          this.settings.policy.sourcePolicyMode
        )
      },
      {
        id: 'managed-local-skills',
        name: 'Managed Local Skills',
        kind: 'internal' as const,
        baseUrl: this.settings.skillsRoot,
        discoveryMode: 'local-dir' as const,
        syncStrategy: 'manual' as const,
        allowedProfiles: ['platform', 'company', 'personal', 'cli'] as const,
        trustClass: 'internal' as const,
        priority: 'managed/local' as const,
        enabled: true,
        healthState: 'healthy' as const,
        profilePolicy: describeSkillSourceProfilePolicy(
          'managed-local-skills',
          this.settings.profile,
          this.settings.policy.sourcePolicyMode
        )
      },
      {
        id: 'bundled-marketplace',
        name: 'Bundled Marketplace',
        kind: 'marketplace' as const,
        baseUrl: this.settings.skillSourcesRoot,
        discoveryMode: 'remote-index' as const,
        indexUrl: join(this.settings.skillSourcesRoot, 'index.json'),
        packageBaseUrl: this.settings.skillSourcesRoot,
        syncStrategy: 'on-demand' as const,
        allowedProfiles: ['platform', 'personal', 'cli'] as const,
        trustClass: 'curated' as const,
        priority: 'bundled/marketplace' as const,
        enabled: describeSkillSourceProfilePolicy(
          'bundled-marketplace',
          this.settings.profile,
          this.settings.policy.sourcePolicyMode
        ).enabledByProfile,
        healthState: 'healthy' as const,
        profilePolicy: describeSkillSourceProfilePolicy(
          'bundled-marketplace',
          this.settings.profile,
          this.settings.policy.sourcePolicyMode
        )
      }
    ];
  }

  private async autoInstallLocalManifest(manifest: SkillManifestRecord) {
    const sources = await this.listSkillSources();
    const source = sources.find(item => item.id === manifest.sourceId);
    if (!source || !source.enabled) {
      return undefined;
    }

    const receipt: SkillInstallReceipt = {
      id: `receipt_auto_${Date.now()}`,
      skillId: manifest.id,
      version: manifest.version,
      sourceId: source.id,
      approvedBy: 'runtime-auto',
      phase: 'approved',
      status: 'approved',
      result: 'auto_install_low_risk'
    };

    await this.writeSkillInstallReceipt(receipt);
    return this.finalizeSkillInstall(manifest, source, receipt);
  }

  private async getSkillInstallReceipt(receiptId: string): Promise<SkillInstallReceipt> {
    const receipts = await this.readSkillInstallReceipts();
    const receipt = receipts.find(item => item.id === receiptId);
    if (!receipt) {
      throw new NotFoundException(`Skill install receipt ${receiptId} not found`);
    }
    return receipt;
  }

  private async readSkillInstallReceipts(): Promise<SkillInstallReceipt[]> {
    return this.readJsonArray<SkillInstallReceipt>(join(this.settings.skillReceiptsRoot, 'receipts.json'));
  }

  private async writeSkillInstallReceipt(receipt: SkillInstallReceipt): Promise<void> {
    const receipts = await this.readSkillInstallReceipts();
    const deduped = receipts.filter(item => item.id !== receipt.id);
    deduped.push(receipt);
    await this.writeJson(join(this.settings.skillReceiptsRoot, 'receipts.json'), deduped);
    await this.writeJson(join(this.settings.skillReceiptsRoot, `${receipt.id}.json`), receipt);
  }

  private async readInstalledSkillRecords(): Promise<InstalledSkillRecord[]> {
    return this.readJsonArray<InstalledSkillRecord>(join(this.settings.skillPackagesRoot, 'installed.json'));
  }

  private async writeInstalledSkillRecord(record: InstalledSkillRecord): Promise<void> {
    const installed = await this.readInstalledSkillRecords();
    const deduped = installed.filter(item => !(item.skillId === record.skillId && item.version === record.version));
    deduped.push(record);
    await this.writeJson(join(this.settings.skillPackagesRoot, 'installed.json'), deduped);
  }

  private async finalizeSkillInstall(
    manifest: SkillManifestRecord,
    source: SkillSourceRecord,
    receipt: SkillInstallReceipt
  ): Promise<InstalledSkillRecord> {
    try {
      const installedAt = new Date().toISOString();
      const installBaseLocation = join(
        this.settings.skillPackagesRoot,
        source.kind === 'internal' ? 'internal' : source.kind === 'marketplace' ? 'marketplace' : 'third-party'
      );
      const installLocation = join(installBaseLocation, manifest.id, manifest.version);
      const installed: InstalledSkillRecord = {
        skillId: manifest.id,
        version: manifest.version,
        sourceId: source.id,
        installLocation,
        installedAt,
        status: 'installed',
        receiptId: receipt.id
      };

      const skillCard: SkillCard = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        applicableGoals: [manifest.summary ?? manifest.description],
        requiredTools: manifest.allowedTools ?? manifest.requiredCapabilities,
        steps: [
          {
            title: 'Load installed skill manifest',
            instruction: manifest.summary ?? manifest.description,
            toolNames: manifest.allowedTools ?? manifest.requiredCapabilities
          }
        ],
        constraints: [
          `source=${source.id}`,
          `approvalPolicy=${manifest.approvalPolicy}`,
          ...(manifest.compatibility ? [`compatibility=${manifest.compatibility}`] : []),
          ...(manifest.requiredConnectors ?? []).map(connector => `connector=${connector}`)
        ],
        successSignals: ['skill_installed', 'lab_ready'],
        riskLevel: manifest.riskLevel,
        source: 'research',
        status: 'lab',
        version: manifest.version,
        governanceRecommendation: 'keep-lab',
        sourceId: source.id,
        installReceiptId: receipt.id,
        requiredCapabilities: manifest.requiredCapabilities,
        requiredConnectors: manifest.requiredConnectors,
        allowedTools: manifest.allowedTools,
        compatibility: manifest.compatibility,
        createdAt: installedAt,
        updatedAt: installedAt
      };

      receipt.phase = 'downloading';
      receipt.result = 'downloading_artifact';
      await this.writeSkillInstallReceipt(receipt);
      const artifact = await this.skillArtifactFetcher.fetchToStaging(manifest, source, receipt.id);

      receipt.phase = 'verifying';
      receipt.downloadRef = artifact.artifactPath;
      receipt.result = artifact.integrityVerified ? 'artifact_verified' : 'artifact_staged';
      await this.writeSkillInstallReceipt(receipt);

      receipt.phase = 'installing';
      receipt.result = 'registering_skill';
      await this.writeSkillInstallReceipt(receipt);
      await this.skillArtifactFetcher.promoteFromStaging(artifact.stagingDir, installLocation);

      receipt.status = 'installed';
      receipt.phase = 'installed';
      receipt.installedAt = installedAt;
      receipt.result = 'installed_to_lab';
      await this.writeSkillInstallReceipt(receipt);
      await this.writeInstalledSkillRecord(installed);
      await this.writeJson(join(installLocation, `${manifest.id}@${manifest.version}.json`), {
        manifest,
        source,
        receipt,
        artifact
      });
      const published = await this.skillRegistry.publishToLab(skillCard);
      this.registerInstalledSkillWorker(published);
      return installed;
    } catch (error) {
      receipt.status = 'failed';
      receipt.phase = 'failed';
      receipt.failureCode = error instanceof Error ? error.message : 'skill_install_failed';
      receipt.failureDetail = error instanceof Error ? error.stack : String(error);
      receipt.result = 'install_failed';
      await this.writeSkillInstallReceipt(receipt);
      await rm(resolve(this.settings.workspaceRoot, 'data', 'skills', 'staging', receipt.id), {
        recursive: true,
        force: true
      });
      throw error;
    }
  }

  private async readJsonArray<T>(filePath: string): Promise<T[]> {
    try {
      const raw = await readFile(filePath, 'utf8');
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private async writeJson(filePath: string, payload: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(payload, null, 2));
  }

  private async syncEnabledRemoteSkillSources(): Promise<void> {
    const sources = await this.listSkillSources();
    const remoteSources = sources.filter(
      source => source.enabled && (source.discoveryMode ?? 'local-dir') !== 'local-dir'
    );
    for (const source of remoteSources) {
      await this.skillSourceSyncService.syncSource(source);
    }
  }

  private async syncInstalledSkillWorkers(): Promise<void> {
    const skills = await this.skillRegistry.list();
    skills
      .filter(skill => Boolean(skill.installReceiptId || skill.sourceId))
      .forEach(skill => this.registerInstalledSkillWorker(skill));
  }

  private async applyGovernanceOverrides(): Promise<void> {
    const snapshot = await this.runtimeStateRepository.load();
    for (const configured of snapshot.governance?.configuredConnectors ?? []) {
      this.registerConfiguredConnector(configured);
    }
    for (const workerId of snapshot.governance?.disabledCompanyWorkerIds ?? []) {
      this.orchestrator.setWorkerEnabled(workerId, false);
    }
    for (const connectorId of snapshot.governance?.disabledConnectorIds ?? []) {
      this.mcpServerRegistry.setEnabled(connectorId, false);
    }
    for (const override of snapshot.governance?.connectorPolicyOverrides ?? []) {
      this.mcpCapabilityRegistry.setServerApprovalOverride(override.connectorId, override.effect);
    }
    for (const override of snapshot.governance?.capabilityPolicyOverrides ?? []) {
      this.mcpCapabilityRegistry.setCapabilityApprovalOverride(override.capabilityId, override.effect);
    }
  }

  private async getDisabledSkillSourceIds(): Promise<string[]> {
    const snapshot = await this.runtimeStateRepository.load();
    return snapshot.governance?.disabledSkillSourceIds ?? [];
  }

  private registerConfiguredConnector(config: ConfiguredConnectorRecord) {
    const serverId = config.connectorId;
    const isGithub = config.templateId === 'github-mcp-template';
    this.mcpServerRegistry.register({
      id: serverId,
      displayName: config.displayName ?? (isGithub ? 'GitHub MCP' : 'Browser MCP'),
      transport: config.transport,
      enabled: config.enabled ?? true,
      endpoint: config.transport === 'http' ? config.endpoint : undefined,
      command: config.transport === 'stdio' ? config.command : undefined,
      args: config.transport === 'stdio' ? config.args : undefined,
      headers: config.transport === 'http' && config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      env:
        config.transport === 'stdio' && config.apiKey
          ? { GITHUB_TOKEN: config.apiKey, BROWSER_API_KEY: config.apiKey }
          : undefined,
      source: isGithub ? 'github-configured' : 'browser-configured',
      trustClass: 'official',
      dataScope: isGithub
        ? 'repos, pull requests, issues and workflows'
        : 'browser sessions, screenshots and replay data',
      writeScope: isGithub ? 'repository operations after approval' : 'browser actions after approval',
      installationMode: 'configured',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });

    const capabilities = isGithub
      ? [
          {
            id: `${serverId}:github.search_repos`,
            toolName: 'github.search_repos',
            displayName: 'GitHub Search Repos',
            riskLevel: 'low' as const,
            requiresApproval: false,
            category: 'knowledge' as const,
            dataScope: 'repository metadata',
            writeScope: 'none'
          },
          {
            id: `${serverId}:github.list_pull_requests`,
            toolName: 'github.list_pull_requests',
            displayName: 'GitHub List Pull Requests',
            riskLevel: 'low' as const,
            requiresApproval: false,
            category: 'knowledge' as const,
            dataScope: 'pull request metadata',
            writeScope: 'none'
          },
          {
            id: `${serverId}:github.create_issue_comment`,
            toolName: 'github.create_issue_comment',
            displayName: 'GitHub Create Issue Comment',
            riskLevel: 'high' as const,
            requiresApproval: true,
            category: 'action' as const,
            dataScope: 'repository issues',
            writeScope: 'issue comments'
          }
        ]
      : [
          {
            id: `${serverId}:browser.open_page`,
            toolName: 'browser.open_page',
            displayName: 'Browser Open Page',
            riskLevel: 'high' as const,
            requiresApproval: true,
            category: 'action' as const,
            dataScope: 'browser session data',
            writeScope: 'browser navigation'
          },
          {
            id: `${serverId}:browser.capture_screenshot`,
            toolName: 'browser.capture_screenshot',
            displayName: 'Browser Capture Screenshot',
            riskLevel: 'medium' as const,
            requiresApproval: true,
            category: 'knowledge' as const,
            dataScope: 'page screenshots',
            writeScope: 'artifact generation'
          },
          {
            id: `${serverId}:browser.extract_dom`,
            toolName: 'browser.extract_dom',
            displayName: 'Browser Extract DOM',
            riskLevel: 'medium' as const,
            requiresApproval: true,
            category: 'knowledge' as const,
            dataScope: 'page DOM',
            writeScope: 'none'
          }
        ];

    for (const capability of capabilities) {
      this.mcpCapabilityRegistry.register({
        ...capability,
        serverId
      });
    }
  }

  private registerDiscoveredCapabilities(connectorId: string) {
    const server = this.mcpClientManager.describeServers().find(item => item.id === connectorId);
    if (!server?.discoveredCapabilities?.length) {
      return;
    }

    const existingToolNames = new Set(
      this.mcpCapabilityRegistry.listByServer(connectorId).map(capability => capability.toolName)
    );

    for (const toolName of server.discoveredCapabilities) {
      if (existingToolNames.has(toolName)) {
        continue;
      }
      this.mcpCapabilityRegistry.register({
        id: `${connectorId}:${toolName}`,
        toolName,
        serverId: connectorId,
        displayName: this.toCapabilityDisplayName(toolName),
        riskLevel: this.inferCapabilityRiskLevel(toolName),
        requiresApproval: this.inferCapabilityRequiresApproval(toolName),
        category: this.inferCapabilityCategory(toolName),
        dataScope: server.dataScope,
        writeScope: this.inferCapabilityRequiresApproval(toolName) ? (server.writeScope ?? 'connector action') : 'none'
      });
    }
  }

  private toCapabilityDisplayName(toolName: string) {
    return toolName
      .split(/[._:-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private inferCapabilityRiskLevel(toolName: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowered = toolName.toLowerCase();
    if (/(delete|merge|publish|release|write|comment|create|submit|click|navigate|open_page)/.test(lowered)) {
      return 'high';
    }
    if (/(screenshot|extract|analysis|diff|capture)/.test(lowered)) {
      return 'medium';
    }
    return 'low';
  }

  private inferCapabilityRequiresApproval(toolName: string): boolean {
    return this.inferCapabilityRiskLevel(toolName) !== 'low';
  }

  private inferCapabilityCategory(toolName: string): 'knowledge' | 'system' | 'action' | 'memory' {
    const lowered = toolName.toLowerCase();
    if (/(open|click|navigate|create|write|delete|merge|submit|release|comment)/.test(lowered)) {
      return 'action';
    }
    return 'knowledge';
  }

  private taskTouchesCapability(task: TaskRecord, toolName: string): boolean {
    const loweredToolName = toolName.toLowerCase();
    return (task.trace ?? []).some(trace => {
      const summary = String(trace.summary ?? '').toLowerCase();
      const node = String(trace.node ?? '').toLowerCase();
      const data = JSON.stringify(trace.data ?? '').toLowerCase();
      return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
    });
  }

  private findCapabilityTraceSummary(task: TaskRecord, toolName: string): string | undefined {
    const loweredToolName = toolName.toLowerCase();
    const trace = (task.trace ?? []).find(item => {
      const summary = String(item.summary ?? '').toLowerCase();
      const node = String(item.node ?? '').toLowerCase();
      const data = JSON.stringify(item.data ?? '').toLowerCase();
      return summary.includes(loweredToolName) || node.includes(loweredToolName) || data.includes(loweredToolName);
    });
    return trace?.summary ?? trace?.node;
  }

  private groupConnectorDiscoveryHistory(history: ConnectorDiscoveryHistoryRecord[]) {
    const grouped = new Map<string, ConnectorDiscoveryHistoryRecord[]>();
    for (const entry of history.slice().sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt))) {
      const items = grouped.get(entry.connectorId) ?? [];
      items.push(entry);
      grouped.set(entry.connectorId, items);
    }
    return grouped;
  }

  private groupGovernanceAuditByTarget(history: NonNullable<RuntimeStateSnapshot['governanceAudit']>) {
    const grouped = new Map<string, typeof history>();
    for (const entry of history) {
      if (entry.scope !== 'connector') {
        continue;
      }
      const items = grouped.get(entry.targetId) ?? [];
      items.push(entry);
      grouped.set(entry.targetId, items);
    }
    return grouped;
  }

  private async persistConnectorDiscoverySnapshot(connectorId: string, error?: unknown) {
    const snapshot = await this.runtimeStateRepository.load();
    const connector = this.mcpClientManager.describeServers().find(item => item.id === connectorId);
    const record = this.toConnectorDiscoveryHistoryRecord(
      connectorId,
      connector,
      error instanceof Error ? error.message : error ? String(error) : undefined
    );
    const nextHistory = [
      record,
      ...(snapshot.governance?.connectorDiscoveryHistory ?? []).filter(
        item => !(item.connectorId === connectorId && item.discoveredAt === record.discoveredAt)
      )
    ].slice(0, 40);
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      connectorDiscoveryHistory: nextHistory
    };
    await this.runtimeStateRepository.save(snapshot);
  }

  private toConnectorDiscoveryHistoryRecord(
    connectorId: string,
    connector:
      | (ReturnType<McpClientManager['describeServers']>[number] & {
          capabilities?: Array<{ toolName: string }>;
        })
      | undefined,
    error?: string
  ): ConnectorDiscoveryHistoryRecord {
    const discoveredAt = connector?.lastDiscoveredAt ?? new Date().toISOString();
    const discoveredCapabilities =
      connector?.discoveredCapabilities ?? connector?.capabilities?.map(capability => capability.toolName) ?? [];
    return {
      connectorId,
      discoveredAt,
      discoveryMode: connector?.discoveryMode ?? 'registered',
      sessionState:
        connector?.sessionState ??
        this.defaultConnectorSessionState(connector?.transport as 'http' | 'stdio' | 'local-adapter' | undefined),
      discoveredCapabilities,
      error: error ?? connector?.lastDiscoveryError
    };
  }

  private defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter') {
    if (transport === 'stdio') {
      return 'disconnected' as const;
    }
    return 'stateless' as const;
  }

  private getDisabledCompanyWorkerIdsSync(): string[] {
    return this.orchestrator
      .listWorkers()
      .filter(worker => worker.kind === 'company')
      .filter(worker => !this.orchestrator.isWorkerEnabled?.(worker.id))
      .map(worker => worker.id);
  }

  private async appendGovernanceAudit(entry: {
    actor: string;
    action: string;
    scope: 'skill-source' | 'company-worker' | 'skill-install' | 'connector';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }): Promise<void> {
    const snapshot = await this.runtimeStateRepository.load();
    snapshot.governanceAudit = [
      {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        ...entry
      },
      ...(snapshot.governanceAudit ?? [])
    ].slice(0, 50);
    await this.runtimeStateRepository.save(snapshot);
  }

  private async getRecentGovernanceAudit() {
    const snapshot = await this.runtimeStateRepository.load();
    return (snapshot.governanceAudit ?? []).slice(0, 10);
  }

  private registerInstalledSkillWorker(skill: SkillCard): void {
    this.orchestrator.registerWorker({
      id: `installed-skill:${skill.id}`,
      ministry: this.resolveInstalledSkillMinistry(skill),
      kind: 'installed-skill',
      displayName: `${skill.name} 已安装技能`,
      defaultModel: this.resolveInstalledSkillModel(skill),
      supportedCapabilities: skill.requiredCapabilities ?? skill.requiredTools,
      reviewPolicy: 'self-check',
      sourceId: skill.sourceId,
      owner: 'skill-lab',
      tags: this.buildInstalledSkillTags(skill),
      requiredConnectors: skill.requiredConnectors,
      preferredContexts: skill.applicableGoals
    });
  }

  private resolveInstalledSkillMinistry(skill: SkillCard): MinistryId {
    const capabilities = [...(skill.requiredCapabilities ?? []), ...(skill.requiredTools ?? [])].map(item =>
      item.toLowerCase()
    );
    if (capabilities.some(item => item.includes('browser') || item.includes('release') || item.includes('terminal'))) {
      return 'bingbu-ops';
    }
    if (
      capabilities.some(item => item.includes('review') || item.includes('security') || item.includes('compliance'))
    ) {
      return 'xingbu-review';
    }
    if (
      capabilities.some(item => item.includes('documentation') || item.includes('ui-spec') || item.includes('openapi'))
    ) {
      return 'libu-docs';
    }
    if (capabilities.some(item => item.includes('write') || item.includes('code') || item.includes('refactor'))) {
      return 'gongbu-code';
    }
    if (capabilities.some(item => item.includes('search') || item.includes('memory') || item.includes('knowledge'))) {
      return 'hubu-search';
    }
    return 'libu-docs';
  }

  private resolveInstalledSkillModel(skill: SkillCard): string {
    const ministry = this.resolveInstalledSkillMinistry(skill);
    switch (ministry) {
      case 'hubu-search':
        return this.settings.zhipuModels.research;
      case 'xingbu-review':
        return this.settings.zhipuModels.reviewer;
      case 'gongbu-code':
      case 'bingbu-ops':
        return this.settings.zhipuModels.executor;
      case 'libu-docs':
      case 'libu-router':
      default:
        return this.settings.zhipuModels.manager;
    }
  }

  private buildInstalledSkillTags(skill: SkillCard): string[] {
    const tags = new Set<string>();
    skill.name
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter(Boolean)
      .forEach(tag => tags.add(tag));
    skill.applicableGoals.forEach(goal =>
      goal
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
        .filter(token => token.length >= 2)
        .slice(0, 6)
        .forEach(token => tags.add(token))
    );
    return Array.from(tags);
  }

  private extractBrowserReplay(detail?: Record<string, unknown>) {
    if (!detail) {
      return undefined;
    }

    const toolName = typeof detail.toolName === 'string' ? detail.toolName : undefined;
    const url =
      typeof detail.url === 'string' ? detail.url : typeof detail.sourceUrl === 'string' ? detail.sourceUrl : undefined;

    const looksLikeBrowserEvidence =
      toolName === 'browse_page' ||
      toolName === 'page_snapshot' ||
      typeof detail.snapshotSummary === 'string' ||
      typeof detail.screenshotRef === 'string' ||
      (Array.isArray(detail.stepTrace) && detail.stepTrace.length > 0);

    if (!looksLikeBrowserEvidence && !url) {
      return undefined;
    }

    const rawStepTrace = Array.isArray(detail.stepTrace)
      ? detail.stepTrace.filter((item): item is string => typeof item === 'string')
      : [];

    return {
      sessionId: typeof detail.sessionId === 'string' ? detail.sessionId : undefined,
      url,
      snapshotSummary:
        typeof detail.snapshotSummary === 'string'
          ? detail.snapshotSummary
          : typeof detail.outputSummary === 'string'
            ? detail.outputSummary
            : typeof detail.summary === 'string'
              ? detail.summary
              : undefined,
      artifactRef: typeof detail.artifactRef === 'string' ? detail.artifactRef : undefined,
      snapshotRef: typeof detail.snapshotRef === 'string' ? detail.snapshotRef : undefined,
      screenshotRef: typeof detail.screenshotRef === 'string' ? detail.screenshotRef : undefined,
      stepTrace: rawStepTrace.length ? rawStepTrace : undefined,
      steps: Array.isArray(detail.steps)
        ? detail.steps
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map(item => {
              const status: 'completed' | 'failed' | 'running' =
                item.status === 'failed' || item.status === 'running' ? item.status : 'completed';
              return {
                id: typeof item.id === 'string' ? item.id : 'step',
                title: typeof item.title === 'string' ? item.title : 'Step',
                status,
                at: typeof item.at === 'string' ? item.at : new Date().toISOString(),
                summary: typeof item.summary === 'string' ? item.summary : undefined,
                artifactRef: typeof item.artifactRef === 'string' ? item.artifactRef : undefined
              };
            })
        : undefined
    };
  }

  private describeCapabilityApprovalReason(connectorDisplayName: string, toolName: string, riskLevel: string) {
    if (riskLevel === 'critical') {
      return `${connectorDisplayName} 的 ${toolName} 属于 critical 风险能力，命中强审批策略。`;
    }
    if (riskLevel === 'high') {
      return `${connectorDisplayName} 的 ${toolName} 属于 high 风险能力，执行前必须人工确认。`;
    }
    return `${connectorDisplayName} 的 ${toolName} 被标记为需审批能力，当前策略要求在调用前确认。`;
  }

  private async summarizeAndPersistUsageAnalytics(
    tasks: TaskRecord[],
    days: number,
    filters?: { model?: string; pricingSource?: string }
  ) {
    const analytics = summarizeUsageAnalytics(tasks);
    const providerBillingStatus = await this.fetchProviderUsageAudit(days);
    const snapshot = await this.runtimeStateRepository.load();
    const currentByDay = new Map<string, UsageHistoryPoint>(
      (snapshot.usageHistory ?? []).map(item => [item.day, item] as const)
    );
    for (const point of analytics.daily) {
      currentByDay.set(point.day, {
        ...point,
        measuredRunCount: analytics.measuredRunCount,
        estimatedRunCount: analytics.estimatedRunCount,
        updatedAt: new Date().toISOString()
      });
    }
    const mergedHistory: UsageHistoryPoint[] = Array.from(currentByDay.values())
      .sort((left, right) => left.day.localeCompare(right.day))
      .slice(-30);
    const currentAuditByTask = new Map<string, UsageAuditRecord>(
      (snapshot.usageAudit ?? []).map(item => [item.taskId, item] as const)
    );
    for (const task of tasks) {
      if (!task.llmUsage) {
        continue;
      }
      currentAuditByTask.set(task.id, {
        taskId: task.id,
        day: formatDay(task.updatedAt ?? task.createdAt),
        modelBreakdown: task.llmUsage.models.map(item => ({
          model: item.model,
          totalTokens: item.totalTokens,
          costUsd: item.costUsd ?? 0,
          costCny: item.costCny ?? 0,
          pricingSource: item.pricingSource,
          callCount: item.callCount
        })),
        totalTokens: task.llmUsage.totalTokens,
        totalCostUsd: roundCurrency(task.llmUsage.models.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)),
        totalCostCny: roundCurrency(task.llmUsage.models.reduce((sum, item) => sum + (item.costCny ?? 0), 0)),
        measuredCallCount: task.llmUsage.measuredCallCount,
        estimatedCallCount: task.llmUsage.estimatedCallCount,
        updatedAt: task.llmUsage.updatedAt
      });
    }
    const mergedAudit: UsageAuditRecord[] = Array.from(currentAuditByTask.values())
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 50);
    await this.runtimeStateRepository.save({
      ...snapshot,
      usageHistory: mergedHistory,
      usageAudit: mergedAudit
    });
    const windowedHistory = mergedHistory.slice(-Math.max(1, days));
    const filteredAudit = mergedAudit
      .filter(item => !filters?.model || item.modelBreakdown.some(model => model.model === filters.model))
      .filter(
        item =>
          !filters?.pricingSource ||
          item.modelBreakdown.some(model => (model.pricingSource ?? 'estimated') === filters.pricingSource)
      );
    const filteredModels = analytics.models.filter(
      item =>
        (!filters?.model || item.model === filters.model) &&
        (!filters?.pricingSource ||
          filteredAudit.some(audit =>
            audit.modelBreakdown.some(
              breakdown =>
                breakdown.model === item.model && (breakdown.pricingSource ?? 'estimated') === filters.pricingSource
            )
          ))
    );

    return {
      ...analytics,
      models: filteredModels,
      historyDays: mergedHistory.length,
      historyRange:
        mergedHistory.length > 0
          ? {
              earliestDay: mergedHistory[0]?.day,
              latestDay: mergedHistory[mergedHistory.length - 1]?.day
            }
          : undefined,
      persistedDailyHistory: windowedHistory,
      recentUsageAudit: filteredAudit.slice(0, 10),
      providerBillingStatus,
      providerBillingDailyHistory: providerBillingStatus.daily,
      providerBillingTotals: summarizeProviderBilling(providerBillingStatus.daily)
    };
  }

  private async summarizeAndPersistEvalHistory(
    tasks: TaskRecord[],
    days: number,
    filters?: { scenarioId?: string; outcome?: string }
  ) {
    const evals = evaluateBenchmarks(tasks);
    const snapshot = await this.runtimeStateRepository.load();
    const currentByDay = new Map<string, EvalHistoryPoint>(
      (snapshot.evalHistory ?? []).map(item => [item.day, item] as const)
    );
    for (const point of evals.dailyTrend) {
      currentByDay.set(point.day, {
        ...point,
        scenarioCount: evals.scenarioCount,
        overallPassRate: evals.overallPassRate,
        updatedAt: new Date().toISOString()
      });
    }
    const mergedHistory: EvalHistoryPoint[] = Array.from(currentByDay.values())
      .sort((left, right) => left.day.localeCompare(right.day))
      .slice(-30);
    await this.runtimeStateRepository.save({
      ...snapshot,
      evalHistory: mergedHistory
    });
    const windowedHistory = mergedHistory.slice(-Math.max(1, days));
    const filteredRecentRuns = evals.recentRuns.filter(
      run =>
        (!filters?.scenarioId || run.scenarioIds.includes(filters.scenarioId)) &&
        (!filters?.outcome || (filters.outcome === 'pass' ? run.success : !run.success))
    );
    const filteredScenarios = evals.scenarios.filter(
      scenario => !filters?.scenarioId || scenario.scenarioId === filters.scenarioId
    );

    return {
      ...evals,
      scenarios: filteredScenarios,
      recentRuns: filteredRecentRuns,
      historyDays: mergedHistory.length,
      historyRange:
        mergedHistory.length > 0
          ? {
              earliestDay: mergedHistory[0]?.day,
              latestDay: mergedHistory[mergedHistory.length - 1]?.day
            }
          : undefined,
      persistedDailyHistory: windowedHistory
    };
  }

  private async fetchProviderUsageAudit(days: number): Promise<ProviderAuditSyncResult> {
    return fetchProviderUsageAudit(
      this.settings.providerAudit.adapters,
      this.settings.providerAudit.primaryProvider,
      days
    );
  }
}

function csv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.split('"').join('""')}"`;
}

const MODEL_COST_PER_1K_TOKENS_USD: Record<string, number> = {
  'glm-5': 0.002,
  'glm-4.7-flashx': 0.0005,
  'glm-4.7': 0.001,
  'glm-4.6': 0.0012,
  default: 0.001
};

const USAGE_BUDGET_POLICY = {
  dailyTokenWarning: 100_000,
  dailyCostCnyWarning: 5,
  totalCostCnyWarning: 20
};

function summarizeUsageAnalytics(tasks: TaskRecord[]) {
  const daily = new Map<string, { tokens: number; costUsd: number; runs: number }>();
  const models = new Map<string, { tokens: number; costUsd: number; runCount: number }>();

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let providerCostUsd = 0;
  let estimatedCostUsd = 0;
  let measuredRunCount = 0;
  let estimatedRunCount = 0;

  for (const task of tasks) {
    const usage = task.llmUsage;
    const promptTokens =
      usage?.promptTokens ??
      estimateTokens(
        [
          task.goal,
          task.plan?.summary,
          ...(task.externalSources ?? []).map((source: { summary?: string }) => source.summary ?? '')
        ].join(' ').length
      );
    const completionTokens =
      usage?.completionTokens ??
      estimateTokens(
        [
          task.result ?? '',
          ...(task.trace ?? []).map((trace: { summary?: string }) => trace.summary ?? ''),
          ...(task.messages ?? []).map((message: { content?: string }) => message.content ?? '')
        ].join(' ').length
      );
    const taskTokens = usage?.totalTokens ?? promptTokens + completionTokens;
    totalPromptTokens += promptTokens;
    totalCompletionTokens += completionTokens;
    if ((usage?.measuredCallCount ?? 0) > 0) {
      measuredRunCount += 1;
    } else {
      estimatedRunCount += 1;
    }

    const taskDay = formatDay(task.updatedAt ?? task.createdAt);
    let taskCostUsd = 0;
    if (usage?.models?.length) {
      for (const modelUsage of usage.models) {
        const normalizedModel = modelUsage.model || 'unknown';
        const modelCostUsd = modelUsage.costUsd ?? estimateModelCost(modelUsage.totalTokens, normalizedModel);
        taskCostUsd += modelCostUsd;
        if (modelUsage.pricingSource === 'provider') {
          providerCostUsd += modelCostUsd;
        } else {
          estimatedCostUsd += modelCostUsd;
        }

        const modelBucket = models.get(normalizedModel) ?? { tokens: 0, costUsd: 0, runCount: 0 };
        modelBucket.tokens += modelUsage.totalTokens;
        modelBucket.costUsd += modelCostUsd;
        modelBucket.runCount += modelUsage.callCount;
        models.set(normalizedModel, modelBucket);
      }
    } else {
      const taskModels: string[] = Array.from(
        new Set(
          (task.modelRoute ?? [])
            .map(route => route.selectedModel)
            .filter((m): m is string => typeof m === 'string' && m.length > 0)
        )
      );
      const allocatedModels: string[] = taskModels.length > 0 ? taskModels : ['default'];
      const tokenShare = taskTokens / allocatedModels.length;

      for (const model of allocatedModels) {
        const normalizedModel = model || 'default';
        const modelCostUsd = estimateModelCost(tokenShare, normalizedModel);
        taskCostUsd += modelCostUsd;
        estimatedCostUsd += modelCostUsd;

        const modelBucket = models.get(normalizedModel) ?? { tokens: 0, costUsd: 0, runCount: 0 };
        modelBucket.tokens += Math.round(tokenShare);
        modelBucket.costUsd += modelCostUsd;
        modelBucket.runCount += 1;
        models.set(normalizedModel, modelBucket);
      }
    }

    totalCostUsd += taskCostUsd;
    const dayBucket = daily.get(taskDay) ?? { tokens: 0, costUsd: 0, runs: 0 };
    dayBucket.tokens += taskTokens;
    dayBucket.costUsd += taskCostUsd;
    dayBucket.runs += 1;
    daily.set(taskDay, dayBucket);
  }

  return {
    totalEstimatedPromptTokens: totalPromptTokens,
    totalEstimatedCompletionTokens: totalCompletionTokens,
    totalEstimatedTokens: totalPromptTokens + totalCompletionTokens,
    totalEstimatedCostUsd: roundCurrency(totalCostUsd),
    totalEstimatedCostCny: roundCurrency(totalCostUsd * 7.2),
    providerMeasuredCostUsd: roundCurrency(providerCostUsd),
    providerMeasuredCostCny: roundCurrency(providerCostUsd * 7.2),
    estimatedFallbackCostUsd: roundCurrency(estimatedCostUsd),
    estimatedFallbackCostCny: roundCurrency(estimatedCostUsd * 7.2),
    measuredRunCount,
    estimatedRunCount,
    daily: Array.from(daily.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-7)
      .map(([day, bucket]) => ({
        day,
        tokens: bucket.tokens,
        costUsd: roundCurrency(bucket.costUsd),
        costCny: roundCurrency(bucket.costUsd * 7.2),
        runs: bucket.runs,
        overBudget:
          bucket.tokens >= USAGE_BUDGET_POLICY.dailyTokenWarning ||
          bucket.costUsd * 7.2 >= USAGE_BUDGET_POLICY.dailyCostCnyWarning
      })),
    models: Array.from(models.entries())
      .map(([model, bucket]) => ({
        model,
        tokens: bucket.tokens,
        costUsd: roundCurrency(bucket.costUsd),
        costCny: roundCurrency(bucket.costUsd * 7.2),
        runCount: bucket.runCount
      }))
      .sort((left, right) => right.tokens - left.tokens),
    budgetPolicy: {
      dailyTokenWarning: USAGE_BUDGET_POLICY.dailyTokenWarning,
      dailyCostCnyWarning: USAGE_BUDGET_POLICY.dailyCostCnyWarning,
      totalCostCnyWarning: USAGE_BUDGET_POLICY.totalCostCnyWarning
    },
    alerts: buildUsageAlerts({
      totalCostCny: roundCurrency(totalCostUsd * 7.2),
      totalTokens: totalPromptTokens + totalCompletionTokens,
      daily: Array.from(daily.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .slice(-7)
        .map(([day, bucket]) => ({
          day,
          tokens: bucket.tokens,
          costCny: roundCurrency(bucket.costUsd * 7.2)
        }))
    })
  };
}

function estimateTokens(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

function formatDay(value?: string): string {
  const date = value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toISOString().slice(0, 10);
}

function roundCurrency(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function estimateModelCost(tokens: number, model: string): number {
  const rate = MODEL_COST_PER_1K_TOKENS_USD[model] ?? MODEL_COST_PER_1K_TOKENS_USD.default;
  return (tokens / 1000) * rate;
}

function buildUsageAlerts(input: {
  totalCostCny: number;
  totalTokens: number;
  daily: Array<{ day: string; tokens: number; costCny: number }>;
}) {
  const alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
  }> = [];

  for (const day of input.daily) {
    if (day.tokens >= USAGE_BUDGET_POLICY.dailyTokenWarning) {
      alerts.push({
        level: 'warning',
        title: `Daily token budget warning: ${day.day}`,
        description: `Used ${day.tokens.toLocaleString()} tokens on ${day.day}, exceeding ${USAGE_BUDGET_POLICY.dailyTokenWarning.toLocaleString()}.`
      });
    }
    if (day.costCny >= USAGE_BUDGET_POLICY.dailyCostCnyWarning) {
      alerts.push({
        level: 'warning',
        title: `Daily cost budget warning: ${day.day}`,
        description: `Estimated cost on ${day.day} is RMB ${day.costCny.toFixed(2)}, exceeding RMB ${USAGE_BUDGET_POLICY.dailyCostCnyWarning.toFixed(2)}.`
      });
    }
  }

  if (input.totalCostCny >= USAGE_BUDGET_POLICY.totalCostCnyWarning) {
    alerts.push({
      level: 'critical',
      title: 'Total cost approaching budget limit',
      description: `Current estimated total cost is RMB ${input.totalCostCny.toFixed(2)}, exceeding RMB ${USAGE_BUDGET_POLICY.totalCostCnyWarning.toFixed(2)}.`
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: 'info',
      title: 'Budget status normal',
      description: `Current cumulative usage is ${input.totalTokens.toLocaleString()} tokens and no budget threshold has been triggered.`
    });
  }

  return alerts;
}
