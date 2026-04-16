import type { ApprovalPolicyRecord, ApprovalScopePolicyRecord, ConnectorHealthRecord } from './governance';
import type { ExecutionTrace, EvidenceRecord } from './knowledge';
import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from './skills';
import type { RuntimeProfile, TaskStatus } from './primitives';
import type { TaskRecord } from './tasking';
import type {
  RuntimeCenterKnowledgeOverviewRecord,
  RuntimeCenterSubgraphRecord,
  RuntimeCenterUsageAnalyticsRecord,
  RuntimeCenterWorkflowVersionRecord
} from './runtime-centers-analytics';
import type { RuntimeCenterDailyTechBriefingRecord } from './runtime-centers-briefing';
import type {
  RuntimeCenterExecutionSpanRecord,
  RuntimeCenterGovernanceScorecardRecord,
  RuntimeCenterImperialChainRecord,
  RuntimeCenterInterruptLedgerRecord,
  RuntimeCenterRecentAgentErrorDetailsRecord,
  RuntimeCenterThoughtGraphRecord
} from './runtime-centers-execution';
import type { RuntimeCenterToolsRecord } from './runtime-centers-tools';

export { type RuntimeCenterUsageAnalyticsRecord } from './runtime-centers-analytics';
export { type RuntimeCenterDailyTechBriefingRecord } from './runtime-centers-briefing';
export {
  type RuntimeCenterExecutionSpanRecord,
  type RuntimeCenterGovernanceScorecardRecord,
  type RuntimeCenterImperialChainRecord,
  type RuntimeCenterInterruptLedgerRecord,
  type RuntimeCenterRecentAgentErrorDetailsRecord,
  type RuntimeCenterThoughtGraphRecord
} from './runtime-centers-execution';
export { type RuntimeCenterToolsRecord } from './runtime-centers-tools';

export const RUNTIME_CENTER_PAGE_TITLES = {
  runtime: 'Runtime Center',
  approvals: 'Approvals Center',
  learning: 'Learning Center',
  memory: 'Memory Center',
  profiles: 'Profile Center',
  evals: 'Evals',
  archives: 'Archive Center',
  skills: 'Skill Lab',
  evidence: 'Evidence Center',
  connectors: 'Connector & Policy Center',
  skillSources: 'Skill Sources / Marketplace',
  companyAgents: 'Company Agents'
} as const;

export type RuntimeCenterPageKey = keyof typeof RUNTIME_CENTER_PAGE_TITLES;

export interface RuntimeCenterAppliedFilters {
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
}

export interface RuntimeCenterStreamMonitorRecord {
  taskId: string;
  goal: string;
  currentNode?: string;
  detail?: string;
  progressPercent?: number;
  updatedAt: string;
}

export interface RuntimeCenterRecentAgentErrorRecord {
  taskId: string;
  goal: string;
  summary: string;
  status?: TaskStatus | string;
  updatedAt: string;
}

export interface RuntimeCenterGovernanceSnapshotRecord {
  capabilityGovernanceProfiles?: CapabilityGovernanceProfileRecord[];
  ministryGovernanceProfiles?: GovernanceProfileRecord[];
  workerGovernanceProfiles?: GovernanceProfileRecord[];
  specialistGovernanceProfiles?: GovernanceProfileRecord[];
}

export interface RuntimeCenterConnectorPolicyRecord {
  connectorId: string;
  healthChecks: ConnectorHealthRecord[];
  approvalPolicies: ApprovalPolicyRecord[];
  approvalScopePolicies?: ApprovalScopePolicyRecord[];
}

export interface RuntimeCenterEvidenceSummaryRecord {
  diagnosisEvidenceCount: number;
  evidence: EvidenceRecord[];
  trace?: ExecutionTrace[];
}

export interface RuntimeCenterRecord {
  runtimeProfile?: RuntimeProfile | string;
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
  appliedFilters?: RuntimeCenterAppliedFilters;
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
  streamMonitor?: RuntimeCenterStreamMonitorRecord[];
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
