import { listSubgraphDescriptors, listWorkflowVersions } from '@agent/agents-supervisor';
import type { RuntimeProfile } from '@agent/config';
import type { ApprovalScopePolicyRecord, ChatCheckpointRecord, ChatSessionRecord } from '@agent/core';
import { getMinistryDisplayName, getSpecialistDisplayName } from '../helpers/runtime-architecture-helpers';

import { deriveRecentAgentErrors } from '../helpers/runtime-agent-errors';
import { buildModelHeatmap } from '../../modules/runtime-metrics/services/runtime-analytics';
import { summarizeAndPersistUsageAnalytics } from '../../modules/runtime-metrics/services/runtime-metrics-store';
import type { DailyTechBriefingStatusRecord } from '../briefings/runtime-tech-briefing.types';

export interface RuntimeCenterTaskLike {
  id: string;
  goal: string;
  context?: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  sessionId?: string;
  currentNode?: string;
  currentStep?: string;
  currentMinistry?: string;
  currentWorker?: string;
  mainChainNode?: string;
  microLoopCount?: number;
  maxMicroLoops?: number;
  microLoopState?: unknown;
  modeGateState?: unknown;
  budgetGateState?: unknown;
  complexTaskPlan?: unknown;
  blackboardState?: unknown;
  contextFilterState?: {
    filteredContextSlice?: {
      summary?: string;
    };
  };
  criticState?: unknown;
  guardrailState?: unknown;
  sandboxState?: unknown;
  finalReviewState?: unknown;
  knowledgeIndexState?: unknown;
  revisionState?: unknown;
  governanceScore?: {
    status?: string;
    score?: number;
    summary?: string;
    trustAdjustment?: string;
    recommendedLearningTargets?: string[];
  };
  governanceReport?: {
    summary?: string;
    reviewOutcome: {
      decision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval' | 'blocked' | 'approved' | 'retry';
      summary?: string;
    };
    evidenceSufficiency?: unknown;
    sandboxReliability?: unknown;
  };
  evaluationReport?: {
    id?: string;
    score?: number;
    summary?: string;
  };
  learningEvaluation?: {
    recommendedCandidateIds?: string[];
    autoConfirmCandidateIds?: string[];
    governanceWarnings?: string[];
  };
  executionPlan?: {
    strategyCounselors?: string[];
    executionMinistries?: string[];
  };
  dispatches?: Array<{
    kind?: string;
  }>;
  queueState?: {
    backgroundRun?: boolean;
    leaseOwner?: string;
    leaseExpiresAt?: string;
    status?: string;
  };
  interruptHistory?: Array<{
    timedOutAt?: string;
  }>;
  activeInterrupt?: {
    status?: string;
    createdAt: string;
  };
  entryDecision?: unknown;
  externalSources?: Array<{
    sourceType?: string;
    summary?: string;
  }>;
  trace?: Array<{
    node?: string;
    summary?: string;
    at: string;
    data?: Record<string, unknown>;
  }>;
  approvals: Array<{
    decision?: string;
  }>;
  reusedMemories?: unknown[];
  skillId?: string;
  result?: string;
  plan?: {
    summary?: string;
  };
  messages?: Array<{
    content?: string;
  }>;
  retryCount?: number;
  modelRoute?: Array<{
    ministry?: string;
    selectedModel?: string;
  }>;
  llmUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    measuredCallCount?: number;
    estimatedCallCount?: number;
    updatedAt?: string;
    models: Array<{
      model: string;
      totalTokens: number;
      costUsd?: number;
      costCny?: number;
      pricingSource?: string;
      callCount: number;
    }>;
  };
}

function toCritiqueStyleReviewOutcome(
  reviewOutcome: NonNullable<NonNullable<RuntimeCenterTaskLike['governanceReport']>['reviewOutcome']>
) {
  return {
    ...reviewOutcome,
    decision:
      reviewOutcome.decision === 'blocked'
        ? 'block'
        : reviewOutcome.decision === 'approved' || reviewOutcome.decision === 'retry'
          ? 'pass'
          : reviewOutcome.decision
  };
}

export function buildRuntimeCenter(input: {
  profile: RuntimeProfile;
  policy: {
    approvalMode: 'strict' | 'balanced' | 'auto';
    skillInstallMode: 'manual' | 'low-risk-auto';
    learningMode: 'controlled' | 'aggressive';
    sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed';
    budget: {
      stepBudget: number;
      retryBudget: number;
      sourceBudget: number;
    };
  };
  tasks: RuntimeCenterTaskLike[];
  sessions: ChatSessionRecord[];
  pendingApprovals: Array<{ id: string }>;
  usageAnalytics: Awaited<ReturnType<typeof summarizeAndPersistUsageAnalytics>>;
  recentGovernanceAudit?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope:
      | 'skill-source'
      | 'company-worker'
      | 'skill-install'
      | 'connector'
      | 'approval-policy'
      | 'counselor-selector'
      | 'learning-conflict';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  approvalScopePolicies?: ApprovalScopePolicyRecord[];
  backgroundWorkerPoolSize: number;
  backgroundWorkerSlots: Map<string, { taskId: string; startedAt: string }>;
  filteredRecentRuns: RuntimeCenterTaskLike[];
  getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
  knowledgeOverview?: {
    stores: Array<{
      id: string;
      store: 'wenyuan' | 'cangjing';
      displayName: string;
      summary: string;
      rootPath?: string;
      status: 'active' | 'degraded' | 'readonly';
      updatedAt: string;
    }>;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    sourceCount: number;
    chunkCount: number;
    embeddingCount: number;
    latestReceipts: Array<{
      id: string;
      sourceId: string;
      status: 'completed' | 'partial' | 'failed';
      chunkCount: number;
      embeddedChunkCount: number;
      updatedAt: string;
    }>;
  };
  dailyTechBriefing?: DailyTechBriefingStatusRecord;
}) {
  // task.entryDecision is the persisted 通政司 / EntryRouter projection.
  // task.activeInterrupt and task.interruptHistory are persisted 司礼监 / InterruptController projections.
  const activeTasks = input.tasks.filter(task =>
    ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
  );
  const activeMinistries = Array.from(
    new Set(
      activeTasks.map(task => getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry).filter(Boolean)
    )
  ) as string[];
  const activeWorkers = Array.from(new Set(activeTasks.map(task => task.currentWorker).filter(Boolean))) as string[];

  return {
    runtimeProfile: input.profile,
    policy: input.policy,
    taskCount: input.tasks.length,
    activeTaskCount: activeTasks.length,
    backgroundRunCount: input.tasks.filter(task => task.queueState?.backgroundRun).length,
    foregroundRunCount: input.tasks.filter(task => !task.queueState?.backgroundRun).length,
    leasedBackgroundRunCount: input.tasks.filter(task => task.queueState?.backgroundRun && task.queueState?.leaseOwner)
      .length,
    staleLeaseCount: input.tasks.filter(task => {
      const leaseExpiresAt = task.queueState?.leaseExpiresAt;
      return Boolean(
        task.queueState?.backgroundRun &&
        task.queueState?.status === 'running' &&
        leaseExpiresAt &&
        new Date(leaseExpiresAt).getTime() <= Date.now()
      );
    }).length,
    queueDepth: input.tasks.filter(task => String(task.status) === 'queued').length,
    blockedRunCount: input.tasks.filter(task => String(task.status) === 'blocked').length,
    workerPoolSize: input.backgroundWorkerPoolSize,
    activeWorkerSlotCount: input.backgroundWorkerSlots.size,
    availableWorkerSlotCount: Math.max(0, input.backgroundWorkerPoolSize - input.backgroundWorkerSlots.size),
    activeWorkerSlots: [...input.backgroundWorkerSlots.entries()].map(([slotId, slot]) => ({
      slotId,
      taskId: slot.taskId,
      startedAt: slot.startedAt
    })),
    budgetExceededCount: input.tasks.filter(task => task.currentStep === 'budget_exhausted').length,
    interruptTimeoutCount: input.tasks.filter(task =>
      (task.interruptHistory ?? []).some(interrupt => Boolean(interrupt.timedOutAt))
    ).length,
    waitingInterruptAverageMinutes:
      input.tasks
        .filter(task => task.activeInterrupt?.status === 'pending')
        .reduce((sum, task) => sum + (Date.now() - new Date(task.activeInterrupt!.createdAt).getTime()) / 60_000, 0) /
      Math.max(1, input.tasks.filter(task => task.activeInterrupt?.status === 'pending').length),
    pendingApprovalCount: input.pendingApprovals.length,
    sessionCount: input.sessions.length,
    activeSessionCount: input.sessions.filter(session =>
      ['running', 'waiting_approval', 'waiting_learning_confirmation'].includes(String(session.status))
    ).length,
    activeMinistries,
    activeWorkers,
    knowledgeOverview: input.knowledgeOverview,
    subgraphs: listSubgraphDescriptors(),
    workflowVersions: listWorkflowVersions(),
    usageAnalytics: input.usageAnalytics,
    recentGovernanceAudit: input.recentGovernanceAudit,
    approvalScopePolicies: input.approvalScopePolicies ?? [],
    dailyTechBriefing: input.dailyTechBriefing,
    streamMonitor: input.filteredRecentRuns.slice(0, 8).map(task => {
      const checkpoint = task.sessionId ? input.getCheckpoint(task.sessionId) : undefined;
      return {
        taskId: task.id,
        goal: task.goal,
        currentNode: checkpoint?.streamStatus?.nodeLabel ?? checkpoint?.streamStatus?.nodeId ?? task.currentNode,
        detail: checkpoint?.streamStatus?.detail ?? task.contextFilterState?.filteredContextSlice?.summary,
        progressPercent: checkpoint?.streamStatus?.progressPercent,
        updatedAt: checkpoint?.streamStatus?.updatedAt ?? task.updatedAt
      };
    }),
    recentAgentErrors: deriveRecentAgentErrors(input.tasks),
    diagnosisEvidenceCount: input.tasks.reduce(
      (count, task) =>
        count + (task.externalSources?.filter(source => source.sourceType === 'diagnosis_result').length ?? 0),
      0
    ),
    thoughtGraphs: input.filteredRecentRuns
      .map(task => {
        const checkpoint = task.sessionId ? input.getCheckpoint(task.sessionId) : undefined;
        if (!checkpoint?.thoughtGraph) {
          return undefined;
        }
        return {
          taskId: task.id,
          goal: task.goal,
          currentMinistry: task.currentMinistry,
          currentNode: task.currentNode,
          graph: checkpoint.thoughtGraph
        };
      })
      .filter(Boolean),
    modelHeatmap: buildModelHeatmap(input.tasks),
    imperialChain: input.filteredRecentRuns.slice(0, 20).map(task => ({
      taskId: task.id,
      goal: task.goal,
      node: task.mainChainNode,
      modeGateState: task.modeGateState,
      budgetGateState: task.budgetGateState,
      complexTaskPlan: task.complexTaskPlan,
      blackboardState: task.blackboardState,
      contextFilterState: task.contextFilterState,
      streamStatus: task.sessionId ? input.getCheckpoint(task.sessionId)?.streamStatus : undefined,
      criticState: task.criticState,
      guardrailState: task.guardrailState,
      sandboxState: task.sandboxState,
      finalReviewState: task.finalReviewState,
      knowledgeIndexState: task.knowledgeIndexState,
      dispatches: task.dispatches ?? [],
      governanceScore: task.governanceScore
    })),
    strategyCounselors: input.filteredRecentRuns.slice(0, 20).map(task => ({
      taskId: task.id,
      goal: task.goal,
      counselors: (task.executionPlan?.strategyCounselors ?? []).map(domain => ({
        id: domain,
        displayName: getSpecialistDisplayName({ domain, goal: task.goal, context: task.context }) ?? domain
      }))
    })),
    executionSpans: input.filteredRecentRuns.slice(0, 20).map(task => ({
      taskId: task.id,
      ministries: (task.executionPlan?.executionMinistries ?? [])
        .map(ministry => getMinistryDisplayName(ministry) ?? ministry)
        .filter(Boolean),
      currentMinistry: getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
      microLoopCount: task.microLoopCount ?? 0,
      maxMicroLoops: task.maxMicroLoops ?? 0,
      microLoopState: task.microLoopState,
      sandboxState: task.sandboxState,
      dispatchKinds: Array.from(new Set((task.dispatches ?? []).map(dispatch => dispatch.kind)))
    })),
    interruptLedger: input.filteredRecentRuns.slice(0, 20).map(task => ({
      taskId: task.id,
      activeInterrupt: task.activeInterrupt,
      interruptHistory: task.interruptHistory ?? [],
      entryRouterState: task.entryDecision,
      interruptControllerState: {
        activeInterrupt: task.activeInterrupt,
        interruptHistory: task.interruptHistory ?? []
      },
      revisionState: task.revisionState
    })),
    libuScorecards: input.filteredRecentRuns
      .filter(task => task.evaluationReport)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        reportId: task.evaluationReport?.id,
        score: task.evaluationReport?.score,
        summary: task.evaluationReport?.summary
      })),
    governanceScorecards: input.filteredRecentRuns
      .filter(task => task.governanceScore)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        status: task.governanceScore?.status,
        score: task.governanceScore?.score,
        summary: task.governanceScore?.summary,
        trustAdjustment: task.governanceScore?.trustAdjustment,
        recommendedLearningTargets: task.governanceScore?.recommendedLearningTargets ?? [],
        governanceReport: task.governanceReport
          ? {
              summary: task.governanceReport.summary,
              reviewOutcome: toCritiqueStyleReviewOutcome(task.governanceReport.reviewOutcome),
              evidenceSufficiency: task.governanceReport.evidenceSufficiency,
              sandboxReliability: task.governanceReport.sandboxReliability
            }
          : undefined
      })),
    shiluAdjustments: input.filteredRecentRuns
      .filter(task => task.learningEvaluation)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        recommendedCandidateIds: task.learningEvaluation?.recommendedCandidateIds ?? [],
        autoConfirmCandidateIds: task.learningEvaluation?.autoConfirmCandidateIds ?? [],
        governanceWarnings: task.learningEvaluation?.governanceWarnings ?? []
      })),
    recentRuns: input.filteredRecentRuns
  };
}
