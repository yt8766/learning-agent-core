import { randomUUID } from 'node:crypto';

import {
  CreateTaskDto,
  type EntryDecisionRecord,
  ExecutionPlanMode,
  QueueStateRecord,
  TaskRecord,
  TaskStatus
} from '@agent/shared';

import type { KnowledgeReuseResult, RuntimeSettings } from './task-factory.types';

export function buildTaskRecord(params: {
  dto: CreateTaskDto;
  settings: RuntimeSettings;
  now: string;
  taskId: string;
  runId: string;
  createQueueState: (sessionId: string | undefined, now: string) => QueueStateRecord;
  requestedMode: ExecutionPlanMode;
  workflowResolution: ReturnType<
    typeof import('./task-workflow-resolution').resolveTaskWorkflowResolution
  >['workflowResolution'];
  enrichedTaskContext: string | undefined;
  specialistRoute: ReturnType<
    typeof import('./task-workflow-resolution').resolveTaskWorkflowResolution
  >['specialistRoute'];
  orchestrationGovernance: ReturnType<typeof import('./task-execution-plan').deriveOrchestrationGovernance>;
  executionPlan: ReturnType<typeof import('./task-execution-plan').buildExecutionPlan>;
  initialChatRoute: ReturnType<
    typeof import('./task-workflow-resolution').resolveTaskWorkflowResolution
  >['initialChatRoute'];
  entryDecision: EntryDecisionRecord;
  capabilityState: ReturnType<typeof import('../../../capabilities/capability-pool').buildInitialCapabilityState>;
  knowledgeReuse: KnowledgeReuseResult;
}) {
  const traceId = randomUUID();
  const sessionId = (params.dto as CreateTaskDto & { sessionId?: string }).sessionId;

  const task: TaskRecord = {
    id: params.taskId,
    runId: params.runId,
    traceId,
    goal: params.workflowResolution.normalizedGoal,
    context: params.enrichedTaskContext,
    sessionId,
    status: TaskStatus.QUEUED,
    skillId: params.workflowResolution.preset.id,
    skillStage: 'skill_resolved',
    resolvedWorkflow: params.workflowResolution.preset,
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    createdAt: params.now,
    updatedAt: params.now,
    currentNode: 'receive_decree',
    mainChainNode: 'entry_router',
    currentStep: 'queued',
    entryDecision: params.entryDecision,
    executionPlan: params.executionPlan,
    modeGateState: {
      requestedMode: params.requestedMode,
      activeMode: params.requestedMode,
      reason:
        params.requestedMode === 'plan'
          ? '用户请求计划模式，仅开放只读/分析能力。'
          : params.requestedMode === 'imperial_direct'
            ? '特旨直达执行链。'
            : '默认执行模式已启用全量六部执行能力。',
      updatedAt: params.now
    },
    budgetGateState: {
      node: 'budget_gate',
      status: 'open',
      summary: '预算门已初始化，等待进入模式门前做预算与队列裁剪。',
      queueDepth: 0,
      rateLimitKey: sessionId ?? params.taskId,
      updatedAt: params.now
    },
    complexTaskPlan: {
      node: 'complex_task_plan',
      status: 'pending',
      summary: '复杂任务拆解尚未开始。',
      subGoals: [params.workflowResolution.normalizedGoal],
      dependencies: [],
      recoveryPoints: [],
      createdAt: params.now,
      updatedAt: params.now
    },
    blackboardState: {
      node: 'blackboard_state',
      taskId: params.taskId,
      sessionId,
      visibleScopes: ['supervisor', 'strategy', 'ministry', 'fallback', 'governance'],
      refs: {
        traceCount: 0,
        evidenceCount: params.knowledgeReuse.evidence.length
      },
      updatedAt: params.now
    },
    guardrailState: {
      stage: 'pre',
      verdict: 'pass_through',
      summary: '入站护栏已通过基础策略检查，允许进入主链。',
      updatedAt: params.now
    },
    sandboxState: {
      node: 'sandbox',
      stage: 'gongbu',
      status: 'idle',
      attempt: 0,
      maxAttempts: 2,
      updatedAt: params.now
    },
    knowledgeIngestionState: {
      node: 'knowledge_ingestion',
      store: 'cangjing',
      status: 'idle',
      updatedAt: params.now
    },
    knowledgeIndexState: {
      node: 'knowledge_index',
      store: 'cangjing',
      indexStatus: 'building',
      searchableDocumentCount: 0,
      blockedDocumentCount: 0,
      updatedAt: params.now
    },
    contextFilterState: {
      node: 'context_filter',
      status: 'pending',
      filteredContextSlice: {
        summary: params.orchestrationGovernance.contextSummary,
        historyTraceCount: 0,
        evidenceCount: params.knowledgeReuse.evidence.length,
        specialistCount: params.specialistRoute.supportingSpecialists.length + 1,
        ministryCount: params.workflowResolution.preset.requiredMinistries.length,
        compressionApplied: Boolean(params.dto.conversationCompression?.summary),
        compressionSource: params.dto.conversationCompression?.source,
        compressedMessageCount: params.dto.conversationCompression?.condensedMessageCount
      },
      dispatchOrder: params.orchestrationGovernance.dispatchOrder,
      noiseGuards: params.orchestrationGovernance.noiseGuards,
      audienceSlices: {
        strategy: {
          summary: params.orchestrationGovernance.strategySummary,
          dispatchCount: 1
        },
        ministry: {
          summary: params.orchestrationGovernance.ministrySummary,
          dispatchCount: params.workflowResolution.preset.requiredMinistries.length
        },
        fallback: {
          summary: params.orchestrationGovernance.fallbackSummary,
          dispatchCount: params.orchestrationGovernance.dispatchOrder.includes('fallback') ? 1 : 0
        }
      },
      createdAt: params.now,
      updatedAt: params.now
    },
    specialistLead: params.specialistRoute.specialistLead,
    supportingSpecialists: params.specialistRoute.supportingSpecialists,
    specialistFindings: [],
    routeConfidence: params.orchestrationGovernance.adjustedRouteConfidence,
    contextSlicesBySpecialist: params.specialistRoute.contextSlicesBySpecialist,
    chatRoute: params.initialChatRoute,
    requestedHints: params.dto.requestedHints,
    ...params.capabilityState,
    queueState: params.createQueueState(sessionId, params.now),
    retryCount: 0,
    maxRetries: 2,
    microLoopCount: 0,
    maxMicroLoops: 2,
    microLoopState: {
      state: 'idle',
      attempt: 0,
      maxAttempts: 2,
      updatedAt: params.now
    },
    revisionCount: 0,
    maxRevisions: 2,
    revisionState: 'idle',
    finalReviewState: {
      node: 'final_review',
      ministry: 'xingbu-review',
      decision: 'pass',
      summary: '终审尚未开始。',
      interruptRequired: false,
      deliveryStatus: 'pending',
      deliveryMinistry: 'libu-delivery',
      createdAt: params.now,
      updatedAt: params.now
    },
    reusedMemories: params.knowledgeReuse.reusedMemoryIds,
    reusedRules: params.knowledgeReuse.reusedRuleIds,
    reusedSkills: [],
    externalSources: params.knowledgeReuse.evidence,
    usedInstalledSkills: [],
    usedCompanyWorkers: [],
    connectorRefs: [],
    budgetState: {
      stepBudget: params.settings.policy?.budget.stepBudget ?? 8,
      stepsConsumed: 0,
      retryBudget: params.settings.policy?.budget.retryBudget ?? 2,
      retriesConsumed: 0,
      sourceBudget: params.settings.policy?.budget.sourceBudget ?? 8,
      sourcesConsumed: 0,
      tokenBudget: params.executionPlan.tokenBudget,
      tokenConsumed: 0,
      costBudgetUsd: params.settings.policy?.budget.maxCostPerTaskUsd ?? 0,
      costConsumedUsd: 0,
      costConsumedCny: 0,
      softBudgetThreshold: params.executionPlan.softBudgetThreshold,
      hardBudgetThreshold: params.executionPlan.hardBudgetThreshold,
      budgetInterruptState: {
        status: 'idle'
      },
      fallbackModelId: params.settings.policy?.budget.fallbackModelId,
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
      updatedAt: params.now
    }
  };

  return { task, traceId };
}
