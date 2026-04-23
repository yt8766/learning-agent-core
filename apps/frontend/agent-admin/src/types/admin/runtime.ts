import type { ApprovalScopePolicyRecord } from './governance';
import type { RuntimeCenterUsageAnalyticsRecord } from './runtime-usage.types';
import type { RuntimeCenterDailyTechBriefingRecord } from './runtime-briefing.types';
import type {
  RuntimeCenterThoughtGraphRecord,
  RuntimeCenterImperialChainRecord,
  RuntimeCenterExecutionSpanRecord,
  RuntimeCenterInterruptLedgerRecord,
  RuntimeCenterPlannerStrategyRecord,
  RuntimeCenterGovernanceScorecardRecord,
  RuntimeCenterRecentAgentErrorDetailsRecord,
  RuntimeCenterToolsRecord
} from './runtime-observability.types';
import type { TaskRecord } from './shared';

export type * from './runtime-usage.types';
export type * from './runtime-briefing.types';
export type * from './runtime-observability.types';

export interface RuntimeCenterKnowledgeOverviewRecord {
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
}

export interface RuntimeCenterSubgraphRecord {
  id: string;
  displayName: string;
  description: string;
  owner: string;
  entryNodes: string[];
}

export interface RuntimeCenterWorkflowVersionRecord {
  workflowId: string;
  version: string;
  status: 'draft' | 'published' | 'active' | 'deprecated';
  updatedAt: string;
  changelog?: string[];
}

export interface RuntimeCenterRecord {
  runtimeProfile?: string;
  policy?: {
    approvalMode: 'strict' | 'balanced' | 'auto' | string;
    skillInstallMode: 'manual' | 'low-risk-auto' | string;
    learningMode: 'controlled' | 'aggressive' | string;
    sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed' | string;
    budget:
      | {
          stepBudget: number;
          retryBudget: number;
          sourceBudget: number;
        }
      | Record<string, unknown>;
  };
  taskCount: number;
  activeTaskCount: number;
  backgroundRunCount?: number;
  foregroundRunCount?: number;
  leasedBackgroundRunCount?: number;
  staleLeaseCount?: number;
  workerPoolSize?: number;
  activeWorkerSlotCount?: number;
  availableWorkerSlotCount?: number;
  activeWorkerSlots?: Array<{
    slotId: string;
    taskId: string;
    startedAt: string;
  }>;
  queueDepth: number;
  blockedRunCount: number;
  budgetExceededCount?: number;
  interruptTimeoutCount?: number;
  waitingInterruptAverageMinutes?: number;
  pendingApprovalCount: number;
  sessionCount: number;
  activeSessionCount: number;
  activeMinistries: string[];
  activeWorkers: string[];
  knowledgeOverview?: RuntimeCenterKnowledgeOverviewRecord;
  subgraphs?: RuntimeCenterSubgraphRecord[];
  workflowVersions?: RuntimeCenterWorkflowVersionRecord[];
  appliedFilters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
  };
  usageAnalytics: RuntimeCenterUsageAnalyticsRecord;
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
  dailyTechBriefing?: RuntimeCenterDailyTechBriefingRecord;
  streamMonitor?: Array<{
    taskId: string;
    goal: string;
    currentNode?: string;
    detail?: string;
    progressPercent?: number;
    updatedAt: string;
  }>;
  diagnosisEvidenceCount?: number;
  thoughtGraphs?: RuntimeCenterThoughtGraphRecord[];
  modelHeatmap?: Array<{
    ministry: string;
    model: string;
    successRate: number | null;
    avgLatencyMs: number | null;
    avgCostUsd: number | null;
    retryRate: number | null;
  }>;
  imperialChain?: RuntimeCenterImperialChainRecord[];
  strategyCounselors?: Array<{
    taskId: string;
    goal: string;
    counselors: Array<{
      id: string;
      displayName: string;
    }>;
  }>;
  plannerStrategies?: RuntimeCenterPlannerStrategyRecord[];
  executionSpans?: RuntimeCenterExecutionSpanRecord[];
  interruptLedger?: RuntimeCenterInterruptLedgerRecord[];
  libuScorecards?: Array<{
    taskId: string;
    reportId?: string;
    score?: number;
    summary?: string;
  }>;
  governanceScorecards?: RuntimeCenterGovernanceScorecardRecord[];
  shiluAdjustments?: Array<{
    taskId: string;
    recommendedCandidateIds: string[];
    autoConfirmCandidateIds: string[];
    governanceWarnings: string[];
  }>;
  recentAgentErrors?: RuntimeCenterRecentAgentErrorDetailsRecord[];
  tools?: RuntimeCenterToolsRecord;
  recentRuns: TaskRecord[];
}
