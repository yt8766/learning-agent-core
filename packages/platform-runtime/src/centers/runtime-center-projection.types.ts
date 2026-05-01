import type { ChatSessionRecord } from '@agent/core';
import type { RuntimeProfile } from '@agent/config';
import type { ApprovalScopePolicyRecord, RuntimeKnowledgeSearchDiagnosticsSnapshot } from '@agent/runtime';
import type { summarizeAndPersistUsageAnalytics } from './runtime-metrics-store';

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
  plannerStrategy?: {
    mode?: 'default' | 'capability-gap' | 'rich-candidates';
    summary?: string;
    leadDomain?: string;
    requiredCapabilities?: string[];
    preferredAgentId?: string;
    candidateAgentIds?: string[];
    candidateCount?: number;
    gapDetected?: boolean;
    updatedAt?: string;
  };
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
      compressionApplied?: boolean;
      compressionSource?: string;
      compressedMessageCount?: number;
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
    status?: string;
    createdAt?: string;
    requestedBy?: string;
    source?: string;
    kind?: string;
    payload?: Record<string, unknown>;
  }>;
  activeInterrupt?: {
    status?: string;
    createdAt?: string;
    requestedBy?: string;
    source?: string;
    kind?: string;
    payload?: Record<string, unknown>;
  };
  pendingApproval?: {
    requestedBy?: string;
  };
  entryDecision?: unknown;
  executionMode?: string;
  streamStatus?: {
    nodeLabel?: string;
    nodeId?: string;
    detail?: string;
    progressPercent?: number;
  };
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

export interface BuildRuntimeCenterSummaryProjectionInput {
  tasks: RuntimeCenterTaskLike[];
  sessions: ChatSessionRecord[];
  pendingApprovals: Array<{ id: string }>;
  filteredRecentRuns: RuntimeCenterTaskLike[];
  getMinistryDisplayName: (ministry?: string) => string | undefined;
}

export interface RuntimeCenterKnowledgeSearchStatus {
  configuredMode: 'keyword-only' | 'vector-only' | 'hybrid';
  effectiveMode: 'keyword-only' | 'vector-only' | 'hybrid';
  vectorProviderId?: string;
  vectorConfigured: boolean;
  hybridEnabled: boolean;
  vectorProviderHealth?: {
    status: 'healthy' | 'degraded' | 'unknown';
    checkedAt: string;
    latencyMs?: number;
    message?: string;
    consecutiveFailures?: number;
  };
  keywordProviderHealth?: {
    status: 'healthy' | 'degraded' | 'unknown';
    checkedAt: string;
    latencyMs?: number;
    message?: string;
    consecutiveFailures?: number;
  };
  diagnostics: Array<{
    code: string;
    severity: 'info' | 'warning';
    message: string;
  }>;
  checkedAt: string;
}

export interface BuildRuntimeCenterProjectionInput extends BuildRuntimeCenterSummaryProjectionInput {
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
  getCheckpoint: (sessionId: string) => { streamStatus?: Record<string, unknown>; thoughtGraph?: unknown } | undefined;
  getSpecialistDisplayName: (input: { domain: string; goal: string; context?: string }) => string | undefined;
  deriveRecentAgentErrors: (tasks: RuntimeCenterTaskLike[]) => unknown[];
  listSubgraphDescriptors: () => unknown[];
  listWorkflowVersions: () => unknown[];
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
  knowledgeSearchStatus?: RuntimeCenterKnowledgeSearchStatus;
  knowledgeSearchLastDiagnostics?: RuntimeKnowledgeSearchDiagnosticsSnapshot;
  dailyTechBriefing?: unknown;
}
