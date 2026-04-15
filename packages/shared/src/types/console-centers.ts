export interface LearningCandidateItem {
  id: string;
  taskId: string;
  taskGoal: string;
  type: string;
  summary: string;
  status: string;
  currentMinistry?: string;
  currentWorker?: string;
  confidenceScore?: number;
  autoConfirmEligible?: boolean;
  provenanceCount?: number;
  evaluationScore?: number;
  evaluationConfidence?: string;
  candidateReasons?: string[];
  skippedReasons?: string[];
  conflictDetected?: boolean;
  conflictTargets?: string[];
  derivedFromLayers?: string[];
  policyMode?: string;
  expertiseSignals?: string[];
  createdAt: string;
}

export interface LearningJobRecord {
  id: string;
  sourceType: string;
  status: string;
  documentUri: string;
  goal?: string;
  workflowId?: string;
  summary?: string;
  sourceCount?: number;
  trustSummary?: Record<string, number>;
  evaluationScore?: number;
  evaluationConfidence?: string;
  candidateReasons?: string[];
  skippedReasons?: string[];
  expertiseSignals?: string[];
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningCenterRecord {
  totalCandidates: number;
  pendingCandidates: number;
  confirmedCandidates: number;
  learningQueueSummary?: {
    total?: number;
    queued: number;
    processing: number;
    blocked: number;
    completed: number;
    taskLearningQueued?: number;
    taskLearningProcessing?: number;
    taskLearningCompleted?: number;
    dreamTaskQueued?: number;
    dreamTaskProcessing?: number;
    dreamTaskCompleted?: number;
    byMode?: {
      taskLearning: {
        total: number;
        queued: number;
        processing: number;
        blocked: number;
        completed: number;
      };
      dreamTask: {
        total: number;
        queued: number;
        processing: number;
        blocked: number;
        completed: number;
      };
    };
  };
  conflictGovernance?: {
    scannedAt?: string;
    openConflictCount?: number;
    manualReviewCount?: number;
    mergeSuggestionCount?: number;
    open?: number;
    merged?: number;
    dismissed?: number;
    escalated?: number;
  };
  knowledgeStores?: {
    wenyuan?: {
      memoryCount: number;
      sessionCount: number;
      checkpointCount: number;
      traceCount: number;
      governanceHistoryCount: number;
    };
    cangjing?: {
      sourceCount: number;
      chunkCount: number;
      embeddingCount: number;
      searchableDocumentCount: number;
      blockedDocumentCount: number;
      latestReceiptIds: string[];
    };
  };
  capabilityTrustProfiles?: Array<{
    capabilityId: string;
    displayName: string;
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastReason?: string;
    reportCount?: number;
    promoteCount?: number;
    holdCount?: number;
    downgradeCount?: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    updatedAt: string;
  }>;
  ministryGovernanceProfiles?: Array<{
    entityId: string;
    displayName: string;
    entityKind: 'ministry' | 'worker' | 'specialist';
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastReason?: string;
    reportCount?: number;
    promoteCount?: number;
    holdCount?: number;
    downgradeCount?: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    updatedAt: string;
  }>;
  workerGovernanceProfiles?: Array<{
    entityId: string;
    displayName: string;
    entityKind: 'ministry' | 'worker' | 'specialist';
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastReason?: string;
    reportCount?: number;
    promoteCount?: number;
    holdCount?: number;
    downgradeCount?: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    updatedAt: string;
  }>;
  specialistGovernanceProfiles?: Array<{
    entityId: string;
    displayName: string;
    entityKind: 'ministry' | 'worker' | 'specialist';
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastReason?: string;
    reportCount?: number;
    promoteCount?: number;
    holdCount?: number;
    downgradeCount?: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    updatedAt: string;
  }>;
  recentGovernanceReports?: Array<{
    taskId: string;
    summary: string;
    reviewDecision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    evidenceScore: number;
    sandboxScore: number;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
  }>;
  ministryScorecards?: Array<{
    ministry?: string;
    taskId?: string;
    goal?: string;
    evaluationReportId?: string;
    averageScore?: number;
    score?: number;
    confidence?: string;
    summary?: string;
    governanceWarnings?: string[];
    reportCount?: number;
    lastUpdatedAt?: string;
  }>;
  researchJobs?: number;
  averageEvaluationScore?: number;
  autoConfirmableCandidates?: number;
  autoPersistedResearchJobs?: number;
  conflictingResearchJobs?: number;
  invalidatedMemories?: number;
  quarantinedMemories?: number;
  invalidatedRules?: number;
  quarantineCategoryStats?: Record<string, number>;
  quarantineRestoreSuggestions?: string[];
  recentQuarantinedMemories?: Array<{
    id: string;
    summary: string;
    quarantineReason?: string;
    quarantineCategory?: string;
    quarantineReasonDetail?: string;
    quarantineRestoreSuggestion?: string;
    quarantinedAt?: string;
  }>;
  recentCrossCheckEvidence?: Array<{
    memoryId: string;
    id: string;
    summary: string;
    sourceType: string;
    trustClass: string;
  }>;
  recentSkillGovernance?: Array<{
    taskId: string;
    goal: string;
    skillId: string;
    recommendation: string;
    successRate?: number;
    promotionState?: string;
    updatedAt: string;
  }>;
  queuedLearningTasks?: number;
  learningQueue?: Array<{
    id: string;
    taskId: string;
    status: string;
    mode?: 'task-learning' | 'dream-task';
    queuedAt: string;
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
    priority?: string;
    summary?: string;
    candidateSummary?: string;
    selectedCounselorId?: string;
    selectedVersion?: string;
    capabilityUsageStats?: {
      toolCount: number;
      workerCount: number;
      totalTokens?: number;
      totalCostUsd?: number;
    };
  }>;
  timeoutStats?: {
    timedOutTaskCount: number;
    defaultAppliedCount: number;
  };
  budgetEfficiencyWarnings?: Array<{
    taskId: string;
    goal: string;
    status?: string;
    reason?: string;
  }>;
  counselorExperiments?: Array<{
    selectedCounselorId?: string;
    selectedVersion?: string;
    taskCount: number;
    successRate: number;
    interruptRate: number;
    blockedRate: number;
    avgTokens: number;
    avgCostUsd: number;
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
    conflictPairs: Array<{
      id: string;
      contextSignature: string;
      conflictSetId?: string;
      memoryIds: string[];
      effectivenessSpread: number;
      recommendation: string;
      riskLevel?: string;
      status?: string;
    }>;
    mergeSuggestions: Array<{
      conflictId: string;
      preferredMemoryId?: string;
      loserMemoryIds: string[];
      suggestion: string;
    }>;
    manualReviewQueue: Array<{
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
  candidates: LearningCandidateItem[];
  recentJobs?: LearningJobRecord[];
  localSkillSuggestions?: Array<{
    taskId: string;
    goal: string;
    suggestions: unknown[];
    gapSummary?: string;
    profile?: string;
    usedInstalledSkills?: string[];
  }>;
}

export interface EvalScenarioRecord {
  scenarioId: string;
  label: string;
  description: string;
  matchedRunCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface EvalTrendPointRecord {
  day: string;
  runCount: number;
  passCount: number;
  passRate: number;
}

export interface EvalRunRecord {
  taskId: string;
  scenarioIds: string[];
  success: boolean;
  createdAt: string;
}

export interface EvalScenarioTrendRecord {
  scenarioId: string;
  label: string;
  points: EvalTrendPointRecord[];
}

export interface EvalsCenterRecord {
  scenarioCount: number;
  runCount: number;
  overallPassRate: number;
  appliedFilters?: {
    scenarioId?: string;
    outcome?: string;
  };
  scenarios: EvalScenarioRecord[];
  recentRuns: EvalRunRecord[];
  dailyTrend: EvalTrendPointRecord[];
  scenarioTrends: EvalScenarioTrendRecord[];
  historyDays?: number;
  historyRange?: {
    earliestDay?: string;
    latestDay?: string;
  };
  persistedDailyHistory?: Array<{
    day: string;
    runCount: number;
    passCount: number;
    passRate: number;
    scenarioCount: number;
    overallPassRate: number;
    updatedAt: string;
  }>;
  promptRegression?: {
    configPath?: string;
    promptCount?: number;
    promptSuiteCount?: number;
    testCount?: number;
    providerCount?: number;
    updatedAt?: string;
    latestRun?: {
      summaryPath: string;
      runAt: string;
      overallStatus: 'pass' | 'fail' | 'partial';
      passRate?: number;
      providerIds: string[];
      suiteResults: Array<{
        suiteId: string;
        label: string;
        status: 'pass' | 'fail' | 'partial';
        passRate?: number;
        notes?: string[];
        promptResults: Array<{
          promptId: string;
          version: string;
          providerId?: string;
          pass?: boolean;
          score?: number;
        }>;
      }>;
    };
    suites: Array<{
      suiteId: string;
      label: string;
      promptIds: string[];
      versions: string[];
      promptCount: number;
    }>;
  };
}
