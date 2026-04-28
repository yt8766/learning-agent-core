import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import type { EvidenceRecord } from '../contracts';

import type { RuntimeStateTaskRecord } from './runtime-state-task.types';

type RuntimeStateLooseRecord = Record<string, unknown>;

type RuntimeStateApprovalScopePolicyRecord = {
  id: string;
  scope: 'session' | 'always';
  status: 'active' | 'revoked';
  matchKey: string;
  createdAt: string;
  updatedAt: string;
  intent?: string;
  toolName?: string;
  riskCode?: string;
  requestedBy?: string;
  grantedBy?: string;
  reason?: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  lastMatchedAt?: string;
  matchCount?: number;
  [key: string]: unknown;
};

type RuntimeStateLearningEvaluationRecord = {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  notes: string[];
  recommendedCandidateIds: string[];
  autoConfirmCandidateIds: string[];
  sourceSummary: {
    externalSourceCount: number;
    internalSourceCount: number;
    reusedMemoryCount: number;
    reusedRuleCount: number;
    reusedSkillCount: number;
  };
  [key: string]: unknown;
};

export interface RuntimeStateLearningJob {
  id: string;
  sourceType:
    | 'execution'
    | 'document'
    | 'research'
    | 'memory'
    | 'official-docs'
    | 'repo'
    | 'community'
    | 'web'
    | 'market';
  status: 'queued' | 'running' | 'completed' | 'failed';
  documentUri: string;
  goal?: string;
  workflowId?: string;
  preferredUrls?: string[];
  summary?: string;
  sources?: EvidenceRecord[];
  trustSummary?: Partial<Record<'official' | 'curated' | 'community' | 'unverified' | 'internal', number>>;
  learningEvaluation?: RuntimeStateLearningEvaluationRecord;
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeStateLearningQueueItem {
  id: string;
  taskId: string;
  runId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  mode?: 'task-learning' | 'dream-task';
  priority?: 'high' | 'normal';
  reason?: 'high_risk_failure' | 'rollback' | 'timeout_defaulted' | 'blocked_review' | 'normal' | 'dream-task';
  selectedCounselorId?: string;
  selectedVersion?: string;
  trace: RuntimeStateLooseRecord[];
  aggregationResult?: string;
  userFeedback?: string;
  capabilityUsageStats?: {
    toolCount: number;
    workerCount: number;
    totalTokens?: number;
    totalCostUsd?: number;
  };
  queuedAt: string;
  updatedAt: string;
}

type ActionIntentValue = string;

export interface PendingExecutionRecord {
  taskId: string;
  intent: ActionIntentValue;
  toolName: string;
  researchSummary: string;
}

export interface ChannelDeliveryRecord {
  id: string;
  channel: string;
  channelChatId: string;
  sessionId?: string;
  taskId?: string;
  segment: RuntimeStateLooseRecord;
  status: 'queued' | 'sent' | 'failed';
  attemptCount?: number;
  queuedAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  failureReason?: string;
}

export interface RuntimeStateSnapshot {
  tasks: RuntimeStateTaskRecord[];
  learningJobs: RuntimeStateLearningJob[];
  learningQueue?: RuntimeStateLearningQueueItem[];
  pendingExecutions: PendingExecutionRecord[];
  channelDeliveries: ChannelDeliveryRecord[];
  chatSessions: RuntimeStateLooseRecord[];
  chatMessages: RuntimeStateLooseRecord[];
  chatEvents: RuntimeStateLooseRecord[];
  chatCheckpoints: RuntimeStateLooseRecord[];
  crossCheckEvidence?: Array<{
    memoryId: string;
    record: EvidenceRecord;
  }>;
  workspaceSkillReuseRecords?: RuntimeStateLooseRecord[];
  governance?: {
    disabledSkillSourceIds?: string[];
    disabledCompanyWorkerIds?: string[];
    disabledConnectorIds?: string[];
    configuredConnectors?: RuntimeStateLooseRecord[];
    connectorDiscoveryHistory?: RuntimeStateLooseRecord[];
    connectorPolicyOverrides?: Array<{
      connectorId: string;
      effect: 'allow' | 'deny' | 'require-approval' | 'observe';
      reason?: string;
      updatedAt: string;
      updatedBy?: string;
    }>;
    capabilityPolicyOverrides?: Array<{
      capabilityId: string;
      connectorId: string;
      effect: 'allow' | 'deny' | 'require-approval' | 'observe';
      reason?: string;
      updatedAt: string;
      updatedBy?: string;
    }>;
    capabilityGovernanceProfiles?: RuntimeStateLooseRecord[];
    ministryGovernanceProfiles?: RuntimeStateLooseRecord[];
    workerGovernanceProfiles?: RuntimeStateLooseRecord[];
    specialistGovernanceProfiles?: RuntimeStateLooseRecord[];
    counselorSelectorConfigs?: RuntimeStateLooseRecord[];
    approvalScopePolicies?: RuntimeStateApprovalScopePolicyRecord[];
    learningConflictScan?: Record<string, unknown>;
  };
  governanceAudit?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope:
      | 'skill-source'
      | 'company-worker'
      | 'skill-install'
      | 'connector'
      | 'counselor-selector'
      | 'learning-conflict'
      | 'approval-policy';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  usageHistory?: Array<{
    day: string;
    tokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
    overBudget?: boolean;
    measuredRunCount?: number;
    estimatedRunCount?: number;
    updatedAt: string;
  }>;
  evalHistory?: Array<{
    day: string;
    runCount: number;
    passCount: number;
    passRate: number;
    scenarioCount: number;
    overallPassRate: number;
    updatedAt: string;
  }>;
  usageAudit?: Array<{
    taskId: string;
    day: string;
    modelBreakdown: Array<{
      model: string;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      pricingSource?: 'provider' | 'estimated';
      callCount: number;
    }>;
    totalTokens: number;
    totalCostUsd: number;
    totalCostCny: number;
    measuredCallCount: number;
    estimatedCallCount: number;
    updatedAt: string;
  }>;
}

export interface RuntimeStateRepository {
  load(): Promise<RuntimeStateSnapshot>;
  save(snapshot: RuntimeStateSnapshot): Promise<void>;
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function formatRuntimeStateLoadError(filePath: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to load runtime state snapshot from ${filePath}: ${message}`);
}

export class FileRuntimeStateRepository implements RuntimeStateRepository {
  private readonly filePath: string;

  constructor(filePath = loadSettings().tasksStateFilePath) {
    this.filePath = resolve(filePath);
  }

  async load(): Promise<RuntimeStateSnapshot> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RuntimeStateSnapshot>;
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        learningJobs: Array.isArray(parsed.learningJobs) ? parsed.learningJobs : [],
        learningQueue: Array.isArray(parsed.learningQueue) ? parsed.learningQueue : [],
        pendingExecutions: Array.isArray(parsed.pendingExecutions) ? parsed.pendingExecutions : [],
        channelDeliveries: Array.isArray(parsed.channelDeliveries) ? parsed.channelDeliveries : [],
        chatSessions: Array.isArray(parsed.chatSessions) ? parsed.chatSessions : [],
        chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
        chatEvents: Array.isArray(parsed.chatEvents) ? parsed.chatEvents : [],
        chatCheckpoints: Array.isArray(parsed.chatCheckpoints) ? parsed.chatCheckpoints : [],
        crossCheckEvidence: Array.isArray(parsed.crossCheckEvidence) ? parsed.crossCheckEvidence : [],
        workspaceSkillReuseRecords: Array.isArray(parsed.workspaceSkillReuseRecords)
          ? parsed.workspaceSkillReuseRecords
          : [],
        governance: {
          disabledSkillSourceIds: Array.isArray(parsed.governance?.disabledSkillSourceIds)
            ? parsed.governance?.disabledSkillSourceIds
            : [],
          disabledCompanyWorkerIds: Array.isArray(parsed.governance?.disabledCompanyWorkerIds)
            ? parsed.governance?.disabledCompanyWorkerIds
            : [],
          disabledConnectorIds: Array.isArray(parsed.governance?.disabledConnectorIds)
            ? parsed.governance?.disabledConnectorIds
            : [],
          configuredConnectors: Array.isArray(parsed.governance?.configuredConnectors)
            ? parsed.governance?.configuredConnectors
            : [],
          connectorDiscoveryHistory: Array.isArray(parsed.governance?.connectorDiscoveryHistory)
            ? parsed.governance?.connectorDiscoveryHistory
            : [],
          connectorPolicyOverrides: Array.isArray(parsed.governance?.connectorPolicyOverrides)
            ? parsed.governance?.connectorPolicyOverrides
            : [],
          capabilityPolicyOverrides: Array.isArray(parsed.governance?.capabilityPolicyOverrides)
            ? parsed.governance?.capabilityPolicyOverrides
            : [],
          capabilityGovernanceProfiles: Array.isArray(parsed.governance?.capabilityGovernanceProfiles)
            ? parsed.governance?.capabilityGovernanceProfiles
            : [],
          ministryGovernanceProfiles: Array.isArray(parsed.governance?.ministryGovernanceProfiles)
            ? parsed.governance?.ministryGovernanceProfiles
            : [],
          workerGovernanceProfiles: Array.isArray(parsed.governance?.workerGovernanceProfiles)
            ? parsed.governance?.workerGovernanceProfiles
            : [],
          specialistGovernanceProfiles: Array.isArray(parsed.governance?.specialistGovernanceProfiles)
            ? parsed.governance?.specialistGovernanceProfiles
            : [],
          counselorSelectorConfigs: Array.isArray(parsed.governance?.counselorSelectorConfigs)
            ? parsed.governance?.counselorSelectorConfigs
            : [],
          approvalScopePolicies: Array.isArray(parsed.governance?.approvalScopePolicies)
            ? parsed.governance?.approvalScopePolicies
            : [],
          learningConflictScan:
            parsed.governance?.learningConflictScan && typeof parsed.governance.learningConflictScan === 'object'
              ? parsed.governance.learningConflictScan
              : {
                  scannedAt: '',
                  conflictPairs: [],
                  mergeSuggestions: [],
                  manualReviewQueue: []
                }
        },
        governanceAudit: Array.isArray(parsed.governanceAudit) ? parsed.governanceAudit : [],
        usageHistory: Array.isArray(parsed.usageHistory) ? parsed.usageHistory : [],
        evalHistory: Array.isArray(parsed.evalHistory) ? parsed.evalHistory : [],
        usageAudit: Array.isArray(parsed.usageAudit) ? parsed.usageAudit : []
      };
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw formatRuntimeStateLoadError(this.filePath, error);
      }

      return {
        tasks: [],
        learningJobs: [],
        learningQueue: [],
        pendingExecutions: [],
        channelDeliveries: [],
        chatSessions: [],
        chatMessages: [],
        chatEvents: [],
        chatCheckpoints: [],
        crossCheckEvidence: [],
        workspaceSkillReuseRecords: [],
        governance: {
          disabledSkillSourceIds: [],
          disabledCompanyWorkerIds: [],
          disabledConnectorIds: [],
          configuredConnectors: [],
          connectorDiscoveryHistory: [],
          connectorPolicyOverrides: [],
          capabilityPolicyOverrides: [],
          capabilityGovernanceProfiles: [],
          ministryGovernanceProfiles: [],
          workerGovernanceProfiles: [],
          specialistGovernanceProfiles: [],
          counselorSelectorConfigs: [],
          approvalScopePolicies: [],
          learningConflictScan: {
            scannedAt: '',
            conflictPairs: [],
            mergeSuggestions: [],
            manualReviewQueue: []
          }
        },
        governanceAudit: [],
        usageHistory: [],
        evalHistory: [],
        usageAudit: []
      };
    }
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
    await rename(tempPath, this.filePath);
  }
}
