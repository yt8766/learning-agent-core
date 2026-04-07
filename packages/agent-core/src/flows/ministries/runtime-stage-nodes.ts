import {
  ActionIntent,
  AgentRole,
  ApprovalDecision,
  CurrentSkillExecutionRecord,
  EvidenceRecord,
  MemoryRecord,
  SkillCard,
  SourcePolicyMode,
  SpecialistFindingRecord,
  TaskRecord,
  TaskStatus,
  ToolUsageSummaryRecord,
  normalizeExecutionMode
} from '@agent/shared';
import { executeApprovedAction, PendingExecutionContext } from '../approval';
import { handleResearchSkillIntervention } from '../approval/research-skill-interruption';
import { BingbuOpsMinistry, GongbuCodeMinistry, HubuSearchMinistry, LibuDocsMinistry } from './index';
import { resolveCapabilityRedirect } from '../../capabilities/capability-pool';
import { StructuredContractMeta } from '../../utils/schemas/safe-generate-object';
import { upsertSpecialistFinding } from '../../shared/schemas/specialist-finding-schema';
import { buildResearchSourcePlan, mergeEvidence } from '../../workflows/research-source-planner';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepStarted
} from '../../workflows/execution-steps';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import {
  announceSkillStep,
  appendExecutionEvidence,
  buildCurrentSkillExecution,
  completeSkillStep,
  resolveExecutionDispatchObjective,
  resolveResearchDispatchObjective,
  setSkillStepStatus
} from './runtime-stage-helpers';
import { pauseExecutionForApproval } from './runtime-stage-execute';

// task.activeInterrupt and task.interruptHistory persist 司礼监 / InterruptController state across runtime resumes.
type NormalizedResearchResult = {
  summary: string;
  memories: MemoryRecord[];
  knowledgeEvidence: EvidenceRecord[];
  skills: SkillCard[];
  specialistFinding?: SpecialistFindingRecord;
  contractMeta: StructuredContractMeta;
};

interface PipelineRuntimeCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: TaskRecord, subgraphId: 'research' | 'execution') => void;
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  attachTool: (
    task: TaskRecord,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      family?: string;
    }
  ) => void;
  recordToolUsage: (
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
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      route?: 'local' | 'mcp' | 'governance';
      family?: string;
      capabilityType?: 'local-tool' | 'mcp-capability' | 'governance-tool';
    }
  ) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  addMessage: (
    task: TaskRecord,
    type: 'research_result' | 'execution_result',
    content: string,
    from: AgentRole
  ) => void;
  upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  updateBudgetState: (
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ) => NonNullable<TaskRecord['budgetState']>;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution?: (taskId: string, pending: PendingExecutionContext) => void;
  resolveResearchMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'hubu-search' | 'libu-delivery';
  resolveExecutionMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'gongbu-code' | 'bingbu-ops' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  describeActionIntent: (intent: string) => string;
  createAgentContext: (taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') => any;
  resolveRuntimeSkillIntervention?: (params: {
    task: TaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: NonNullable<TaskRecord['skillSearch']>;
    usedInstalledSkills?: string[];
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
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
  resolveSkillInstallInterruptResume?: (params: {
    task: TaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        traceSummary?: string;
        progressSummary?: string;
      }
    | undefined
  >;
}

export async function runResearchStage(
  task: TaskRecord,
  state: RuntimeAgentGraphState,
  hubu: HubuSearchMinistry,
  libuDocs: LibuDocsMinistry,
  runtimeSourcePolicyMode: SourcePolicyMode | undefined,
  callbacks: PipelineRuntimeCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  markExecutionStepStarted(task, 'research', '户部开始整理资料、记忆与受控来源。', 'hubu');
  callbacks.syncTaskRuntime(task, {
    currentStep: 'research',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.markSubgraph(task, 'research');
  const executionMode =
    task.executionMode ??
    task.executionPlan?.mode ??
    (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute');
  if (normalizeExecutionMode(executionMode) === 'plan') {
    callbacks.addTrace(
      task,
      'planning_readonly_guard',
      '规划阶段已启用只读研究边界，外部 Web / 浏览器 / 终端来源将被禁止。',
      {
        executionMode,
        blockedFamilies: ['open-web', 'browser-automation', 'terminal']
      }
    );
    callbacks.addProgressDelta(
      task,
      '当前仍处于计划模式，只允许仓库内与受控来源研究；open-web、浏览器和终端能力暂不开放。'
    );
  }
  const researchMinistry = callbacks.resolveResearchMinistry(task, task.resolvedWorkflow);
  task.currentMinistry = researchMinistry;
  task.currentWorker = task.modelRoute?.find(item => item.ministry === researchMinistry)?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  const researchSources = buildResearchSourcePlan({
    taskId: task.id,
    runId: task.runId,
    goal: task.goal,
    workflow: task.resolvedWorkflow,
    runtimeSourcePolicyMode,
    executionMode
  });
  const remainingSourceBudget = Math.max(
    0,
    (task.budgetState?.sourceBudget ?? 0) - (task.budgetState?.sourcesConsumed ?? 0)
  );
  const budgetedResearchSources = researchSources.slice(0, remainingSourceBudget);
  if (researchSources.length > budgetedResearchSources.length) {
    callbacks.addTrace(task, 'budget_exhausted', '户部研究来源已按 source budget 裁剪。', {
      sourceBudget: task.budgetState?.sourceBudget,
      sourcesConsumed: task.budgetState?.sourcesConsumed,
      requestedSources: researchSources.length,
      allowedSources: budgetedResearchSources.length
    });
  }
  task.budgetState = callbacks.updateBudgetState(task, {
    sourcesConsumed: (task.budgetState?.sourcesConsumed ?? 0) + budgetedResearchSources.length
  });
  if (budgetedResearchSources.length) {
    task.externalSources = mergeEvidence(task.externalSources ?? [], budgetedResearchSources);
    task.knowledgeIngestionState = {
      node: 'knowledge_ingestion',
      store: 'cangjing',
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
    task.knowledgeIndexState = {
      node: 'knowledge_index',
      store: 'cangjing',
      indexStatus: 'ready',
      searchableDocumentCount: budgetedResearchSources.length,
      blockedDocumentCount: 0,
      updatedAt: new Date().toISOString()
    };
    for (const source of budgetedResearchSources) {
      callbacks.addTrace(task, 'research', `户部已锁定研究来源：${source.summary}`, {
        ministry: researchMinistry,
        sourceUrl: source.sourceUrl,
        sourceType: source.sourceType,
        trustClass: source.trustClass
      });
    }
  }
  callbacks.addTrace(task, 'ministry_started', '户部开始检索上下文与资料。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(task, '户部已开始检索资料与上下文。', AgentRole.RESEARCH);
  callbacks.setSubTaskStatus(task, AgentRole.RESEARCH, 'running');
  announceSkillStep(task, 'research', callbacks);
  const researchResult: NormalizedResearchResult =
    researchMinistry === 'libu-delivery'
      ? {
          ...(await libuDocs.research(task)),
          knowledgeEvidence: [],
          specialistFinding: undefined,
          contractMeta: {
            contractName: 'research-evidence',
            contractVersion: 'research-evidence.v1',
            parseStatus: 'success',
            fallbackUsed: false
          }
        }
      : await hubu.research(resolveResearchDispatchObjective(state.dispatches));
  callbacks.ensureTaskNotCancelled(task);
  if (researchResult.knowledgeEvidence.length) {
    task.externalSources = mergeEvidence(task.externalSources ?? [], researchResult.knowledgeEvidence);
    const searchableDocumentCount = new Set(
      researchResult.knowledgeEvidence.map(item => String(item.detail?.documentId ?? item.id))
    ).size;
    task.knowledgeIngestionState = {
      node: 'knowledge_ingestion',
      store: 'cangjing',
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
    task.knowledgeIndexState = {
      node: 'knowledge_index',
      store: 'cangjing',
      indexStatus: 'ready',
      searchableDocumentCount: Math.max(
        task.knowledgeIndexState?.searchableDocumentCount ?? 0,
        searchableDocumentCount
      ),
      blockedDocumentCount: task.knowledgeIndexState?.blockedDocumentCount ?? 0,
      updatedAt: new Date().toISOString()
    };
  }
  callbacks.upsertAgentState(task, researchMinistry === 'libu-delivery' ? libuDocs.getState() : hubu.getState());
  callbacks.addMessage(task, 'research_result', researchResult.summary, AgentRole.RESEARCH);
  callbacks.addTrace(task, 'research', researchResult.summary, {
    ministry: task.currentMinistry,
    memoryCount: researchResult.memories.length,
    knowledgeEvidenceCount: researchResult.knowledgeEvidence.length,
    skillCount: researchResult.skills.length,
    status: researchResult.contractMeta.parseStatus === 'success' ? 'success' : 'failed',
    isFallback: researchResult.contractMeta.fallbackUsed,
    fallbackReason: researchResult.contractMeta.fallbackReason,
    contractName: researchResult.contractMeta.contractName,
    contractVersion: researchResult.contractMeta.contractVersion,
    parseStatus: researchResult.contractMeta.parseStatus
  });
  const researchEvidenceRefs = (task.externalSources ?? []).slice(0, 5).map(source => source.id);
  if (task.specialistLead) {
    upsertSpecialistFinding(
      task,
      researchResult.specialistFinding ?? {
        specialistId: task.specialistLead.id,
        role: 'lead',
        source: 'research',
        stage: 'research',
        domain: task.specialistLead.domain,
        summary: researchResult.summary,
        suggestions: [task.specialistLead.reason ?? '结合研究结果继续形成统一判断。'],
        evidenceRefs: researchEvidenceRefs,
        confidence: task.routeConfidence
      }
    );
  }
  for (const support of task.supportingSpecialists ?? []) {
    const slice = task.contextSlicesBySpecialist?.find(item => item.specialistId === support.id);
    upsertSpecialistFinding(task, {
      specialistId: support.id,
      role: 'support',
      source: 'research',
      stage: 'research',
      domain: support.domain,
      summary: `${support.displayName} 已收到并发补充任务。${researchResult.summary}`,
      constraints: slice?.domainInstruction ? [slice.domainInstruction] : undefined,
      suggestions: support.reason ? [support.reason] : undefined,
      evidenceRefs: researchEvidenceRefs,
      confidence: task.routeConfidence ? Math.max(0.2, task.routeConfidence - 0.1) : undefined
    });
  }
  callbacks.addTrace(task, 'ministry_reported', '户部已提交检索战报。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  completeSkillStep(task, 'research');
  callbacks.addProgressDelta(task, `户部战报：${researchResult.summary}`, AgentRole.RESEARCH);
  callbacks.setSubTaskStatus(task, AgentRole.RESEARCH, 'completed');
  markExecutionStepCompleted(
    task,
    'research',
    researchResult.summary,
    researchMinistry === 'libu-delivery' ? 'libu-docs' : 'hubu'
  );

  const intervention = await handleResearchSkillIntervention(task, callbacks, researchMinistry);
  if (intervention.interrupted) {
    markExecutionStepBlocked(
      task,
      'approval-interrupt',
      '研究阶段需要审批或补装能力。',
      '研究阶段已暂停等待恢复。',
      'system'
    );
    return intervention.statePatch;
  }

  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'research',
    observations: [...state.observations, researchResult.summary],
    retrievedMemories: researchResult.memories,
    retrievedSkills: researchResult.skills,
    researchSummary: researchResult.summary,
    resumeFromApproval: false
  };
}

export async function runExecuteStage(
  task: TaskRecord,
  dtoGoal: string,
  state: RuntimeAgentGraphState,
  gongbu: GongbuCodeMinistry,
  bingbu: BingbuOpsMinistry,
  libuDocs: LibuDocsMinistry,
  pendingExecutions: Map<string, PendingExecutionContext>,
  llmConfigured: boolean,
  callbacks: PipelineRuntimeCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  markExecutionStepStarted(task, 'execution', '六部开始执行实施。');
  callbacks.syncTaskRuntime(task, {
    currentStep: 'execute',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.markSubgraph(task, 'execution');
  const executionMinistry = callbacks.resolveExecutionMinistry(task, task.resolvedWorkflow);
  task.sandboxState = {
    node: 'sandbox',
    stage: executionMinistry === 'bingbu-ops' ? 'bingbu' : executionMinistry === 'libu-delivery' ? 'review' : 'gongbu',
    status: 'running',
    attempt: (task.microLoopCount ?? 0) + 1,
    maxAttempts: task.maxMicroLoops ?? 2,
    updatedAt: new Date().toISOString()
  };
  task.currentMinistry = executionMinistry;
  task.currentWorker = task.modelRoute?.find(item => item.ministry === executionMinistry)?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  callbacks.addTrace(task, 'ministry_started', `${callbacks.getMinistryLabel(executionMinistry)}开始执行方案。`, {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(
    task,
    `${callbacks.getMinistryLabel(executionMinistry)}已接到任务，正在执行方案。`,
    AgentRole.EXECUTOR
  );
  callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');
  announceSkillStep(task, 'execute', callbacks);
  const executionMode = normalizeExecutionMode(task.executionMode ?? task.executionPlan?.mode);
  if (executionMode === 'plan') {
    const readonlySummary = '当前仍处于计划模式，六部执行链不会被打开；系统仅保留票拟、研究与只读整理结果。';
    task.mainChainNode = 'mode_gate';
    task.currentNode = 'planning_readonly_execute_blocked';
    callbacks.addTrace(task, 'mode_gate', '模式门阻止了 plan 模式下的六部执行。', {
      activeMode: 'plan',
      blockedStage: 'execute',
      currentMinistry: executionMinistry
    });
    callbacks.addProgressDelta(task, readonlySummary, AgentRole.EXECUTOR);
    callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
    markExecutionStepBlocked(task, 'execution', '当前仍处于计划模式，执行链被模式门阻止。');
    task.sandboxState = {
      ...task.sandboxState,
      status: 'failed',
      verdict: 'unsafe',
      exhaustedReason: 'plan_mode_blocks_execute',
      updatedAt: new Date().toISOString()
    };
    await callbacks.persistAndEmitTask(task);
    return {
      currentStep: 'execute',
      approvalRequired: false,
      approvalStatus: ApprovalDecision.APPROVED,
      executionSummary: readonlySummary,
      executionResult: undefined,
      finalAnswer: readonlySummary,
      resumeFromApproval: false,
      shouldRetry: false
    };
  }

  const executionMinistryRunner = executionMinistry === 'bingbu-ops' ? bingbu : gongbu;

  if (state.resumeFromApproval && state.toolIntent && state.toolName) {
    const approvedResult = await executeApprovedAction(callbacks.createAgentContext(task.id, dtoGoal, 'approval'), {
      taskId: task.id,
      intent: state.toolIntent,
      toolName: state.toolName,
      researchSummary: state.researchSummary ?? ''
    });
    callbacks.ensureTaskNotCancelled(task);
    callbacks.upsertAgentState(
      task,
      gongbu.buildApprovedState(approvedResult, {
        taskId: task.id,
        intent: state.toolIntent,
        toolName: state.toolName,
        researchSummary: state.researchSummary ?? ''
      })
    );
    callbacks.addMessage(task, 'execution_result', approvedResult.outputSummary, AgentRole.EXECUTOR);
    callbacks.attachTool(task, {
      toolName: state.toolName,
      attachedBy: 'workflow',
      preferred: true,
      reason: approvedResult.outputSummary,
      ownerType: 'ministry-owned',
      ownerId: task.currentMinistry ?? executionMinistry
    });
    callbacks.recordToolUsage(task, {
      toolName: state.toolName,
      status: 'approved',
      requestedBy: task.currentMinistry ?? executionMinistry,
      reason: approvedResult.outputSummary,
      serverId: approvedResult.serverId,
      capabilityId: approvedResult.capabilityId,
      approvalRequired: false
    });
    callbacks.recordToolUsage(task, {
      toolName: state.toolName,
      status: 'completed',
      requestedBy: task.currentMinistry ?? executionMinistry,
      reason: approvedResult.outputSummary,
      serverId: approvedResult.serverId,
      capabilityId: approvedResult.capabilityId,
      approvalRequired: false
    });
    appendExecutionEvidence(task, state.toolName, approvedResult);
    task.sandboxState = {
      ...task.sandboxState,
      status: 'passed',
      verdict: 'safe',
      updatedAt: new Date().toISOString()
    };
    callbacks.addTrace(task, 'execute', approvedResult.outputSummary, {
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
    completeSkillStep(task, 'execute');
    callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
    markExecutionStepCompleted(task, 'execution', approvedResult.outputSummary);
    callbacks.addTrace(task, 'ministry_reported', '工部已提交执行结果。', {
      ministry: task.currentMinistry,
      workerId: task.currentWorker
    });
    callbacks.addProgressDelta(task, `执行结果：${approvedResult.outputSummary}`, AgentRole.EXECUTOR);
    await callbacks.persistAndEmitTask(task);
    return {
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
    executionMinistry === 'libu-delivery'
      ? await libuDocs.execute(task, state.executionSummary ?? state.researchSummary ?? '')
      : await executionMinistryRunner.execute(
          resolveExecutionDispatchObjective(state.dispatches) ??
            (executionMinistry === 'bingbu-ops'
              ? 'Run controlled ops and validation tasks'
              : 'Execute the candidate action'),
          state.researchSummary ?? 'No research summary available.'
        );
  callbacks.ensureTaskNotCancelled(task);
  const capabilityRedirect = resolveCapabilityRedirect(task, execution.capabilityId ?? execution.toolName);
  if (
    capabilityRedirect.requestedTarget &&
    capabilityRedirect.requestedTarget !== capabilityRedirect.redirectedTarget
  ) {
    callbacks.addTrace(task, 'deprecated_redirect', '命中已弃用能力，已按兼容策略重定向到替代能力。', {
      requestedTarget: capabilityRedirect.requestedTarget,
      redirectedTarget: capabilityRedirect.redirectedTarget
    });
  }
  if (
    capabilityRedirect.requestedTarget &&
    capabilityRedirect.requestedTarget !== capabilityRedirect.redirectedTarget &&
    !capabilityRedirect.redirectAttachment
  ) {
    if (capabilityRedirect.requiresReadonlyFallback) {
      const fallbackSummary = `能力 ${capabilityRedirect.requestedTarget} 已弃用，但替代目标 ${capabilityRedirect.redirectedTarget} 当前不可用。已退回只读建议，不执行外部副作用。`;
      task.result = fallbackSummary;
      callbacks.addTrace(task, 'deprecated_redirect', fallbackSummary, {
        requestedTarget: capabilityRedirect.requestedTarget,
        redirectedTarget: capabilityRedirect.redirectedTarget,
        fallback: 'readonly-suggestion'
      });
      callbacks.addProgressDelta(task, fallbackSummary, AgentRole.EXECUTOR);
      markExecutionStepCompleted(task, 'execution', fallbackSummary);
      await callbacks.persistAndEmitTask(task);
      return {
        currentStep: 'execute',
        approvalRequired: false,
        approvalStatus: ApprovalDecision.APPROVED,
        executionSummary: fallbackSummary,
        executionResult: undefined,
        finalAnswer: fallbackSummary,
        resumeFromApproval: false,
        shouldRetry: false
      };
    }
    throw new Error(
      `Capability ${capabilityRedirect.requestedTarget} is deprecated in favor of ${capabilityRedirect.redirectedTarget}, but the replacement is unavailable.`
    );
  }
  callbacks.upsertAgentState(
    task,
    executionMinistry === 'libu-delivery' ? libuDocs.getState() : executionMinistryRunner.getState()
  );
  callbacks.addMessage(task, 'execution_result', execution.summary, AgentRole.EXECUTOR);
  callbacks.attachTool(task, {
    toolName: execution.toolName,
    attachedBy: 'workflow',
    preferred: true,
    reason: execution.summary,
    ownerType: 'ministry-owned',
    ownerId: task.currentMinistry ?? executionMinistry
  });
  callbacks.recordToolUsage(task, {
    toolName: execution.toolName,
    status: execution.requiresApproval ? 'blocked' : 'completed',
    requestedBy: task.currentMinistry ?? executionMinistry,
    reason: execution.summary,
    blockedReason: execution.requiresApproval ? execution.summary : undefined,
    serverId: execution.serverId,
    capabilityId: execution.capabilityId,
    approvalRequired: execution.requiresApproval,
    riskLevel: execution.tool?.riskLevel
  });
  appendExecutionEvidence(task, execution.toolName, execution.executionResult);
  callbacks.addTrace(task, 'execute', execution.summary, {
    ministry: task.currentMinistry,
    intent: execution.intent,
    toolName: execution.toolName,
    requiresApproval: execution.requiresApproval,
    llmConfigured,
    retryCount: state.retryCount,
    serverId: execution.executionResult?.serverId,
    capabilityId: execution.executionResult?.capabilityId,
    transportUsed: execution.executionResult?.transportUsed,
    fallbackUsed: execution.executionResult?.fallbackUsed,
    ...(execution.executionResult?.rawOutput && typeof execution.executionResult.rawOutput === 'object'
      ? (execution.executionResult.rawOutput as Record<string, unknown>)
      : {})
  });
  const approvalReasonCode =
    'approvalReasonCode' in execution && typeof execution.approvalReasonCode === 'string'
      ? execution.approvalReasonCode
      : undefined;
  if (approvalReasonCode === 'watchdog_timeout' || approvalReasonCode === 'watchdog_interaction_required') {
    callbacks.addTrace(task, 'node_progress', '兵部看门狗触发运行时治理中断。', {
      ministry: task.currentMinistry,
      toolName: execution.toolName,
      approvalReasonCode,
      serverId: execution.serverId,
      capabilityId: execution.capabilityId
    });
    callbacks.addProgressDelta(
      task,
      `兵部看门狗已触发：${execution.toolName} 出现停滞或交互阻塞，已转入运行时治理。`,
      AgentRole.EXECUTOR
    );
  }
  callbacks.addProgressDelta(task, `执行进展：${execution.summary}`, AgentRole.EXECUTOR);

  if (execution.requiresApproval) {
    markExecutionStepBlocked(task, 'approval-interrupt', execution.summary, '执行链已暂停等待审批。', 'system');
    task.sandboxState = {
      ...task.sandboxState,
      status: 'running',
      verdict: 'retry',
      updatedAt: new Date().toISOString()
    };
    pauseExecutionForApproval({
      task,
      pendingExecutions,
      researchSummary: state.researchSummary ?? '',
      execution: {
        intent: execution.intent,
        toolName: execution.toolName,
        summary: execution.summary,
        serverId: execution.serverId,
        capabilityId: execution.capabilityId,
        approvalReason:
          'approvalReason' in execution && typeof execution.approvalReason === 'string'
            ? execution.approvalReason
            : undefined,
        approvalReasonCode:
          'approvalReasonCode' in execution && typeof execution.approvalReasonCode === 'string'
            ? execution.approvalReasonCode
            : undefined,
        approvalPreview: execution.approvalPreview,
        tool: execution.tool
      },
      callbacks: {
        transitionQueueState: callbacks.transitionQueueState,
        setSubTaskStatus: callbacks.setSubTaskStatus,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        describeActionIntent: callbacks.describeActionIntent
      }
    });
  } else {
    completeSkillStep(task, 'execute');
    callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
    markExecutionStepCompleted(task, 'execution', execution.summary);
    task.sandboxState = {
      ...task.sandboxState,
      status: 'passed',
      verdict: 'safe',
      updatedAt: new Date().toISOString()
    };
  }

  await callbacks.persistAndEmitTask(task);
  return {
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
}

export { buildCurrentSkillExecution } from './runtime-stage-helpers';
