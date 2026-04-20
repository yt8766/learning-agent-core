import { loadSettings } from '@agent/config';
import type { ILLMProvider } from '@agent/core';
import {
  MemoryRepository,
  RuleRepository,
  RuntimeStateRepository,
  MemorySearchService,
  NullVectorIndexRepository
} from '@agent/memory';
import { SkillRegistry } from '@agent/skill-runtime';
import { ApprovalService, McpClientManager, ToolRegistry, SandboxExecutor } from '@agent/tools';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { AgentRole } from '../task-architecture-helpers';
import { resolveCompiledSkillAttachment, resolveExecutionMode } from './main-graph-task-context-helpers';
import { recordTaskUsage, type RecordTaskUsageDeps } from './main-graph-task-context-usage';

import { WorkerRegistry } from '../../../../governance/worker-registry';
import type { AgentRuntimeContext } from '../../../../runtime/agent-runtime-context';
import { LocalKnowledgeSearchService } from '../../../../runtime/local-knowledge-search-service';

import type { MainGraphTaskContextDependencies, RuntimeSettings } from './main-graph-task-context.types';
export type { MainGraphTaskContextDependencies, RuntimeSettings } from './main-graph-task-context.types';

export class MainGraphTaskContextRuntime {
  private readonly knowledgeSearchService: LocalKnowledgeSearchService;

  constructor(
    private readonly dependencies: MainGraphTaskContextDependencies,
    private readonly settings: RuntimeSettings,
    private readonly llm: ILLMProvider,
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
      get specialistLead() {
        return resolveTask()?.specialistLead;
      },
      get supportingSpecialists() {
        return resolveTask()?.supportingSpecialists;
      },
      get routeConfidence() {
        return resolveTask()?.routeConfidence;
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
        const worker = workerId ? workerRegistry.get(workerId) : undefined;
        if (!worker) {
          return undefined;
        }
        const selectedModel = resolveTask()?.modelRoute?.find(route => route.workerId === workerId)?.selectedModel;
        return selectedModel && selectedModel !== worker.defaultModel
          ? {
              ...worker,
              defaultModel: selectedModel
            }
          : worker;
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

  private usageDeps(): RecordTaskUsageDeps {
    return {
      tasks: this.tasks,
      updateBudgetState: this.updateBudgetState,
      addTrace: this.addTrace,
      persistAndEmitTask: this.persistAndEmitTask
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
    recordTaskUsage(this.usageDeps(), taskId, usage);
  }
}
