import type { LocalSkillSuggestionRecord } from '@agent/core';
import type { EvidenceRecord, ResolutionCandidateRecord } from '@agent/memory';

export interface LearningCenterTaskLike {
  id: string;
  goal: string;
  createdAt?: string;
  updatedAt: string;
  status?: string;
  currentMinistry?: string;
  currentWorker?: string;
  interruptHistory?: unknown[];
  trace?: Array<{
    node?: string;
    summary?: string;
    at: string;
    data?: Record<string, unknown>;
  }>;
  externalSources?: Array<{
    id: string;
    sourceType?: string;
    summary?: string;
    trustClass?: string;
  }>;
  usedInstalledSkills?: string[];
  executionPlan?: {
    selectedCounselorId?: string;
    selectedVersion?: string;
  };
  entryDecision?: {
    counselorSelector?: {
      selectedCounselorId?: string;
      selectedVersion?: string;
    };
  };
  critiqueResult?: {
    decision?: string;
  };
  learningCandidates?: Array<{
    id: string;
    type?: string;
    summary?: string;
    status?: string;
    confidenceScore?: number;
    autoConfirmEligible?: boolean;
    provenance?: unknown[];
    payload?: unknown;
    createdAt: string;
  }>;
  learningEvaluation?: {
    score?: number;
    confidence?: number;
    candidateReasons?: string[];
    skippedReasons?: string[];
    conflictDetected?: boolean;
    conflictTargets?: string[];
    derivedFromLayers?: string[];
    policyMode?: string;
    expertiseSignals?: string[];
    rationale?: string;
    governanceWarnings?: string[];
    timeoutStats?: {
      count?: number;
      defaultAppliedCount?: number;
    };
    skillGovernanceRecommendations?: Array<{
      skillId: string;
      recommendation: string;
      successRate?: number;
      promotionState?: string;
    }>;
  };
  llmUsage?: {
    totalTokens?: number;
  };
  budgetState?: {
    costConsumedUsd?: number;
    budgetInterruptState?: {
      status?: string;
      reason?: string;
    };
  };
  learningQueueItemId?: string;
  governanceReport?: {
    summary?: string;
    reviewOutcome: {
      decision?: string;
      summary?: string;
    };
    trustAdjustment?: string;
    evidenceSufficiency?: {
      score?: number;
    };
    sandboxReliability?: {
      score?: number;
    };
  };
  evaluationReport?: {
    score?: number;
    summary?: string;
  };
  libuEvaluationReportId?: string;
  capabilityAttachments?: Array<{
    id: string;
    displayName: string;
    capabilityTrust?: {
      trustLevel?: 'high' | 'medium' | 'low';
      trustTrend?: 'up' | 'steady' | 'down';
      lastReason?: string;
      updatedAt?: string;
    };
    governanceProfile?: {
      reportCount?: number;
      promoteCount?: number;
      holdCount?: number;
      downgradeCount?: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      updatedAt?: string;
    };
    updatedAt?: string;
  }>;
}

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
  suggestions: LocalSkillSuggestionRecord[];
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

export interface LearningJobRecord {
  id?: string;
  taskId?: string;
  goal?: string;
  summary?: string;
  documentUri?: string;
  status?: string;
  sourceType?: string;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  updatedAt?: string;
  learningEvaluation?: {
    score?: number;
    confidence?: number;
    candidateReasons?: string[];
    skippedReasons?: string[];
    expertiseSignals?: string[];
  };
  sources?: Array<{
    detail?: unknown;
    replay?: unknown;
    [key: string]: unknown;
  }>;
}

export interface LearningRuleCandidateRecord {
  id: string;
  status?: string;
  autoConfirmEligible?: boolean;
  createdAt: string;
}

export interface BuildLearningCenterInput {
  tasks: LearningCenterTaskLike[];
  jobs: LearningJobRecord[];
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
  resolutionCandidatesPromise?: Promise<ResolutionCandidateRecord[]>;
  resolveLocalSkillSuggestions: (task: LearningCenterTaskLike) => Promise<{
    suggestions: LocalSkillSuggestionRecord[];
    gapSummary?: string;
    profile?: string;
    usedInstalledSkills?: string[];
  }>;
  deriveRuleCandidates?: (tasks: LearningCenterTaskLike[]) => LearningRuleCandidateRecord[];
}
