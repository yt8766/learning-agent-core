import { loadSettings } from '@agent/config';
import { AgentRole, LlmUsageRecord, TaskRecord } from '@agent/shared';
import {
  MemoryRepository,
  MemorySearchService,
  NullVectorIndexRepository,
  RuleRepository,
  RuntimeStateRepository
} from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, McpClientManager, SandboxExecutor, ToolRegistry } from '@agent/tools';

import { LlmProvider } from '../../../adapters/llm/llm-provider';
import { WorkerRegistry } from '../../../governance/worker-registry';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { LocalKnowledgeSearchService } from '../../../runtime/local-knowledge-search-service';

interface MainGraphTaskContextDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  knowledgeSearchService?: LocalKnowledgeSearchService;
  ruleRepository: RuleRepository;
  runtimeStateRepository: RuntimeStateRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  sandboxExecutor: SandboxExecutor;
  mcpClientManager?: McpClientManager;
}

type RuntimeSettings = ReturnType<typeof loadSettings> & {
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
};

export class MainGraphTaskContextRuntime {
  private readonly knowledgeSearchService: LocalKnowledgeSearchService;

  constructor(
    private readonly dependencies: MainGraphTaskContextDependencies,
    private readonly settings: RuntimeSettings,
    private readonly llm: LlmProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly workerRegistry: WorkerRegistry,
    private readonly tasks: Map<string, TaskRecord>,
    private readonly addTrace: (
      task: TaskRecord,
      node: string,
      summary: string,
      data?: Record<string, unknown>
    ) => void,
    private readonly updateBudgetState: (
      task: TaskRecord,
      overrides: Partial<NonNullable<TaskRecord['budgetState']>>
    ) => NonNullable<TaskRecord['budgetState']>,
    private readonly emitToken: (payload: {
      taskId: string;
      role: AgentRole;
      messageId: string;
      token: string;
      model?: string;
      createdAt: string;
    }) => void,
    private readonly persistAndEmitTask: (task: TaskRecord) => Promise<void>
  ) {
    this.knowledgeSearchService =
      this.dependencies.knowledgeSearchService ??
      new LocalKnowledgeSearchService(settings, new NullVectorIndexRepository());
  }

  createAgentContext(taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') {
    const resolveTask = () => this.tasks.get(taskId);
    const workerRegistry = this.workerRegistry;
    return {
      taskId,
      goal,
      flow,
      get executionMode() {
        const task = resolveTask();
        return resolveExecutionMode(task);
      },
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
      memorySearchService: this.dependencies.memorySearchService,
      knowledgeSearchService: this.knowledgeSearchService,
      contextStrategy: this.settings.contextStrategy,
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
      },
      onModelEvent: (payload: {
        role: 'manager' | 'research' | 'executor' | 'reviewer';
        modelUsed?: string;
        isFallback?: boolean;
        fallbackReason?: string;
        status: 'fallback' | 'failed';
      }) => {
        const task = resolveTask();
        if (!task) {
          return;
        }
        this.addTrace(
          task,
          'llm_fallback',
          payload.status === 'fallback'
            ? `LLM 已切换到备用模型 ${payload.modelUsed ?? 'unknown'}。`
            : `LLM 备用模型 ${payload.modelUsed ?? 'unknown'} 仍未恢复成功。`,
          {
            role: 'ministry',
            specialistId: task.specialistLead?.id,
            modelUsed: payload.modelUsed,
            isFallback: payload.isFallback,
            fallbackReason: payload.fallbackReason,
            status: payload.status === 'failed' ? 'failed' : 'running'
          }
        );
      },
      isTaskCancelled: () => resolveTask()?.status === 'cancelled',
      onContextCompaction: async (
        payload: NonNullable<Parameters<NonNullable<AgentRuntimeContext['onContextCompaction']>>[0]>
      ) => {
        const task = resolveTask();
        if (!task) {
          return;
        }
        const result = payload.result as typeof payload.result &
          Partial<{
            historyTraceCount: number;
            evidenceCount: number;
            specialistCount: number;
            ministryCount: number;
          }>;
        task.contextFilterState = {
          ...(task.contextFilterState ?? {
            node: 'context_filter',
            status: 'completed',
            filteredContextSlice: {
              summary: payload.result.summary,
              historyTraceCount: Math.min(task.trace.length, 12),
              evidenceCount: task.externalSources?.length ?? 0,
              specialistCount: [task.specialistLead, ...(task.supportingSpecialists ?? [])].filter(Boolean).length,
              ministryCount: Array.from(new Set((task.modelRoute ?? []).map(item => item.ministry))).length
            },
            audienceSlices: undefined,
            dispatchOrder: [],
            noiseGuards: [],
            hiddenTraceCount: 0,
            redactedKeys: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }),
          filteredContextSlice: {
            ...task.contextFilterState?.filteredContextSlice,
            ...result,
            historyTraceCount:
              result.historyTraceCount ?? task.contextFilterState?.filteredContextSlice?.historyTraceCount ?? 0,
            evidenceCount: result.evidenceCount ?? task.contextFilterState?.filteredContextSlice?.evidenceCount ?? 0,
            specialistCount:
              result.specialistCount ?? task.contextFilterState?.filteredContextSlice?.specialistCount ?? 0,
            ministryCount: result.ministryCount ?? task.contextFilterState?.filteredContextSlice?.ministryCount ?? 0
          },
          updatedAt: new Date().toISOString()
        };
        this.addTrace(task, 'context_compaction_retried', '运行时模型上下文过大，已透明触发应急压缩重试。', {
          trigger: payload.trigger,
          reactiveRetryCount: payload.result.reactiveRetryCount,
          stage: 'runtime',
          pipelineAudit: payload.result.pipelineAudit
        });
        await this.persistAndEmitTask(task);
      },
      get workflowPreset() {
        return resolveTask()?.resolvedWorkflow;
      },
      get taskContext() {
        return resolveTask()?.context;
      },
      get budgetState() {
        return resolveTask()?.budgetState;
      },
      get externalSources() {
        return resolveTask()?.externalSources;
      },
      get currentWorker() {
        const workerId = resolveTask()?.currentWorker;
        return workerId ? workerRegistry.get(workerId) : undefined;
      },
      get compiledSkill() {
        const task = resolveTask();
        const attachment = task ? resolveCompiledSkillAttachment(task) : undefined;
        if (!attachment) {
          return undefined;
        }
        return {
          id: attachment.sourceId ?? attachment.id,
          name: attachment.displayName,
          description: attachment.displayName,
          steps:
            attachment.metadata?.steps?.map(step => ({
              title: step.title,
              instruction: step.instruction,
              toolNames: step.toolNames ?? []
            })) ?? [],
          constraints: [],
          successSignals: [],
          requiredTools: attachment.metadata?.requiredTools ?? [],
          requiredConnectors: attachment.metadata?.requiredConnectors ?? [],
          approvalSensitiveTools: attachment.metadata?.approvalSensitiveTools ?? []
        };
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
      tokenConsumed: (task.budgetState?.tokenConsumed ?? 0) + usage.totalTokens,
      costConsumedUsd: roundUsageCost((task.budgetState?.costConsumedUsd ?? 0) + costUsd),
      costConsumedCny: roundUsageCost((task.budgetState?.costConsumedCny ?? 0) + costCny)
    });
    if (
      task.budgetState.budgetInterruptState?.status === 'soft-threshold-triggered' &&
      !task.activeInterrupt &&
      task.status === 'running'
    ) {
      // task.activeInterrupt and task.interruptHistory persist the 司礼监 / InterruptController budget stop.
      const now = new Date().toISOString();
      task.status = 'waiting_approval' as TaskRecord['status'];
      if (task.queueState) {
        task.queueState.status = 'waiting_approval';
        task.queueState.lastTransitionAt = now;
      }
      task.activeInterrupt = {
        id: `interrupt_${task.id}_budget_soft_limit`,
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        origin: 'budget',
        kind: 'user-input',
        interactionKind: 'supplemental-input',
        requestedBy: 'libu-governance',
        ownerType: 'ministry-owned',
        ownerId: 'libu-governance',
        reason: task.budgetState.budgetInterruptState.reason,
        blockedReason: task.budgetState.budgetInterruptState.reason,
        resumeStrategy: 'command',
        timeoutMinutes: 30,
        timeoutPolicy: 'cancel-task',
        payload: {
          stage: 'budget_governance',
          interactionKind: 'supplemental-input',
          tokenBudget: task.budgetState.tokenBudget,
          tokenConsumed: task.budgetState.tokenConsumed,
          costBudgetUsd: task.budgetState.costBudgetUsd,
          costConsumedUsd: task.budgetState.costConsumedUsd
        },
        createdAt: now
      };
      task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
      this.addTrace(
        task,
        'budget_interrupt',
        task.budgetState.budgetInterruptState.reason ?? '预算接近阈值，已请求补充决策。',
        {
          interactionKind: 'supplemental-input',
          tokenBudget: task.budgetState.tokenBudget,
          tokenConsumed: task.budgetState.tokenConsumed,
          costBudgetUsd: task.budgetState.costBudgetUsd,
          costConsumedUsd: task.budgetState.costConsumedUsd
        }
      );
    }
    void this.persistAndEmitTask(task);
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

function resolveCompiledSkillAttachment(task: TaskRecord) {
  const attachments = task.capabilityAttachments ?? [];
  const requestedSkill = task.requestedHints?.requestedSkill?.toLowerCase();
  return (
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        Boolean(attachment.metadata?.steps?.length) &&
        requestedSkill &&
        (`${attachment.displayName} ${attachment.sourceId ?? ''}`.toLowerCase().includes(requestedSkill) ||
          attachment.id.toLowerCase().includes(requestedSkill))
    ) ??
    attachments.find(
      attachment =>
        attachment.kind === 'skill' &&
        attachment.enabled &&
        attachment.owner.ownerType === 'user-attached' &&
        Boolean(attachment.metadata?.steps?.length)
    )
  );
}

function resolveExecutionMode(task?: TaskRecord) {
  if (task?.executionPlan?.mode) {
    return task.executionPlan.mode;
  }
  if (task?.executionMode) {
    return task.executionMode;
  }
  return task?.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute';
}
