import { randomUUID } from 'node:crypto';

import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  CapabilityOwnerType,
  CreateTaskDto,
  EvidenceRecord,
  ExecutionPlanMode,
  QueueStateRecord,
  RequestedExecutionHints,
  SkillSearchStateRecord,
  SpecialistDomain,
  SubgraphId,
  TaskRecord,
  TaskStatus,
  ToolUsageSummaryRecord
} from '@agent/shared';

import { buildInitialCapabilityState, mergeCapabilityStateFromSkillSearch } from '../../capabilities/capability-pool';
import { resolveWorkflowPreset } from '../../workflows/workflow-preset-registry';
import { resolveSpecialistRoute } from '../../workflows/specialist-routing';

type RuntimeSettings = ReturnType<typeof loadSettings>;

interface KnowledgeReuseResult {
  memories: Array<{ tags: string[] }>;
  reusedMemoryIds: string[];
  reusedRuleIds: string[];
  evidence: EvidenceRecord[];
}

type LocalSkillSuggestionResolver = (params: {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: SpecialistDomain;
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

export class MainGraphTaskFactory {
  constructor(
    private readonly settings: RuntimeSettings,
    private readonly createQueueState: (sessionId: string | undefined, now: string) => QueueStateRecord,
    private readonly addTrace: (
      task: TaskRecord,
      node: string,
      summary: string,
      data?: Record<string, unknown>
    ) => void,
    private readonly addProgressDelta: (task: TaskRecord, content: string) => void,
    private readonly markSubgraph: (task: TaskRecord, subgraphId: SubgraphId) => void,
    private readonly attachTool: (
      task: TaskRecord,
      params: {
        toolName: string;
        attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
        preferred?: boolean;
        reason?: string;
        ownerType?: CapabilityOwnerType;
        ownerId?: string;
        family?: string;
      }
    ) => void,
    private readonly recordToolUsage: (
      task: TaskRecord,
      params: {
        toolName: string;
        status: ToolUsageSummaryRecord['status'];
        requestedBy?: string;
        reason?: string;
        blockedReason?: string;
        serverId?: string;
        capabilityId?: string;
        approvalRequired?: boolean;
        riskLevel?: ToolUsageSummaryRecord['riskLevel'];
        route?: ToolUsageSummaryRecord['route'];
        family?: string;
        capabilityType?: ToolUsageSummaryRecord['capabilityType'];
      }
    ) => void
  ) {}

  async createTaskRecord(
    dto: CreateTaskDto,
    knowledgeReuse: KnowledgeReuseResult,
    resolveLocalSkillSuggestions?: LocalSkillSuggestionResolver,
    resolvePreExecutionSkillIntervention?: PreExecutionSkillInterventionResolver,
    identity?: {
      now: string;
      taskId: string;
      runId: string;
    },
    options?: {
      deferPreExecutionSkillIntervention?: boolean;
    }
  ): Promise<{
    task: TaskRecord;
    normalizedGoal: string;
  }> {
    const now = identity?.now ?? new Date().toISOString();
    const taskId = identity?.taskId ?? `task_${Date.now()}`;
    const runId = identity?.runId ?? `run_${Date.now()}`;
    const sessionId = (dto as CreateTaskDto & { sessionId?: string }).sessionId;
    const workflowResolution = resolveWorkflowPreset(dto.goal, {
      constraints: dto.constraints,
      context: dto.context
    });
    const specialistRoute = resolveSpecialistRoute({
      goal: workflowResolution.normalizedGoal,
      context: dto.context,
      requestedHints: dto.requestedHints,
      externalSources: knowledgeReuse.evidence,
      conversationSummary: dto.conversationSummary,
      recentTurns: dto.recentTurns,
      relatedHistory: dto.relatedHistory
    });
    const traceId = randomUUID();
    const requestedMode = resolveRequestedMode(dto);
    const counselorSelection = resolveCounselorSelection(dto, {
      specialistDomain: specialistRoute.specialistLead.domain,
      normalizedGoal: workflowResolution.normalizedGoal,
      sessionId
    });
    const capabilityState = buildInitialCapabilityState({
      now,
      workflow: workflowResolution.preset,
      specialistLead: specialistRoute.specialistLead,
      requestedHints: dto.requestedHints,
      seedCapabilityAttachments: dto.capabilityAttachments,
      seedCapabilityAugmentations: dto.capabilityAugmentations
    });
    const orchestrationGovernance = deriveOrchestrationGovernance({
      capabilityAttachments: capabilityState.capabilityAttachments,
      specialistLead: specialistRoute.specialistLead,
      routeConfidence: specialistRoute.routeConfidence
    });
    const executionPlan = buildExecutionPlan(
      requestedMode,
      this.settings.policy?.budget,
      counselorSelection,
      orchestrationGovernance
    );
    // entryDecision persists the 通政司 / EntryRouter intake selection for compatibility readers.
    const entryDecision = {
      requestedMode,
      counselorSelector: counselorSelection.selector,
      selectionReason: counselorSelection.selectionReason,
      defaultCounselorId: counselorSelection.defaultCounselorId,
      imperialDirectIntent: dto.imperialDirectIntent
    };

    const task: TaskRecord = {
      id: taskId,
      runId,
      traceId,
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
      mainChainNode: 'entry_router',
      currentStep: 'queued',
      entryDecision,
      executionPlan,
      modeGateState: {
        requestedMode,
        activeMode: requestedMode,
        reason:
          requestedMode === 'plan'
            ? '用户请求计划模式，仅开放只读/分析能力。'
            : requestedMode === 'imperial_direct'
              ? '特旨直达执行链。'
              : '默认执行模式已启用全量六部执行能力。',
        updatedAt: now
      },
      budgetGateState: {
        node: 'budget_gate',
        status: 'open',
        summary: '预算门已初始化，等待进入模式门前做预算与队列裁剪。',
        queueDepth: 0,
        rateLimitKey: sessionId ?? taskId,
        updatedAt: now
      },
      complexTaskPlan: {
        node: 'complex_task_plan',
        status: 'pending',
        summary: '复杂任务拆解尚未开始。',
        subGoals: [workflowResolution.normalizedGoal],
        dependencies: [],
        recoveryPoints: [],
        createdAt: now,
        updatedAt: now
      },
      blackboardState: {
        node: 'blackboard_state',
        taskId,
        sessionId,
        visibleScopes: ['supervisor', 'strategy', 'ministry', 'fallback', 'governance'],
        refs: {
          traceCount: 0,
          evidenceCount: knowledgeReuse.evidence.length
        },
        updatedAt: now
      },
      guardrailState: {
        stage: 'pre',
        verdict: 'pass_through',
        summary: '入站护栏已通过基础策略检查，允许进入主链。',
        updatedAt: now
      },
      sandboxState: {
        node: 'sandbox',
        stage: 'gongbu',
        status: 'idle',
        attempt: 0,
        maxAttempts: 2,
        updatedAt: now
      },
      knowledgeIngestionState: {
        node: 'knowledge_ingestion',
        store: 'cangjing',
        status: 'idle',
        updatedAt: now
      },
      knowledgeIndexState: {
        node: 'knowledge_index',
        store: 'cangjing',
        indexStatus: 'building',
        searchableDocumentCount: 0,
        blockedDocumentCount: 0,
        updatedAt: now
      },
      contextFilterState: {
        node: 'context_filter',
        status: 'pending',
        filteredContextSlice: {
          summary: orchestrationGovernance.contextSummary,
          historyTraceCount: 0,
          evidenceCount: knowledgeReuse.evidence.length,
          specialistCount: specialistRoute.supportingSpecialists.length + 1,
          ministryCount: workflowResolution.preset.requiredMinistries.length
        },
        dispatchOrder: orchestrationGovernance.dispatchOrder,
        noiseGuards: orchestrationGovernance.noiseGuards,
        audienceSlices: {
          strategy: {
            summary: orchestrationGovernance.strategySummary,
            dispatchCount: 1
          },
          ministry: {
            summary: orchestrationGovernance.ministrySummary,
            dispatchCount: workflowResolution.preset.requiredMinistries.length
          },
          fallback: {
            summary: orchestrationGovernance.fallbackSummary,
            dispatchCount: orchestrationGovernance.dispatchOrder.includes('fallback') ? 1 : 0
          }
        },
        createdAt: now,
        updatedAt: now
      },
      specialistLead: specialistRoute.specialistLead,
      supportingSpecialists: specialistRoute.supportingSpecialists,
      specialistFindings: [],
      routeConfidence: orchestrationGovernance.adjustedRouteConfidence,
      contextSlicesBySpecialist: specialistRoute.contextSlicesBySpecialist,
      requestedHints: dto.requestedHints,
      ...capabilityState,
      queueState: this.createQueueState(sessionId, now),
      retryCount: 0,
      maxRetries: 2,
      microLoopCount: 0,
      maxMicroLoops: 2,
      microLoopState: {
        state: 'idle',
        attempt: 0,
        maxAttempts: 2,
        updatedAt: now
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
        createdAt: now,
        updatedAt: now
      },
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
        retryBudget: this.settings.policy?.budget.retryBudget ?? 2,
        retriesConsumed: 0,
        sourceBudget: this.settings.policy?.budget.sourceBudget ?? 8,
        sourcesConsumed: 0,
        tokenBudget: executionPlan.tokenBudget,
        tokenConsumed: 0,
        costBudgetUsd: this.settings.policy?.budget.maxCostPerTaskUsd ?? 0,
        costConsumedUsd: 0,
        costConsumedCny: 0,
        softBudgetThreshold: executionPlan.softBudgetThreshold,
        hardBudgetThreshold: executionPlan.hardBudgetThreshold,
        budgetInterruptState: {
          status: 'idle'
        },
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

    if (resolveLocalSkillSuggestions) {
      await this.applyLocalSkillSuggestions(
        task,
        taskId,
        runId,
        now,
        workflowResolution.normalizedGoal,
        dto.requestedHints,
        specialistRoute.specialistLead.domain,
        resolveLocalSkillSuggestions,
        resolvePreExecutionSkillIntervention,
        options?.deferPreExecutionSkillIntervention ?? false
      );
    }

    this.addTrace(task, 'decree_received', `已接收圣旨：${workflowResolution.normalizedGoal}`, {
      runId: task.runId,
      traceId,
      executionMode: executionPlan.mode
    });
    this.addTrace(task, 'entry_router', `通政司已判定本轮入口模式为 ${executionPlan.mode}。`, {
      requestedMode,
      counselorSelector: entryDecision.counselorSelector,
      selectionReason: entryDecision.selectionReason,
      selectedCounselorId: executionPlan.selectedCounselorId,
      selectedVersion: executionPlan.selectedVersion,
      imperialDirectIntent: entryDecision.imperialDirectIntent
    });
    this.addProgressDelta(task, '收到你的任务，首辅正在拆解目标并准备调度六部。');
    this.addTrace(
      task,
      'specialist_routed',
      `本轮由${specialistRoute.specialistLead.displayName}主导，并发征询 ${specialistRoute.supportingSpecialists.length} 个支撑专家。`,
      {
        traceId,
        specialistLead: specialistRoute.specialistLead,
        supportingSpecialists: specialistRoute.supportingSpecialists,
        routeConfidence: orchestrationGovernance.adjustedRouteConfidence,
        governanceEscalated: orchestrationGovernance.requiresGovernanceEscalation
      }
    );
    this.addTrace(task, 'skill_resolved', `已解析流程模板：${workflowResolution.preset.displayName}`, {
      skillId: workflowResolution.preset.id,
      command: workflowResolution.command,
      source: workflowResolution.source,
      requiredMinistries: workflowResolution.preset.requiredMinistries,
      allowedCapabilities: workflowResolution.preset.allowedCapabilities,
      executionPlan
    });
    this.markSubgraph(task, 'skill-install');
    this.addProgressDelta(task, `本轮已切换到 ${workflowResolution.preset.displayName} 流程。`);

    if (knowledgeReuse.reusedMemoryIds.length > 0 || knowledgeReuse.reusedRuleIds.length > 0) {
      const autoPersistedCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('auto-persist')).length;
      const researchMemoryCount = knowledgeReuse.memories.filter(memory => memory.tags.includes('research-job')).length;
      this.addTrace(
        task,
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

    return {
      task,
      normalizedGoal: workflowResolution.normalizedGoal
    };
  }

  private async applyLocalSkillSuggestions(
    task: TaskRecord,
    taskId: string,
    runId: string,
    now: string,
    normalizedGoal: string,
    requestedHints: RequestedExecutionHints | undefined,
    specialistDomain: SpecialistDomain | undefined,
    resolveLocalSkillSuggestions: LocalSkillSuggestionResolver,
    resolvePreExecutionSkillIntervention?: PreExecutionSkillInterventionResolver,
    deferPreExecutionSkillIntervention = false
  ): Promise<void> {
    const skillSearch = await resolveLocalSkillSuggestions({
      goal: normalizedGoal,
      usedInstalledSkills: task.usedInstalledSkills,
      requestedHints,
      specialistDomain
    });
    task.skillSearch = skillSearch;
    Object.assign(task, mergeCapabilityStateFromSkillSearch(task, now, skillSearch));
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

    if (resolvePreExecutionSkillIntervention && !deferPreExecutionSkillIntervention) {
      const intervention = await resolvePreExecutionSkillIntervention({
        goal: normalizedGoal,
        taskId,
        runId,
        sessionId: task.sessionId,
        skillSearch,
        usedInstalledSkills: task.usedInstalledSkills
      });
      if (intervention?.skillSearch) {
        task.skillSearch = intervention.skillSearch;
      }
      if (intervention?.usedInstalledSkills?.length) {
        task.usedInstalledSkills = Array.from(
          new Set([...(task.usedInstalledSkills ?? []), ...intervention.usedInstalledSkills])
        );
      }
      if (intervention?.traceSummary) {
        this.addTrace(task, 'skill_runtime_intervention', intervention.traceSummary, {
          usedInstalledSkills: intervention.usedInstalledSkills
        });
      }
      if (intervention?.progressSummary) {
        this.addProgressDelta(task, intervention.progressSummary);
      }
      if (intervention?.pendingApproval && intervention.pendingExecution) {
        const interruptId = `interrupt_${taskId}_skill_install`;
        task.status = TaskStatus.WAITING_APPROVAL;
        task.currentNode = 'approval_gate';
        task.currentStep = 'waiting_skill_install_approval';
        if (task.queueState) {
          task.queueState.status = 'waiting_approval';
          task.queueState.startedAt ??= now;
          task.queueState.lastTransitionAt = now;
        }
        task.pendingApproval = {
          toolName: intervention.pendingApproval.toolName,
          intent: ActionIntent.INSTALL_SKILL,
          riskLevel: 'medium',
          requestedBy: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          reasonCode: 'requires_approval_governance',
          preview: intervention.pendingApproval.preview
        };
        // task.activeInterrupt and task.interruptHistory persist the 司礼监 / InterruptController approval stop.
        task.activeInterrupt = {
          id: interruptId,
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          origin: 'runtime',
          kind: 'skill-install',
          interactionKind: 'approval',
          intent: ActionIntent.INSTALL_SKILL,
          toolName: intervention.pendingApproval.toolName,
          family: 'runtime-governance',
          capabilityType: 'governance-tool',
          requestedBy: 'libu-governance',
          ownerType: 'ministry-owned',
          ownerId: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          blockedReason: intervention.pendingApproval.reason,
          riskLevel: 'medium',
          resumeStrategy: 'approval-recovery',
          timeoutMinutes: 30,
          timeoutPolicy: 'reject',
          preview: intervention.pendingApproval.preview,
          payload: {
            receiptId: intervention.pendingExecution.receiptId,
            skillDisplayName: intervention.pendingExecution.skillDisplayName
          },
          createdAt: now
        };
        task.interruptHistory = [...(task.interruptHistory ?? []), task.activeInterrupt];
        this.attachTool(task, {
          toolName: intervention.pendingApproval.toolName,
          attachedBy: 'runtime',
          preferred: true,
          reason: intervention.pendingApproval.reason,
          ownerType: 'ministry-owned',
          ownerId: 'libu-governance',
          family: 'runtime-governance'
        });
        this.recordToolUsage(task, {
          toolName: intervention.pendingApproval.toolName,
          status: 'blocked',
          requestedBy: 'libu-governance',
          reason: intervention.pendingApproval.reason,
          blockedReason: intervention.pendingApproval.reason,
          approvalRequired: true,
          route: 'governance',
          family: 'runtime-governance',
          capabilityType: 'governance-tool',
          riskLevel: 'medium'
        });
        task.approvals.push({
          taskId,
          intent: ActionIntent.INSTALL_SKILL,
          reason: intervention.pendingApproval.reason,
          actor: 'runtime-auto-pre-execution',
          decision: 'pending',
          decidedAt: now
        });
        this.addTrace(task, 'approval_gate', intervention.pendingApproval.reason ?? '检测到远程 skill 安装需要审批。', {
          receiptId: intervention.pendingExecution.receiptId,
          skillDisplayName: intervention.pendingExecution.skillDisplayName,
          intent: ActionIntent.INSTALL_SKILL
        });
        this.addProgressDelta(
          task,
          `当前轮需要先确认安装 ${intervention.pendingExecution.skillDisplayName ?? '远程 skill'}。`
        );
        Object.assign(task, mergeCapabilityStateFromSkillSearch(task, now, task.skillSearch));
        return;
      }
    }

    const activeSkillSearch = task.skillSearch ?? skillSearch;
    Object.assign(task, mergeCapabilityStateFromSkillSearch(task, now, activeSkillSearch));

    if (activeSkillSearch.capabilityGapDetected && activeSkillSearch.suggestions.length > 0) {
      this.addTrace(
        task,
        'research',
        `检测到能力缺口，已在本地技能库中找到 ${activeSkillSearch.suggestions.length} 个候选。`,
        {
          skillSearchStatus: activeSkillSearch.status,
          suggestionIds: activeSkillSearch.suggestions.map(item => item.id),
          availability: activeSkillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
        }
      );
      this.addProgressDelta(
        task,
        `首辅已识别出能力缺口，并在本地技能库中找到 ${activeSkillSearch.suggestions.length} 个候选。`
      );
      return;
    }
    if (activeSkillSearch.suggestions.length > 0) {
      this.addTrace(task, 'research', `本地技能库已命中 ${activeSkillSearch.suggestions.length} 个可直接参考的候选。`, {
        skillSearchStatus: activeSkillSearch.status,
        suggestionIds: activeSkillSearch.suggestions.map(item => item.id),
        availability: activeSkillSearch.suggestions.map(item => `${item.id}:${item.availability}`)
      });
      this.addProgressDelta(task, `首辅已在本地技能库中命中 ${activeSkillSearch.suggestions.length} 个可复用候选。`);
    }
  }
}

function resolveRequestedMode(dto: CreateTaskDto): ExecutionPlanMode {
  if (dto.requestedMode) {
    return dto.requestedMode;
  }
  if (dto.imperialDirectIntent?.enabled) {
    return 'imperial_direct';
  }
  if (/^\/plan[-\w]*/i.test(dto.goal.trim())) {
    return 'plan';
  }
  return 'execute';
}

function buildExecutionPlan(
  mode: ExecutionPlanMode,
  budget:
    | {
        maxCostPerTaskUsd?: number;
      }
    | undefined,
  counselorSelection: {
    selectedCounselorId?: string;
    selectedVersion?: string;
  },
  governance: {
    requiresGovernanceEscalation: boolean;
    trustedSpecialistFastLane: boolean;
    strategyCounselors: SpecialistDomain[];
  }
) {
  const costBudget = budget?.maxCostPerTaskUsd ?? 0;
  const dispatchChain: NonNullable<import('@agent/shared').ExecutionPlanRecord['dispatchChain']> = [
    'entry_router',
    'mode_gate',
    'dispatch_planner',
    'context_filter',
    'result_aggregator',
    'interrupt_controller',
    'learning_recorder'
  ];
  const executionMinistries: NonNullable<import('@agent/shared').ExecutionPlanRecord['executionMinistries']> =
    mode === 'plan'
      ? ['libu-governance', 'hubu-search']
      : ['libu-governance', 'hubu-search', 'gongbu-code', 'bingbu-ops', 'xingbu-review', 'libu-delivery'];
  const allowedOutputKinds: Array<'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress'> = [
    'preview',
    'low_risk_action_suggestion',
    'approved_lightweight_progress'
  ];
  const filteredCapabilitiesBase =
    mode === 'plan'
      ? ['shared', 'readonly:ministry-owned', 'low-risk:specialist-owned']
      : mode === 'imperial_direct'
        ? ['shared', 'ministry-owned', 'specialist-owned', 'imperial-attached']
        : ['shared', 'ministry-owned', 'specialist-owned', 'temporary-assignment'];
  const filteredCapabilities = governance.requiresGovernanceEscalation
    ? filteredCapabilitiesBase.filter(item => item !== 'temporary-assignment' && item !== 'imperial-attached')
    : filteredCapabilitiesBase;
  const modeCapabilitiesBase =
    mode === 'plan'
      ? ['readonly-analysis', 'static-validation', 'plan-synthesis']
      : mode === 'imperial_direct'
        ? ['imperial-fast-path', 'dangerous-approval-floor', 'full-capability-pool']
        : ['full-capability-pool'];
  return {
    mode,
    tokenBudget:
      (mode === 'plan' ? 6000 : mode === 'imperial_direct' ? 12000 : 10000) +
      (governance.trustedSpecialistFastLane ? 800 : 0),
    costBudget,
    softBudgetThreshold: governance.requiresGovernanceEscalation ? 0.72 : 0.8,
    hardBudgetThreshold: 1,
    dispatchChain,
    filteredCapabilities,
    strategyCounselors: governance.strategyCounselors,
    executionMinistries,
    selectedCounselorId: counselorSelection.selectedCounselorId,
    selectedVersion: counselorSelection.selectedVersion,
    partialAggregationPolicy: {
      allowedOutputKinds: governance.requiresGovernanceEscalation
        ? allowedOutputKinds.filter(item => item !== 'approved_lightweight_progress')
        : allowedOutputKinds,
      requiresInterruptApprovalForProgress: true
    },
    modeCapabilities: Array.from(
      new Set([
        ...modeCapabilitiesBase,
        ...(governance.requiresGovernanceEscalation
          ? ['governance-escalated-review', 'trust-gated-capability-pool']
          : []),
        ...(governance.trustedSpecialistFastLane ? ['trusted-specialist-fast-lane'] : [])
      ])
    )
  };
}

function deriveOrchestrationGovernance(params: {
  capabilityAttachments: TaskRecord['capabilityAttachments'];
  specialistLead: NonNullable<TaskRecord['specialistLead']>;
  routeConfidence: number;
}) {
  const specialistAttachment = (params.capabilityAttachments ?? []).find(
    attachment =>
      attachment.owner.ownerType === 'specialist-owned' && attachment.owner.ownerId === params.specialistLead.domain
  );
  const degradedAttachmentCount = (params.capabilityAttachments ?? []).filter(attachment =>
    isDegradedTrust(attachment.capabilityTrust?.trustLevel, attachment.capabilityTrust?.trustTrend)
  ).length;
  const degradedMinistryCount = (params.capabilityAttachments ?? []).filter(
    attachment =>
      attachment.owner.ownerType === 'ministry-owned' &&
      isDegradedTrust(attachment.capabilityTrust?.trustLevel, attachment.capabilityTrust?.trustTrend)
  ).length;
  const requiresGovernanceEscalation =
    degradedMinistryCount > 0 ||
    isDegradedTrust(
      specialistAttachment?.capabilityTrust?.trustLevel,
      specialistAttachment?.capabilityTrust?.trustTrend
    );
  const trustedSpecialistFastLane =
    specialistAttachment?.capabilityTrust?.trustLevel === 'high' &&
    specialistAttachment?.capabilityTrust?.trustTrend === 'up' &&
    degradedAttachmentCount === 0;
  const adjustedRouteConfidence = Math.max(
    0.2,
    Math.min(
      params.routeConfidence + (trustedSpecialistFastLane ? 0.06 : requiresGovernanceEscalation ? -0.12 : 0),
      0.98
    )
  );

  return {
    requiresGovernanceEscalation,
    trustedSpecialistFastLane,
    strategyCounselors: trustedSpecialistFastLane ? [params.specialistLead.domain] : [],
    adjustedRouteConfidence,
    dispatchOrder: (requiresGovernanceEscalation
      ? ['strategy', 'fallback', 'ministry']
      : ['strategy', 'ministry', 'fallback']) as Array<'strategy' | 'ministry' | 'fallback'>,
    noiseGuards: requiresGovernanceEscalation
      ? ['prioritize_governance_feedback', 'require_cross_check_before_write']
      : trustedSpecialistFastLane
        ? ['compress_confirmed_specialist_context']
        : [],
    contextSummary: requiresGovernanceEscalation
      ? '文书科将优先暴露治理反馈与保守派发顺序。'
      : trustedSpecialistFastLane
        ? '文书科将优先压缩稳定画像并放大主专家可信上下文。'
        : '尚未生成文书科上下文切片。',
    strategySummary: requiresGovernanceEscalation ? '优先汇入治理告警与保守策略。' : '优先汇入主专家和群辅票拟摘要。',
    ministrySummary: requiresGovernanceEscalation
      ? '执行侧先接收治理约束，再展开六部动作。'
      : '执行侧按默认六部链路展开。',
    fallbackSummary: requiresGovernanceEscalation ? '兜底链提前参与交叉校验。' : '仅在主链不足时再进入兜底。'
  };
}

function isDegradedTrust(level?: 'high' | 'medium' | 'low', trend?: 'up' | 'steady' | 'down') {
  return level === 'low' || trend === 'down';
}

function resolveCounselorSelection(
  dto: CreateTaskDto,
  context: {
    specialistDomain: string;
    normalizedGoal: string;
    sessionId?: string;
  }
) {
  const selector = dto.counselorSelector ?? {
    strategy: 'task-type' as const,
    key: context.specialistDomain,
    candidateIds: [context.specialistDomain]
  };
  const candidates =
    selector.candidateIds && selector.candidateIds.length > 0
      ? selector.candidateIds
      : [selector.fallbackCounselorId ?? context.specialistDomain];
  const defaultCounselorId = selector.fallbackCounselorId ?? candidates[0] ?? context.specialistDomain;
  const salt = `${context.normalizedGoal}:${dto.context ?? ''}:${context.sessionId ?? ''}:${selector.key ?? ''}:${selector.featureFlag ?? ''}`;
  let selectedCounselorId = defaultCounselorId;
  let selectionReason = 'selector_fallback_default';

  switch (selector.strategy) {
    case 'manual':
      selectedCounselorId = candidates[0] ?? defaultCounselorId;
      selectionReason = 'manual_selector';
      break;
    case 'user-id':
    case 'task-type':
    case 'feature-flag': {
      const index = hashStringToIndex(salt, candidates.length);
      selectedCounselorId = candidates[index] ?? defaultCounselorId;
      selectionReason =
        selector.strategy === 'user-id'
          ? 'by_user_id'
          : selector.strategy === 'feature-flag'
            ? 'by_feature_flag'
            : 'by_task_type';
      break;
    }
    case 'session-ratio': {
      const index = hashStringToWeightedIndex(salt, candidates.length, selector.weights);
      selectedCounselorId = candidates[index] ?? defaultCounselorId;
      selectionReason = 'by_session_ratio';
      break;
    }
    default:
      break;
  }

  const selectedVersion = resolveCounselorVersion(selectedCounselorId);
  return {
    selector: {
      ...selector,
      selectedCounselorId,
      selectedVersion
    },
    defaultCounselorId,
    selectionReason,
    selectedCounselorId,
    selectedVersion
  };
}

function hashStringToIndex(value: string, size: number) {
  if (size <= 1) {
    return 0;
  }
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % size;
}

function hashStringToWeightedIndex(value: string, size: number, weights?: number[]) {
  if (size <= 1) {
    return 0;
  }
  const normalizedWeights =
    Array.isArray(weights) && weights.length === size && weights.some(weight => weight > 0)
      ? weights.map(weight => (weight > 0 ? weight : 0))
      : new Array(size).fill(1);
  const total = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return hashStringToIndex(value, size);
  }
  const hash = hashStringToIndex(value, 10000);
  let cursor = (hash / 10000) * total;
  for (let index = 0; index < normalizedWeights.length; index += 1) {
    cursor -= normalizedWeights[index] ?? 0;
    if (cursor < 0) {
      return index;
    }
  }
  return normalizedWeights.length - 1;
}

function resolveCounselorVersion(counselorId?: string) {
  const match = counselorId?.match(/-(v\d+)$/i);
  return match?.[1]?.toLowerCase();
}
