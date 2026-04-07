import { EvidenceRecord, TaskRecord } from '@agent/shared';

export interface RecentQuarantinedMemory {
  id: string;
  summary: string;
  quarantineReason?: string;
  quarantineCategory?: string;
  quarantineReasonDetail?: string;
  quarantineRestoreSuggestion?: string;
  quarantinedAt?: string;
}

export interface CrossCheckEvidenceEntry {
  memoryId: string;
  record: EvidenceRecord;
}

export interface LocalSkillSuggestionsRecord {
  taskId: string;
  goal: string;
  suggestions: unknown[];
  gapSummary?: string;
  profile?: string;
  usedInstalledSkills?: string[];
}

export interface RuntimeGovernanceSnapshotRecord {
  governance?: {
    capabilityGovernanceProfiles?: Array<{
      capabilityId: string;
      displayName: string;
      ownerType: string;
      kind: string;
      trustLevel: 'high' | 'medium' | 'low';
      trustTrend: 'up' | 'steady' | 'down';
      reportCount: number;
      promoteCount: number;
      holdCount: number;
      downgradeCount: number;
      passCount: number;
      reviseRequiredCount: number;
      blockCount: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      lastTrustAdjustment?: 'promote' | 'hold' | 'downgrade';
      lastReason?: string;
      lastGovernanceSummary?: string;
      updatedAt: string;
    }>;
    ministryGovernanceProfiles?: Array<{
      entityId: string;
      displayName: string;
      entityKind: 'ministry';
      trustLevel: 'high' | 'medium' | 'low';
      trustTrend: 'up' | 'steady' | 'down';
      reportCount: number;
      promoteCount: number;
      holdCount: number;
      downgradeCount: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      lastReason?: string;
      updatedAt: string;
    }>;
    workerGovernanceProfiles?: Array<{
      entityId: string;
      displayName: string;
      entityKind: 'worker';
      trustLevel: 'high' | 'medium' | 'low';
      trustTrend: 'up' | 'steady' | 'down';
      reportCount: number;
      promoteCount: number;
      holdCount: number;
      downgradeCount: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      lastReason?: string;
      updatedAt: string;
    }>;
    specialistGovernanceProfiles?: Array<{
      entityId: string;
      displayName: string;
      entityKind: 'specialist';
      trustLevel: 'high' | 'medium' | 'low';
      trustTrend: 'up' | 'steady' | 'down';
      reportCount: number;
      promoteCount: number;
      holdCount: number;
      downgradeCount: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      lastReason?: string;
      updatedAt: string;
    }>;
    counselorSelectorConfigs?: Array<{
      selectorId: string;
      domain: string;
      enabled: boolean;
      strategy: string;
      candidateIds: string[];
      weights?: number[];
      featureFlag?: string;
      defaultCounselorId: string;
      createdAt: string;
      updatedAt: string;
    }>;
    learningConflictScan?: {
      scannedAt?: string;
      conflictPairs?: Array<{
        id: string;
        contextSignature: string;
        conflictSetId?: string;
        memoryIds: string[];
        severity: 'low' | 'medium' | 'high';
        resolution: 'auto_preferred' | 'lightweight_review_required' | 'plan_question_required';
        effectivenessSpread: number;
        status?: string;
      }>;
      mergeSuggestions?: Array<{
        conflictId: string;
        preferredMemoryId?: string;
        loserMemoryIds: string[];
        suggestion: string;
      }>;
      manualReviewQueue?: Array<{
        id: string;
        contextSignature: string;
        memoryIds: string[];
        severity: 'low' | 'medium' | 'high';
        resolution: 'auto_preferred' | 'lightweight_review_required' | 'plan_question_required';
        preferredMemoryId?: string;
        effectivenessSpread?: number;
        status?: string;
      }>;
    };
  };
}

export interface BuildLearningCenterInput {
  tasks: TaskRecord[];
  jobs: any[];
  wenyuanOverviewPromise?: Promise<{
    store: 'wenyuan';
    rootPath: string;
    memoryCount: number;
    sessionCount: number;
    checkpointCount: number;
    traceCount: number;
    governanceHistoryCount: number;
    updatedAt: string;
  }>;
  knowledgeOverviewPromise?: Promise<{
    sourceCount: number;
    chunkCount: number;
    embeddingCount: number;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    latestReceipts: Array<{
      id: string;
      status: string;
      updatedAt: string;
    }>;
  }>;
  learningQueue?: Array<{
    id: string;
    taskId: string;
    status: string;
    mode?: 'task-learning' | 'dream-task';
    queuedAt: string;
    updatedAt: string;
    priority?: string;
    summary?: string;
    candidateSummary?: string;
    startedAt?: string;
    finishedAt?: string;
    selectedCounselorId?: string;
    selectedVersion?: string;
    capabilityUsageStats?: {
      toolCount: number;
      workerCount: number;
      totalTokens?: number;
      totalCostUsd?: number;
    };
  }>;
  memoryStatsPromise: Promise<{
    invalidated: number;
    quarantined: number;
    recentQuarantined: RecentQuarantinedMemory[];
  }>;
  invalidatedRulesPromise: Promise<number>;
  crossCheckEvidencePromise: Promise<CrossCheckEvidenceEntry[]>;
  governanceSnapshotPromise?: Promise<RuntimeGovernanceSnapshotRecord>;
  resolveLocalSkillSuggestions: (task: TaskRecord) => Promise<{
    suggestions: unknown[];
    gapSummary?: string;
    profile?: string;
    usedInstalledSkills?: string[];
  }>;
}
