import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import { loadSettings } from '@agent/config';
import { AgentOrchestrator, SessionCoordinator, ZhipuLlmProvider } from '@agent/agent-core';
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
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  CreateChatSessionDto,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto,
  LearningConfirmationDto,
  MemoryRecord,
  RetireKnowledgeDto,
  SearchMemoryDto,
  SessionCancelDto,
  SessionApprovalDto,
  SkillCard,
  SkillStatus,
  TaskRecord,
  InvalidateKnowledgeDto,
  SupersedeKnowledgeDto,
  UpdateChatSessionDto
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';
import {
  ApprovalService,
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  StubSandboxExecutor,
  createDefaultToolRegistry
} from '@agent/tools';

import {
  fetchProviderUsageAudit,
  ProviderAuditDailyRecord,
  ProviderAuditSyncResult,
  summarizeProviderBilling
} from './provider-audit';

type UsageHistoryPoint = NonNullable<RuntimeStateSnapshot['usageHistory']>[number];
type EvalHistoryPoint = NonNullable<RuntimeStateSnapshot['evalHistory']>[number];
type UsageAuditRecord = NonNullable<RuntimeStateSnapshot['usageAudit']>[number];

@Injectable()
export class RuntimeService implements OnModuleInit {
  private readonly settings = loadSettings();
  private readonly memoryRepository = new FileMemoryRepository();
  private readonly ruleRepository = new FileRuleRepository();
  private readonly skillRegistry = new SkillRegistry();
  private readonly approvalService = new ApprovalService();
  private readonly runtimeStateRepository = new FileRuntimeStateRepository();
  private readonly llmProvider = new ZhipuLlmProvider();
  private readonly sandboxExecutor = new StubSandboxExecutor();
  private readonly toolRegistry = createDefaultToolRegistry();
  private readonly mcpServerRegistry = new McpServerRegistry();
  private readonly mcpCapabilityRegistry = new McpCapabilityRegistry();
  private readonly mcpClientManager: McpClientManager;
  private readonly orchestrator: AgentOrchestrator;
  private readonly sessionCoordinator: SessionCoordinator;

  constructor() {
    this.mcpServerRegistry.register({
      id: 'local-workspace',
      displayName: '本地工作区 MCP 兼容适配器',
      transport: 'local-adapter',
      enabled: true
    });
    this.mcpCapabilityRegistry.registerFromTools('local-workspace', this.toolRegistry.list());
    if (this.settings.mcp.bigmodelApiKey) {
      const authHeaders = {
        Authorization: `Bearer ${this.settings.mcp.bigmodelApiKey}`
      };
      this.mcpServerRegistry.register({
        id: 'bigmodel-web-search',
        displayName: '鏅鸿氨鑱旂綉鎼滅储 MCP',
        transport: 'http',
        endpoint: this.settings.mcp.webSearchEndpoint,
        headers: authHeaders,
        enabled: true
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-web-reader',
        displayName: '鏅鸿氨缃戦〉璇诲彇 MCP',
        transport: 'http',
        endpoint: this.settings.mcp.webReaderEndpoint,
        headers: authHeaders,
        enabled: true
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-zread',
        displayName: '鏅鸿氨寮€婧愪粨搴?MCP',
        transport: 'http',
        endpoint: this.settings.mcp.zreadEndpoint,
        headers: authHeaders,
        enabled: true
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-vision',
        displayName: '鏅鸿氨瑙嗚鐞嗚В MCP',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@z_ai/mcp-server@latest'],
        env: {
          Z_AI_API_KEY: this.settings.mcp.bigmodelApiKey,
          Z_AI_MODE: this.settings.mcp.visionMode
        },
        enabled: true
      });
      this.mcpCapabilityRegistry.register({
        id: 'webSearchPrime',
        toolName: 'webSearchPrime',
        serverId: 'bigmodel-web-search',
        displayName: 'Web Search Prime',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'webReader',
        toolName: 'webReader',
        serverId: 'bigmodel-web-reader',
        displayName: 'Web Reader',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'search_doc',
        toolName: 'search_doc',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Search Doc',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'get_repo_structure',
        toolName: 'get_repo_structure',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Repo Structure',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'read_file',
        toolName: 'read_file',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Read File',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'ui_to_artifact',
        toolName: 'ui_to_artifact',
        serverId: 'bigmodel-vision',
        displayName: 'Vision UI To Artifact',
        riskLevel: 'medium',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'image_analysis',
        toolName: 'image_analysis',
        serverId: 'bigmodel-vision',
        displayName: 'Vision Image Analysis',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
      this.mcpCapabilityRegistry.register({
        id: 'ui_diff_check',
        toolName: 'ui_diff_check',
        serverId: 'bigmodel-vision',
        displayName: 'Vision UI Diff Check',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
    }
    if (this.settings.mcp.researchHttpEndpoint) {
      this.mcpServerRegistry.register({
        id: 'remote-research',
        displayName: '杩滅鐮旂┒ MCP',
        transport: 'http',
        endpoint: this.settings.mcp.researchHttpEndpoint,
        headers: this.settings.mcp.researchHttpApiKey
          ? { Authorization: `Bearer ${this.settings.mcp.researchHttpApiKey}` }
          : undefined,
        enabled: true
      });
      this.mcpCapabilityRegistry.register({
        id: 'collect_research_source',
        toolName: 'collect_research_source',
        serverId: 'remote-research',
        displayName: 'Collect research source',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge'
      });
    }
    this.mcpClientManager = new McpClientManager(
      this.mcpServerRegistry,
      this.mcpCapabilityRegistry,
      this.sandboxExecutor,
      {
        stdioMaxSessions: this.settings.mcp.stdioSessionMaxCount
      }
    );
    this.orchestrator = new AgentOrchestrator({
      memoryRepository: this.memoryRepository,
      skillRegistry: this.skillRegistry,
      approvalService: this.approvalService,
      runtimeStateRepository: this.runtimeStateRepository,
      llmProvider: this.llmProvider,
      ruleRepository: this.ruleRepository,
      sandboxExecutor: this.sandboxExecutor,
      toolRegistry: this.toolRegistry,
      mcpClientManager: this.mcpClientManager
    });
    this.sessionCoordinator = new SessionCoordinator(this.orchestrator, this.runtimeStateRepository, this.llmProvider);
  }

  async onModuleInit() {
    await this.sessionCoordinator.initialize();
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
      taskCount: tasks.length,
      activeTaskCount: activeTasks.length,
      queueDepth: tasks.filter(task => String(task.status) === 'queued').length,
      blockedRunCount: tasks.filter(task => String(task.status) === 'blocked').length,
      budgetExceededCount: tasks.filter(task => task.currentStep === 'budget_exhausted').length,
      pendingApprovalCount: pendingApprovals.length,
      sessionCount: sessions.length,
      activeSessionCount: sessions.filter(session =>
        ['running', 'waiting_approval', 'waiting_learning_confirmation'].includes(String(session.status))
      ).length,
      activeMinistries,
      activeWorkers,
      usageAnalytics,
      appliedFilters: {
        status: filters?.status,
        model: filters?.model,
        pricingSource: filters?.pricingSource
      },
      recentRuns: filteredRecentRuns
    };
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

    return Promise.all([invalidatedMemoriesPromise, invalidatedRulesPromise]).then(
      ([invalidatedMemories, invalidatedRules]) => ({
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
        candidates: learningCandidates
      })
    );
  }

  getEvidenceCenter() {
    const taskEvidence = this.orchestrator.listTasks().flatMap(task =>
      task.externalSources?.length
        ? task.externalSources.map(source => ({
            ...source,
            taskGoal: task.goal
          }))
        : task.trace.map((trace, index) => ({
            id: `${task.id}:${index}`,
            taskId: task.id,
            taskGoal: task.goal,
            sourceType: 'trace',
            sourceUrl: undefined,
            trustClass: 'internal' as const,
            summary: trace.summary,
            detail: trace.data,
            linkedRunId: task.runId,
            createdAt: trace.at
          }))
    );
    const learningEvidence = this.orchestrator.listLearningJobs().flatMap(job =>
      (job.sources ?? []).map(source => ({
        ...source,
        taskGoal: job.goal ?? job.summary ?? job.documentUri
      }))
    );
    return [...learningEvidence, ...taskEvidence];
  }

  async getConnectorsCenter() {
    await this.mcpClientManager.sweepIdleSessions(this.settings.mcp.stdioSessionIdleTtlMs);
    await this.mcpClientManager.refreshAllServerDiscovery({ includeStdio: false });
    return this.mcpClientManager.describeServers();
  }

  async closeConnectorSession(connectorId: string) {
    const closed = await this.mcpClientManager.closeServerSession(connectorId);
    return {
      connectorId,
      closed
    };
  }

  async getEvalsCenter(days = 30, filters?: { scenarioId?: string; outcome?: string }) {
    return this.summarizeAndPersistEvalHistory(this.orchestrator.listTasks(), days, filters);
  }

  async getPlatformConsole(days = 30) {
    const [skills, rules, learning] = await Promise.all([
      this.skillRegistry.list(),
      this.orchestrator.listRules(),
      this.getLearningCenter()
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
      connectors: await this.getConnectorsCenter(),
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
      const taskModels = Array.from(
        new Set(
          (task.modelRoute ?? [])
            .map(route => route.selectedModel)
            .filter((m): m is string => typeof m === 'string' && m.length > 0)
        )
      );
      const allocatedModels = taskModels.length > 0 ? taskModels : ['default'];
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
