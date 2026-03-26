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
  SubgraphId,
  WorkerDefinition
} from '@agent/shared';
import {
  MemoryRepository,
  MemorySearchService,
  PendingExecutionRecord,
  RuleRepository,
  RuntimeStateRepository
} from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import {
  ApprovalService,
  McpClientManager,
  SandboxExecutor,
  ToolRegistry,
  createDefaultToolRegistry
} from '@agent/tools';

import { createApprovalRecoveryGraph } from './recovery.graph';
import { executeApprovedAction, PendingExecutionContext } from '../flows/approval';
import {
  BingbuOpsMinistry,
  GongbuCodeMinistry,
  HubuSearchMinistry,
  LibuDocsMinistry,
  LibuRouterMinistry,
  XingbuReviewMinistry
} from '../flows/ministries';
import { buildResearchSourcePlan, mergeEvidence } from '../workflows/research-source-planner';
import { LearningFlow } from '../flows/learning';
import { createAgentGraph, createInitialState, RuntimeAgentGraphState } from './chat.graph';
import { LlmProvider } from '../adapters/llm/llm-provider';
import { buildWorkflowPresetPlan, resolveWorkflowPreset } from '../workflows/workflow-preset-registry';
import { resolveWorkflowRoute } from '../workflows/workflow-route-registry';
import { createDefaultWorkerRegistry, WorkerRegistry, WorkerSelectionConstraints } from '../governance/worker-registry';
import { ModelRoutingPolicy } from '../governance/model-routing-policy';
import { describeConnectorProfilePolicy } from '../governance/profile-policy';
import { isFreshnessSensitiveGoal } from '../shared/prompts/temporal-context';

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
}) => Promise<SkillSearchStateRecord>;

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
  private localSkillSuggestionResolver?: LocalSkillSuggestionResolver;
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
      memorySearchService: dependencies.memorySearchService,
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

  setLocalSkillSuggestionResolver(resolver?: LocalSkillSuggestionResolver) {
    this.localSkillSuggestionResolver = resolver;
  }

  private async resolveKnowledgeReuse(taskId: string, runId: string, goal: string, createdAt: string) {
    const searchResult = this.dependencies.memorySearchService
      ? await this.dependencies.memorySearchService.search(goal, 5)
      : {
          memories: await this.dependencies.memoryRepository.search(goal, 5),
          rules: []
        };

    const reusedMemoryIds = searchResult.memories.map(memory => memory.id);
    const reusedRuleIds = searchResult.rules.map(rule => rule.id);
    const evidence: EvidenceRecord[] = [
      ...searchResult.memories.map(
        (memory, index): EvidenceRecord => ({
          id: `memory_reuse_${taskId}_${index + 1}`,
          taskId,
          sourceType: 'memory_reuse',
          trustClass: 'internal',
          summary: `已命中历史记忆：${memory.summary}`,
          detail: {
            memoryId: memory.id,
            memoryType: memory.type,
            tags: memory.tags,
            qualityScore: memory.qualityScore
          },
          linkedRunId: runId,
          createdAt
        })
      ),
      ...searchResult.rules.map(
        (rule, index): EvidenceRecord => ({
          id: `rule_reuse_${taskId}_${index + 1}`,
          taskId,
          sourceType: 'rule_reuse',
          trustClass: 'internal',
          summary: `已命中历史规则：${rule.summary}`,
          detail: {
            ruleId: rule.id,
            ruleName: rule.name,
            conditions: rule.conditions
          },
          linkedRunId: runId,
          createdAt
        })
      )
    ];

    return {
      memories: searchResult.memories,
      rules: searchResult.rules,
      reusedMemoryIds,
      reusedRuleIds,
      evidence
    };
  }

  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}`;
    const runId = `run_${Date.now()}`;
    const sessionId = (dto as CreateTaskDto & { sessionId?: string }).sessionId;
    const workflowResolution = resolveWorkflowPreset(dto.goal);
    const knowledgeReuse = await this.resolveKnowledgeReuse(taskId, runId, workflowResolution.normalizedGoal, now);
    const task: TaskRecord = {
      id: taskId,
      runId,
      goal: workflowResolution.normalizedGoal,
      context: dto.context,
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
      queueState: this.createQueueState(sessionId, now),
      retryCount: 0,
      maxRetries: 1,
      reusedMemories: knowledgeReuse.reusedMemoryIds,
      reusedRules: knowledgeReuse.reusedRuleIds,
      reusedSkills: [],
      externalSources: knowledgeReuse.evidence,
      usedInstalledSkills: [],
      usedCompanyWorkers: [],
      connectorRefs: [],
      budgetState: {
        stepBudget: this.settings.policy?.budget.stepBudget ?? 8,
        stepsConsumed: 0,
        retryBudget: this.settings.policy?.budget.retryBudget ?? 1,
        retriesConsumed: 0,
        sourceBudget: this.settings.policy?.budget.sourceBudget ?? 8,
        sourcesConsumed: 0,
        costBudgetUsd: this.settings.policy?.budget.maxCostPerTaskUsd ?? 0,
        costConsumedUsd: 0,
        costConsumedCny: 0,
        fallbackModelId: this.settings.policy?.budget.fallbackModelId,
        overBudget: false
      },
      llmUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimated: false,
        measuredCallCount: 0,
        estimatedCallCount: 0,
        models: [],
        updatedAt: now
      }
    };

    if (this.localSkillSuggestionResolver) {
      const skillSearch = await this.localSkillSuggestionResolver({
        goal: workflowResolution.normalizedGoal,
        usedInstalledSkills: task.usedInstalledSkills
      });
      task.skillSearch = skillSearch;
      if (skillSearch.suggestions.length > 0) {
        task.externalSources = [
          ...(task.externalSources ?? []),
          ...skillSearch.suggestions.slice(0, 5).map(
            (suggestion, index): EvidenceRecord => ({
              id: `skill_search_${taskId}_${index + 1}`,
              taskId,
              sourceId: suggestion.sourceId,
              sourceType: 'skill_search',
              trustClass: suggestion.availability === 'blocked' ? 'community' : 'internal',
              summary: `本地技能候选：${suggestion.displayName}（${suggestion.availability}）`,
              detail: {
                kind: suggestion.kind,
                suggestionId: suggestion.id,
                availability: suggestion.availability,
                requiredCapabilities: suggestion.requiredCapabilities,
                requiredConnectors: suggestion.requiredConnectors,
                score: suggestion.score,
                reason: suggestion.reason
              },
              linkedRunId: runId,
              createdAt: now
            })
          )
        ];
      }
      if (skillSearch.capabilityGapDetected && skillSearch.suggestions.length > 0) {
        this.addTrace(
          task.trace,
          'research',
          `检测到能力缺口，已在本地技能库中找到 ${skillSearch.suggestions.length} 个候选。`,
          {
            skillSearchStatus: skillSearch.status,
            suggestionIds: skillSearch.suggestions.map(item => item.id),
            availability: skillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
          }
        );
        this.addProgressDelta(
          task,
          `首辅已识别出能力缺口，并在本地技能库中找到 ${skillSearch.suggestions.length} 个候选。`
        );
      } else if (skillSearch.suggestions.length > 0) {
        this.addTrace(
          task.trace,
          'research',
          `本地技能库已命中 ${skillSearch.suggestions.length} 个可直接参考的候选。`,
          {
            skillSearchStatus: skillSearch.status,
            suggestionIds: skillSearch.suggestions.map(item => item.id),
            availability: skillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
          }
        );
        this.addProgressDelta(task, `首辅已在本地技能库中命中 ${skillSearch.suggestions.length} 个可复用候选。`);
      }
    }

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
    this.markSubgraph(task, 'skill-install');
    this.addProgressDelta(task, `本轮已切换到 ${workflowResolution.preset.displayName} 流程。`);
    if (knowledgeReuse.reusedMemoryIds.length > 0 || knowledgeReuse.reusedRuleIds.length > 0) {
      const autoPersistedCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('auto-persist')).length;
      const researchMemoryCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('research-job')).length;
      this.addTrace(
        task.trace,
        'research',
        `首辅已优先命中 ${knowledgeReuse.reusedMemoryIds.length} 条历史记忆与 ${knowledgeReuse.reusedRuleIds.length} 条历史规则，本轮将优先复用已有经验。`,
        {
          reusedMemoryIds: knowledgeReuse.reusedMemoryIds,
          reusedRuleIds: knowledgeReuse.reusedRuleIds,
          autoPersistedCount,
          researchMemoryCount
        }
      );
      this.addProgressDelta(
        task,
        `首辅先从历史经验中命中了 ${knowledgeReuse.reusedMemoryIds.length} 条记忆和 ${knowledgeReuse.reusedRuleIds.length} 条规则，本轮会优先基于这些经验继续规划。`
      );
    }
    this.upsertFreshnessEvidence(task);
    this.tasks.set(task.id, task);
    await this.persistAndEmitTask(task);
    if (sessionId) {
      await this.runTaskPipeline(task, { ...dto, goal: workflowResolution.normalizedGoal }, { mode: 'initial' });
      return task;
    }

    this.addTrace(task.trace, 'background_queued', '后台任务已入队，等待后台 runner 消费执行。', {
      mode: 'background',
      runId: task.runId
    });
    this.markSubgraph(task, 'background-runner');
    this.addProgressDelta(task, '后台任务已入队，等待后台执行器调度。');
    await this.persistAndEmitTask(task);
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

  listWorkers() {
    return this.workerRegistry.list();
  }

  registerWorker(worker: WorkerDefinition) {
    this.workerRegistry.register(worker);
  }

  setWorkerEnabled(workerId: string, enabled: boolean) {
    this.workerRegistry.setEnabled(workerId, enabled);
  }

  isWorkerEnabled(workerId: string) {
    return this.workerRegistry.isEnabled(workerId);
  }

  listQueuedBackgroundTasks(): TaskRecord[] {
    const now = Date.now();
    return this.listTasks().filter(task => {
      const queueState = task.queueState;
      if (!queueState?.backgroundRun || queueState.status !== 'queued') {
        return false;
      }
      if (!queueState.leaseExpiresAt) {
        return true;
      }
      return new Date(queueState.leaseExpiresAt).getTime() <= now;
    });
  }

  async acquireBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'queued') {
      return undefined;
    }

    const now = new Date();
    if (task.queueState.leaseExpiresAt && new Date(task.queueState.leaseExpiresAt).getTime() > now.getTime()) {
      return undefined;
    }

    task.queueState = {
      ...task.queueState,
      leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lastHeartbeatAt: now.toISOString()
    };
    task.updatedAt = now.toISOString();
    this.addTrace(task.trace, 'background_lease_acquired', `后台 runner 已为任务获取 lease：${owner}`, {
      owner,
      ttlMs
    });
    this.markSubgraph(task, 'background-runner');
    await this.persistAndEmitTask(task);
    return task;
  }

  async heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.leaseOwner !== owner) {
      return undefined;
    }

    const now = new Date();
    task.queueState = {
      ...task.queueState,
      leaseExpiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lastHeartbeatAt: now.toISOString()
    };
    task.updatedAt = now.toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  async releaseBackgroundLease(taskId: string, owner: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.leaseOwner !== owner) {
      return undefined;
    }

    task.queueState = {
      ...task.queueState,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      lastHeartbeatAt: undefined
    };
    task.updatedAt = new Date().toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  listExpiredBackgroundLeases(): TaskRecord[] {
    const now = Date.now();
    return this.listTasks().filter(task => {
      const queueState = task.queueState;
      return Boolean(
        queueState?.backgroundRun &&
        queueState.status === 'running' &&
        queueState.leaseOwner &&
        queueState.leaseExpiresAt &&
        new Date(queueState.leaseExpiresAt).getTime() <= now
      );
    });
  }

  async reclaimExpiredBackgroundLease(taskId: string, owner: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'running') {
      return undefined;
    }

    const now = new Date();
    if (!task.queueState.leaseExpiresAt || new Date(task.queueState.leaseExpiresAt).getTime() > now.getTime()) {
      return undefined;
    }

    const retryBudget = task.budgetState?.retryBudget ?? task.maxRetries ?? 1;
    const retriesConsumed = task.budgetState?.retriesConsumed ?? task.retryCount ?? 0;
    const nextRetriesConsumed = retriesConsumed + 1;

    if (nextRetriesConsumed <= retryBudget) {
      task.status = TaskStatus.QUEUED;
      task.currentNode = 'background_requeued';
      task.currentStep = 'queued';
      task.retryCount = nextRetriesConsumed;
      task.maxRetries = Math.max(task.maxRetries ?? retryBudget, retryBudget);
      task.budgetState = this.updateBudgetState(task, {
        retryBudget,
        retriesConsumed: nextRetriesConsumed
      });
      task.queueState = {
        mode: task.queueState.mode,
        backgroundRun: true,
        status: 'queued',
        enqueuedAt: now.toISOString(),
        startedAt: undefined,
        finishedAt: undefined,
        lastTransitionAt: now.toISOString(),
        attempt: (task.queueState.attempt ?? 1) + 1,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        lastHeartbeatAt: undefined
      };
      task.updatedAt = now.toISOString();
      this.addTrace(task.trace, 'background_lease_reclaimed', `后台 lease 已过期，任务重新入队（owner: ${owner}）。`, {
        owner,
        retriesConsumed: nextRetriesConsumed,
        retryBudget
      });
      this.markSubgraph(task, 'background-runner');
      this.addProgressDelta(task, '后台执行 lease 已过期，任务已重新入队等待重试。');
      await this.persistAndEmitTask(task);
      return task;
    }

    task.status = TaskStatus.FAILED;
    task.currentNode = 'background_reclaim_failed';
    task.currentStep = 'background_runner_failed';
    task.result = '后台 lease 多次过期且已耗尽 retry budget，任务已终止。';
    task.retryCount = nextRetriesConsumed;
    task.budgetState = this.updateBudgetState(task, {
      retryBudget,
      retriesConsumed: nextRetriesConsumed
    });
    this.transitionQueueState(task, 'failed');
    task.updatedAt = now.toISOString();
    this.addTrace(
      task.trace,
      'background_lease_reclaimed',
      `后台 lease 已过期且 retry budget 已耗尽，任务终止（owner: ${owner}）。`,
      {
        owner,
        retriesConsumed: nextRetriesConsumed,
        retryBudget,
        exhausted: true
      }
    );
    this.markSubgraph(task, 'background-runner');
    this.addProgressDelta(task, '后台执行 lease 已过期，且已耗尽重试预算，任务终止。');
    await this.persistAndEmitTask(task);
    return task;
  }

  async runBackgroundTask(taskId: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'queued') {
      return undefined;
    }

    await this.runTaskPipeline(task, { goal: task.goal, constraints: [] }, { mode: 'initial' });
    return task;
  }

  async markBackgroundTaskRunnerFailure(taskId: string, reason: string): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun) {
      return undefined;
    }

    task.status = TaskStatus.FAILED;
    task.currentNode = 'background_runner_failed';
    task.currentStep = 'background_runner_failed';
    task.result = reason;
    this.transitionQueueState(task, 'failed');
    task.updatedAt = new Date().toISOString();
    this.addTrace(task.trace, 'background_runner_failed', reason);
    this.markSubgraph(task, 'background-runner');
    this.addProgressDelta(task, reason);
    await this.persistAndEmitTask(task);
    return task;
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
    task.queueState = {
      mode: task.queueState?.mode ?? (task.sessionId ? 'foreground' : 'background'),
      backgroundRun: task.queueState?.backgroundRun ?? !task.sessionId,
      status: 'queued',
      enqueuedAt: new Date().toISOString(),
      startedAt: undefined,
      finishedAt: undefined,
      lastTransitionAt: new Date().toISOString(),
      attempt: (task.queueState?.attempt ?? 1) + 1
    };
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
    this.transitionQueueState(task, 'cancelled');
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
      this.transitionQueueState(task, 'blocked');
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
      this.transitionQueueState(task, 'running');
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

  async createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    const now = new Date().toISOString();
    const jobId = `learn_${Date.now()}`;
    const workflowResolution = resolveWorkflowPreset(
      dto.workflowId ? `${dto.workflowId} ${dto.goal}`.trim() : dto.goal
    );
    const sources = buildResearchSourcePlan({
      taskId: jobId,
      runId: undefined,
      goal: workflowResolution.normalizedGoal,
      workflow: workflowResolution.preset,
      runtimeSourcePolicyMode: this.settings.policy?.sourcePolicyMode,
      preferredUrls: dto.preferredUrls,
      createdAt: now
    });
    const collectedSources = await Promise.all(
      sources.map(async source => {
        const capabilityId = this.selectResearchCapability(source);
        const result = capabilityId
          ? await this.dependencies.mcpClientManager?.invokeCapability(capabilityId, {
              taskId: jobId,
              toolName: capabilityId,
              intent: ActionIntent.CALL_EXTERNAL_API,
              requestedBy: 'agent',
              input: this.buildResearchCapabilityInput(capabilityId, source, workflowResolution.normalizedGoal)
            })
          : undefined;
        return {
          ...source,
          detail:
            result?.ok && result.rawOutput && typeof result.rawOutput === 'object'
              ? {
                  capabilityId,
                  selectedCapabilityId: result.capabilityId,
                  serverId: result.serverId,
                  transportUsed: result.transportUsed,
                  fallbackUsed: result.fallbackUsed,
                  ...(result.rawOutput as Record<string, unknown>)
                }
              : {
                  capabilityId,
                  selectedCapabilityId: result?.capabilityId,
                  serverId: result?.serverId,
                  transportUsed: result?.transportUsed,
                  fallbackUsed: result?.fallbackUsed,
                  error: result?.errorMessage ?? 'mcp_collect_failed',
                  outputSummary: result?.outputSummary
                }
        };
      })
    );
    const trustSummary = sources.reduce<Partial<Record<EvidenceRecord['trustClass'], number>>>((summary, source) => {
      summary[source.trustClass] = (summary[source.trustClass] ?? 0) + 1;
      return summary;
    }, {});
    const learningEvaluation = this.learningFlow.evaluateResearchJob({
      id: jobId,
      sourceType: 'research',
      status: 'completed',
      documentUri: dto.goal,
      goal: workflowResolution.normalizedGoal,
      workflowId: workflowResolution.preset.id,
      sources: collectedSources,
      trustSummary,
      createdAt: now,
      updatedAt: now
    });
    const job: LearningJob = {
      id: jobId,
      sourceType: 'research',
      status: 'completed',
      documentUri: dto.goal,
      goal: workflowResolution.normalizedGoal,
      workflowId: workflowResolution.preset.id,
      summary:
        dto.title ??
        `户部已为“${workflowResolution.normalizedGoal}”整理并抓取 ${collectedSources.length} 个优先研究来源，默认按 ${
          this.settings.policy?.sourcePolicyMode ?? workflowResolution.preset.sourcePolicy?.mode ?? 'controlled-first'
        } 策略执行。`,
      sources: collectedSources,
      trustSummary,
      learningEvaluation,
      createdAt: now,
      updatedAt: now
    };
    await this.learningFlow.autoPersistResearchMemory(
      job,
      workflowResolution.preset.autoPersistPolicy?.memory ?? 'manual'
    );
    this.learningJobs.set(job.id, job);
    await this.persistRuntimeState();
    return job;
  }

  private selectResearchCapability(source: EvidenceRecord): string {
    const manager = this.dependencies.mcpClientManager;
    const sourceUrl = source.sourceUrl?.toLowerCase();

    if (sourceUrl?.includes('github.com') && manager?.hasCapability('search_doc')) {
      return 'search_doc';
    }
    if (sourceUrl && manager?.hasCapability('webReader')) {
      return 'webReader';
    }
    if (manager?.hasCapability('webSearchPrime')) {
      return 'webSearchPrime';
    }
    return 'collect_research_source';
  }

  private buildResearchCapabilityInput(
    capabilityId: string,
    source: EvidenceRecord,
    goal: string
  ): Record<string, unknown> {
    switch (capabilityId) {
      case 'search_doc':
        return {
          repoUrl: source.sourceUrl,
          query: goal
        };
      case 'webReader':
        return {
          url: source.sourceUrl,
          goal
        };
      case 'webSearchPrime':
        return {
          query: source.sourceUrl ? `${goal} site:${new URL(source.sourceUrl).hostname}` : goal
        };
      default:
        return {
          url: source.sourceUrl,
          goal,
          trustClass: source.trustClass,
          sourceType: source.sourceType
        };
    }
  }

  private buildFreshnessSourceSummary(task: TaskRecord): string | undefined {
    if (!isFreshnessSensitiveGoal(task.goal)) {
      return undefined;
    }
    const sources = (task.externalSources ?? []).filter(source => source.sourceType !== 'freshness_meta');
    if (!sources.length) {
      return '本轮未记录到可用来源，请在答复中明确说明时效性信息仍需进一步检索确认。';
    }
    const officialCount = sources.filter(source => source.trustClass === 'official').length;
    const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
    const sourceTypes = Array.from(new Set(sources.map(source => source.sourceType))).slice(0, 4);
    return [
      `本轮共参考 ${sources.length} 条来源`,
      `官方来源 ${officialCount} 条`,
      curatedCount > 0 ? `策展来源 ${curatedCount} 条` : '',
      sourceTypes.length ? `来源类型：${sourceTypes.join('、')}` : ''
    ]
      .filter(Boolean)
      .join('；');
  }

  private upsertFreshnessEvidence(task: TaskRecord): void {
    const sources = (task.externalSources ?? []).filter(source => source.sourceType !== 'freshness_meta');
    if (!isFreshnessSensitiveGoal(task.goal)) {
      task.externalSources = sources;
      return;
    }

    const referenceTime = task.updatedAt ?? task.createdAt ?? new Date().toISOString();
    const referenceDate = referenceTime.slice(0, 10);
    const officialCount = sources.filter(source => source.trustClass === 'official').length;
    const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
    const sourceTypes = Array.from(new Set(sources.map(source => source.sourceType))).slice(0, 6);
    const sourceSummary = this.buildFreshnessSourceSummary({
      ...task,
      externalSources: sources
    });

    task.externalSources = [
      ...sources,
      {
        id: `${task.id}:freshness_meta`,
        taskId: task.id,
        sourceType: 'freshness_meta',
        trustClass: 'internal',
        summary: [`信息基准日期：${referenceDate}`, sourceSummary].filter(Boolean).join('；'),
        detail: {
          freshnessSensitive: true,
          referenceDate,
          referenceTime,
          sourceCount: sources.length,
          officialCount,
          curatedCount,
          sourceTypes
        },
        linkedRunId: task.runId,
        createdAt: task.createdAt,
        fetchedAt: referenceTime
      }
    ];
  }

  getLearningJob(jobId: string): LearningJob | undefined {
    return this.learningJobs.get(jobId);
  }

  listLearningJobs(): LearningJob[] {
    return [...this.learningJobs.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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
    this.upsertFreshnessEvidence(task);
    await this.persistRuntimeState();
    this.emitTaskUpdate(task);
  }

  private async runTaskPipeline(
    task: TaskRecord,
    dto: CreateTaskDto,
    options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext }
  ): Promise<void> {
    task.status = TaskStatus.RUNNING;
    this.transitionQueueState(task, 'running');
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

    const libu = new LibuRouterMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));
    const hubu = new HubuSearchMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));
    const gongbu = new GongbuCodeMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));
    const bingbu = new BingbuOpsMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));
    const xingbu = new XingbuReviewMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));
    const libuDocs = new LibuDocsMinistry(this.createAgentContext(task.id, dto.goal, 'chat'));

    try {
      this.ensureTaskNotCancelled(task);
      const workflowRoute = this.resolveTaskFlow(task, dto.goal, options.mode);
      task.chatRoute = workflowRoute;
      this.addTrace(task.trace, 'route', `聊天入口已选择 ${workflowRoute.flow} 流程。`, {
        adapter: workflowRoute.adapter,
        priority: workflowRoute.priority,
        reason: workflowRoute.reason,
        flow: workflowRoute.flow,
        graph: workflowRoute.graph
      });
      await this.persistAndEmitTask(task);

      if (workflowRoute.flow === 'direct-reply') {
        await this.runDirectReplyTask(task, libu);
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
          this.markWorkerUsage(task, task.currentWorker);
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
            : await libu.plan();
          task.plan = plan;
          task.review = undefined;
          task.skillStage = 'ministry_execution';
          task.currentNode = 'supervisor_plan';
          this.syncTaskRuntime(task, {
            currentStep: 'manager_plan',
            retryCount: state.retryCount,
            maxRetries: state.maxRetries
          });
          this.upsertAgentState(task, libu.getState());
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
            dispatches: libu.dispatch(plan),
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
          this.markSubgraph(task, 'research');
          const researchMinistry = this.resolveResearchMinistry(task.resolvedWorkflow);
          task.currentMinistry = researchMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === researchMinistry)?.workerId;
          this.markWorkerUsage(task, task.currentWorker);
          const researchSources = buildResearchSourcePlan({
            taskId: task.id,
            runId: task.runId,
            goal: task.goal,
            workflow: task.resolvedWorkflow,
            runtimeSourcePolicyMode: this.settings.policy?.sourcePolicyMode
          });
          const remainingSourceBudget = Math.max(
            0,
            (task.budgetState?.sourceBudget ?? 0) - (task.budgetState?.sourcesConsumed ?? 0)
          );
          const budgetedResearchSources = researchSources.slice(0, remainingSourceBudget);
          if (researchSources.length > budgetedResearchSources.length) {
            this.addTrace(task.trace, 'budget_exhausted', '户部研究来源已按 source budget 裁剪。', {
              sourceBudget: task.budgetState?.sourceBudget,
              sourcesConsumed: task.budgetState?.sourcesConsumed,
              requestedSources: researchSources.length,
              allowedSources: budgetedResearchSources.length
            });
          }
          task.budgetState = this.updateBudgetState(task, {
            sourcesConsumed: (task.budgetState?.sourcesConsumed ?? 0) + budgetedResearchSources.length
          });
          if (budgetedResearchSources.length) {
            task.externalSources = mergeEvidence(task.externalSources ?? [], budgetedResearchSources);
            for (const source of budgetedResearchSources) {
              this.addTrace(task.trace, 'research', `户部已锁定研究来源：${source.summary}`, {
                ministry: researchMinistry,
                sourceUrl: source.sourceUrl,
                sourceType: source.sourceType,
                trustClass: source.trustClass
              });
            }
          }
          this.addTrace(task.trace, 'ministry_started', '户部开始检索上下文与资料。', {
            ministry: task.currentMinistry,
            workerId: task.currentWorker
          });
          this.addProgressDelta(task, `户部已开始检索资料与上下文。`, AgentRole.RESEARCH);
          this.setSubTaskStatus(task, AgentRole.RESEARCH, 'running');
          const researchResult =
            researchMinistry === 'libu-docs'
              ? await libuDocs.research(task)
              : await hubu.research(state.dispatches[0]?.objective ?? 'Research shared memory and skills');
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, researchMinistry === 'libu-docs' ? libuDocs.getState() : hubu.getState());
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
          this.markSubgraph(task, 'execution');
          const executionMinistry = this.resolveExecutionMinistry(task.resolvedWorkflow);
          task.currentMinistry = executionMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === executionMinistry)?.workerId;
          this.markWorkerUsage(task, task.currentWorker);
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

          const executionMinistryRunner = executionMinistry === 'bingbu-ops' ? bingbu : gongbu;

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
              gongbu.buildApprovedState(approvedResult, {
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
              serverId: approvedResult.serverId,
              capabilityId: approvedResult.capabilityId,
              transportUsed: approvedResult.transportUsed,
              fallbackUsed: approvedResult.fallbackUsed,
              exitCode: approvedResult.exitCode,
              ...(approvedResult.rawOutput && typeof approvedResult.rawOutput === 'object'
                ? (approvedResult.rawOutput as Record<string, unknown>)
                : {})
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
              ? await libuDocs.execute(task, state.executionSummary ?? state.researchSummary ?? '')
              : await executionMinistryRunner.execute(
                  state.dispatches[1]?.objective ??
                    (executionMinistry === 'bingbu-ops'
                      ? 'Run controlled ops and validation tasks'
                      : 'Execute the candidate action'),
                  state.researchSummary ?? 'No research summary available.'
                );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(
            task,
            executionMinistry === 'libu-docs' ? libuDocs.getState() : executionMinistryRunner.getState()
          );
          this.addMessage(task, 'execution_result', execution.summary, AgentRole.EXECUTOR);
          this.addTrace(task.trace, 'execute', execution.summary, {
            ministry: task.currentMinistry,
            intent: execution.intent,
            toolName: execution.toolName,
            requiresApproval: execution.requiresApproval,
            llmConfigured: this.llm.isConfigured(),
            retryCount: state.retryCount,
            serverId: execution.executionResult?.serverId,
            capabilityId: execution.executionResult?.capabilityId,
            transportUsed: execution.executionResult?.transportUsed,
            fallbackUsed: execution.executionResult?.fallbackUsed,
            ...(execution.executionResult?.rawOutput && typeof execution.executionResult.rawOutput === 'object'
              ? (execution.executionResult.rawOutput as Record<string, unknown>)
              : {})
          });
          this.addProgressDelta(task, `执行进展：${execution.summary}`, AgentRole.EXECUTOR);

          if (execution.requiresApproval) {
            const approvalReason = `准备使用 ${execution.toolName} 执行 ${this.describeActionIntent(execution.intent)}，该动作会影响外部环境，因此需要人工审批。`;
            task.status = TaskStatus.WAITING_APPROVAL;
            this.transitionQueueState(task, 'waiting_approval');
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
          this.markSubgraph(task, 'review');
          task.currentNode = 'review_and_govern';
          const reviewMinistry = this.resolveReviewMinistry(task.resolvedWorkflow);
          task.currentMinistry = reviewMinistry;
          task.currentWorker = task.modelRoute?.find(item => item.ministry === reviewMinistry)?.workerId;
          this.markWorkerUsage(task, task.currentWorker);
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
              ? libuDocs.review(task, state.executionSummary ?? task.result ?? 'No execution summary available.')
              : await this.reviewExecution(
                  task,
                  xingbu,
                  state.executionResult,
                  state.executionSummary ?? task.result ?? 'No execution summary available.'
                );
          this.ensureTaskNotCancelled(task);

          if (reviewed.evaluation.shouldRetry && state.retryCount < state.maxRetries) {
            task.status = TaskStatus.RUNNING;
            this.transitionQueueState(task, 'running');
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
            ? libuDocs.buildDelivery(task, state.executionSummary ?? task.result ?? 'No execution summary available.')
            : undefined;
          if (docsSummary) {
            this.addTrace(task.trace, 'ministry_reported', docsSummary, {
              ministry: 'libu-docs'
            });
            this.addMessage(task, 'review_result', docsSummary, AgentRole.REVIEWER);
            this.addProgressDelta(task, docsSummary, AgentRole.REVIEWER);
          }
          const finalAnswer = await libu.finalize(
            reviewed.review,
            docsSummary
              ? `${state.executionSummary ?? task.result ?? ''}\n${docsSummary}`
              : (state.executionSummary ?? task.result ?? 'No execution summary available.'),
            this.buildFreshnessSourceSummary(task)
          );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, libu.getState());
          this.addMessage(task, 'summary', finalAnswer, AgentRole.MANAGER);
          this.addTrace(task.trace, 'finish', finalAnswer);

          task.result = finalAnswer;
          task.status = reviewed.review.decision === 'approved' ? TaskStatus.COMPLETED : TaskStatus.FAILED;
          this.transitionQueueState(task, reviewed.review.decision === 'approved' ? 'completed' : 'failed');
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

      await graph.invoke(this.createGraphStartState(task, dto, libu, options));
      await this.persistAndEmitTask(task);
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        await this.persistAndEmitTask(task);
        return;
      }
      if (error instanceof TaskBudgetExceededError) {
        task.status = TaskStatus.BLOCKED;
        this.transitionQueueState(task, 'blocked');
        task.currentNode = 'budget_governance';
        task.currentStep = 'budget_exhausted';
        task.result = error.message;
        task.updatedAt = new Date().toISOString();
        this.addTrace(task.trace, 'budget_exhausted', error.message, error.detail);
        this.addProgressDelta(task, error.message);
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
    this.transitionQueueState(task, 'running');
    task.currentNode = 'resume_after_approval';
    task.updatedAt = new Date().toISOString();
    this.addTrace(task.trace, 'run_resumed', '皇帝已批准高风险动作，流程恢复执行。', {
      runId: task.runId
    });
    await this.persistAndEmitTask(task);

    const gongbu = new GongbuCodeMinistry(this.createAgentContext(task.id, dto.goal, 'approval'));
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
          this.upsertAgentState(task, gongbu.buildApprovedState(executionResult, state.pending));
          this.addMessage(task, 'execution_result', executionResult.outputSummary, AgentRole.EXECUTOR);
          this.addTrace(task.trace, 'execute', executionResult.outputSummary, {
            ministry: 'gongbu-code',
            intent: state.pending.intent,
            toolName: state.pending.toolName,
            approved: true,
            serverId: executionResult.serverId,
            capabilityId: executionResult.capabilityId,
            transportUsed: executionResult.transportUsed,
            fallbackUsed: executionResult.fallbackUsed,
            exitCode: executionResult.exitCode,
            ...(executionResult.rawOutput && typeof executionResult.rawOutput === 'object'
              ? (executionResult.rawOutput as Record<string, unknown>)
              : {})
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
    libu: LibuRouterMinistry,
    options: { mode: 'initial' | 'retry' | 'approval_resume'; pending?: PendingExecutionContext }
  ): RuntimeAgentGraphState {
    const base = createInitialState(task.id, dto.goal, dto.context);

    if (options.mode !== 'approval_resume' || !options.pending) {
      return base;
    }

    return {
      ...base,
      currentPlan: task.plan?.steps ?? [],
      dispatches: task.plan ? libu.dispatch(task.plan) : [],
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
    xingbu: XingbuReviewMinistry,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ): Promise<{ review: ReviewRecord; evaluation: EvaluationResult }> {
    this.setSubTaskStatus(task, AgentRole.REVIEWER, 'running');
    const reviewed = await xingbu.review(executionResult, executionSummary);
    task.review = reviewed.review;
    this.upsertAgentState(task, xingbu.getState());
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

  private markWorkerUsage(task: TaskRecord, workerId?: string) {
    if (!workerId) {
      return;
    }

    const worker = this.workerRegistry.get(workerId);
    if (!worker) {
      return;
    }

    task.connectorRefs = Array.from(new Set([...(task.connectorRefs ?? []), ...(worker.requiredConnectors ?? [])]));
    if (worker.kind === 'company') {
      task.usedCompanyWorkers = Array.from(new Set([...(task.usedCompanyWorkers ?? []), workerId]));
    }
    if (worker.kind === 'installed-skill') {
      task.usedInstalledSkills = Array.from(new Set([...(task.usedInstalledSkills ?? []), workerId]));
    }
  }

  private markSubgraph(task: TaskRecord, subgraphId: SubgraphId) {
    task.subgraphTrail = Array.from(new Set([...(task.subgraphTrail ?? []), subgraphId]));
  }

  private shouldRunLibuDocsDelivery(workflow?: WorkflowPresetDefinition): boolean {
    return Boolean(workflow?.requiredMinistries.includes('libu-docs'));
  }

  private resolveTaskFlow(task: TaskRecord, goal: string, mode: 'initial' | 'retry' | 'approval_resume') {
    if (mode === 'approval_resume') {
      return {
        graph: 'approval-recovery' as const,
        flow: 'approval' as const,
        reason: 'approval_resume',
        adapter: 'approval-recovery' as const,
        priority: 95
      };
    }

    return resolveWorkflowRoute({
      goal,
      workflow: task.resolvedWorkflow
    });
  }

  private async runDirectReplyTask(task: TaskRecord, libu: LibuRouterMinistry): Promise<void> {
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
    const answer = await libu.replyDirectly();
    this.upsertAgentState(task, libu.getState());
    const directReplyFallbackNotes = libu
      .getState()
      .observations.filter(note => note.startsWith('LLM '))
      .slice(-3);
    if (directReplyFallbackNotes.length > 0) {
      this.addTrace(
        task.trace,
        'direct_reply_fallback',
        '首辅直答未获得模型正常输出，已回退到本地兜底回复。',
        {
          notes: directReplyFallbackNotes
        },
        task
      );
    }
    task.result = answer;
    task.status = TaskStatus.COMPLETED;
    this.transitionQueueState(task, 'completed');
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
    const resolveTask = () => this.tasks.get(taskId);
    const workerRegistry = this.workerRegistry;
    const context = {
      taskId,
      goal,
      flow,
      memoryRepository: this.dependencies.memoryRepository,
      ruleRepository: this.dependencies.ruleRepository,
      runtimeStateRepository: this.dependencies.runtimeStateRepository,
      skillRegistry: this.dependencies.skillRegistry,
      approvalService: this.dependencies.approvalService,
      toolRegistry: this.toolRegistry,
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
      },
      onUsage: (payload: {
        usage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
          model?: string;
          estimated?: boolean;
        };
        role: 'manager' | 'research' | 'executor' | 'reviewer';
      }) => {
        this.recordTaskUsage(taskId, payload.usage);
      }
    };
    return {
      ...context,
      memorySearchService: this.dependencies.memorySearchService,
      get workflowPreset() {
        return resolveTask()?.resolvedWorkflow;
      },
      get taskContext() {
        return resolveTask()?.context;
      },
      get budgetState() {
        return resolveTask()?.budgetState;
      },
      contextStrategy: this.settings.contextStrategy,
      get currentWorker() {
        const workerId = resolveTask()?.currentWorker;
        return workerId ? workerRegistry.get(workerId) : undefined;
      }
    };
  }

  private recordTaskUsage(
    taskId: string,
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      model?: string;
      estimated?: boolean;
      costUsd?: number;
      costCny?: number;
    }
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    const current = task.llmUsage ?? createEmptyUsageRecord(new Date().toISOString());
    const model = usage.model ?? 'unknown';
    const costUsd = usage.costUsd ?? estimateModelCostUsd(model, usage.totalTokens);
    const costCny = usage.costCny ?? costUsd * 7.2;
    const pricingSource = usage.costUsd != null || usage.costCny != null ? 'provider' : 'estimated';
    const modelEntry = current.models.find(item => item.model === model);

    current.promptTokens += usage.promptTokens;
    current.completionTokens += usage.completionTokens;
    current.totalTokens += usage.totalTokens;
    if (usage.estimated) {
      current.estimatedCallCount += 1;
    } else {
      current.measuredCallCount += 1;
    }
    current.estimated = current.measuredCallCount === 0;
    current.updatedAt = new Date().toISOString();

    if (modelEntry) {
      modelEntry.promptTokens += usage.promptTokens;
      modelEntry.completionTokens += usage.completionTokens;
      modelEntry.totalTokens += usage.totalTokens;
      modelEntry.callCount += 1;
      modelEntry.costUsd = roundUsageCost((modelEntry.costUsd ?? 0) + costUsd);
      modelEntry.costCny = roundUsageCost((modelEntry.costCny ?? 0) + costCny);
      modelEntry.pricingSource =
        pricingSource === 'provider' || modelEntry.pricingSource === 'provider' ? 'provider' : 'estimated';
    } else {
      current.models.push({
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUsd: roundUsageCost(costUsd),
        costCny: roundUsageCost(costCny),
        pricingSource,
        callCount: 1
      });
    }

    task.llmUsage = {
      ...current,
      models: current.models.sort((left, right) => right.totalTokens - left.totalTokens)
    };
    task.budgetState = this.updateBudgetState(task, {
      costConsumedUsd: roundUsageCost((task.budgetState?.costConsumedUsd ?? 0) + costUsd),
      costConsumedCny: roundUsageCost((task.budgetState?.costConsumedCny ?? 0) + costCny)
    });
    void this.persistAndEmitTask(task);
  }

  private resolveWorkflowRoutes(workflow?: WorkflowPresetDefinition): ModelRouteDecision[] {
    const ministries = workflow?.requiredMinistries ?? ['libu-router', 'hubu-search', 'gongbu-code', 'xingbu-review'];
    const selectionConstraints = this.buildWorkerSelectionConstraints();
    const routes = ministries
      .map(ministry =>
        this.modelRoutingPolicy.resolveRoute(
          ministry,
          workflow?.displayName ?? 'general workflow',
          selectionConstraints
        )
      )
      .filter((item): item is ModelRouteDecision => Boolean(item));

    const hasRouter = routes.some(item => item.ministry === 'libu-router');
    if (!hasRouter) {
      const routerRoute = this.modelRoutingPolicy.resolveRoute(
        'libu-router',
        workflow?.displayName ?? 'general workflow',
        selectionConstraints
      );
      if (routerRoute) {
        routes.unshift(routerRoute);
      }
    }
    return routes;
  }

  private buildWorkerSelectionConstraints(): WorkerSelectionConstraints {
    const disallowedConnectorIds = this.dependencies.mcpClientManager
      ? this.dependencies.mcpClientManager
          .describeServers()
          .filter(
            (server: { id: string }) =>
              !describeConnectorProfilePolicy(server.id, this.settings.profile).enabledByProfile
          )
          .map((server: { id: string }) => server.id)
      : [];

    return {
      profile: this.settings.profile,
      disallowedConnectorIds
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
    const stepsConsumed = Math.max(task.budgetState?.stepsConsumed ?? 0, this.estimateStepsConsumed(state.currentStep));
    task.budgetState = this.updateBudgetState(task, {
      stepsConsumed,
      retryBudget: task.budgetState?.retryBudget ?? state.maxRetries,
      retriesConsumed: state.retryCount
    });
    if (stepsConsumed > (task.budgetState.stepBudget ?? 8)) {
      throw new TaskBudgetExceededError(
        `当前任务已耗尽 step budget，已在 ${state.currentStep ?? 'unknown'} 阶段暂停。`,
        {
          stepBudget: task.budgetState.stepBudget,
          stepsConsumed,
          currentStep: state.currentStep
        }
      );
    }
    task.updatedAt = new Date().toISOString();
    this.emitTaskUpdate(task);
  }

  private updateBudgetState(
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ): NonNullable<TaskRecord['budgetState']> {
    const nextBudget = {
      stepBudget: task.budgetState?.stepBudget ?? this.settings.policy?.budget.stepBudget ?? 8,
      stepsConsumed: task.budgetState?.stepsConsumed ?? 0,
      retryBudget: task.budgetState?.retryBudget ?? this.settings.policy?.budget.retryBudget ?? 1,
      retriesConsumed: task.budgetState?.retriesConsumed ?? 0,
      sourceBudget: task.budgetState?.sourceBudget ?? this.settings.policy?.budget.sourceBudget ?? 8,
      sourcesConsumed: task.budgetState?.sourcesConsumed ?? 0,
      costBudgetUsd: task.budgetState?.costBudgetUsd ?? this.settings.policy?.budget.maxCostPerTaskUsd ?? 0,
      costConsumedUsd: task.budgetState?.costConsumedUsd ?? 0,
      costConsumedCny: task.budgetState?.costConsumedCny ?? 0,
      fallbackModelId: task.budgetState?.fallbackModelId ?? this.settings.policy?.budget.fallbackModelId,
      overBudget: task.budgetState?.overBudget ?? false,
      ...overrides
    };
    nextBudget.overBudget =
      nextBudget.overBudget ||
      (nextBudget.costConsumedUsd ?? 0) >= (nextBudget.costBudgetUsd ?? Number.POSITIVE_INFINITY);
    return nextBudget;
  }

  private createQueueState(sessionId: string | undefined, now: string): QueueStateRecord {
    return {
      mode: sessionId ? 'foreground' : 'background',
      backgroundRun: !sessionId,
      status: 'queued',
      enqueuedAt: now,
      lastTransitionAt: now,
      attempt: 1
    };
  }

  private transitionQueueState(task: TaskRecord, status: QueueStateRecord['status']): void {
    const now = new Date().toISOString();
    const previous = task.queueState ?? this.createQueueState(task.sessionId, now);
    const shouldReleaseLease = status !== 'queued' && status !== 'running';
    task.queueState = {
      ...previous,
      status,
      lastTransitionAt: now,
      startedAt: status === 'running' ? (previous.startedAt ?? now) : previous.startedAt,
      finishedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now : previous.finishedAt,
      leaseOwner: shouldReleaseLease ? undefined : previous.leaseOwner,
      leaseExpiresAt: shouldReleaseLease ? undefined : previous.leaseExpiresAt,
      lastHeartbeatAt: shouldReleaseLease ? undefined : previous.lastHeartbeatAt
    };
  }

  private estimateStepsConsumed(currentStep?: string): number {
    switch (currentStep) {
      case 'manager_plan':
        return 1;
      case 'research':
        return 2;
      case 'execute':
        return 3;
      case 'review':
        return 4;
      default:
        return 0;
    }
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

class TaskBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
  }
}

function createEmptyUsageRecord(now: string): LlmUsageRecord {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimated: false,
    measuredCallCount: 0,
    estimatedCallCount: 0,
    models: [],
    updatedAt: now
  };
}

function estimateModelCostUsd(model: string, totalTokens: number): number {
  const normalized = model.toLowerCase();
  const rate = normalized.includes('glm-5')
    ? 0.002
    : normalized.includes('glm-4.7-flash')
      ? 0.0005
      : normalized.includes('glm-4.7')
        ? 0.001
        : normalized.includes('glm-4.6')
          ? 0.0012
          : 0.001;
  return (Math.max(totalTokens, 0) / 1000) * rate;
}

function roundUsageCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}
