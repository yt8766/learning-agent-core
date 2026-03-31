import type { TaskRecord } from './core';

export interface RuntimeCenterRecord {
  runtimeProfile?: 'platform' | 'company' | 'personal' | 'cli';
  policy?: {
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
  subgraphs?: Array<{
    id: 'research' | 'execution' | 'review' | 'skill-install' | 'background-runner';
    displayName: string;
    description: string;
    owner: string;
    entryNodes: string[];
  }>;
  workflowVersions?: Array<{
    workflowId: string;
    version: string;
    status: 'draft' | 'published' | 'active' | 'deprecated';
    updatedAt: string;
    changelog?: string[];
  }>;
  appliedFilters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    // Exported filter value should be canonical; legacy aliases may still appear when reading historical data.
    executionMode?: string;
    interactionKind?: string;
  };
  usageAnalytics: {
    totalEstimatedPromptTokens: number;
    totalEstimatedCompletionTokens: number;
    totalEstimatedTokens: number;
    totalEstimatedCostUsd: number;
    totalEstimatedCostCny: number;
    providerMeasuredCostUsd: number;
    providerMeasuredCostCny: number;
    estimatedFallbackCostUsd: number;
    estimatedFallbackCostCny: number;
    measuredRunCount: number;
    estimatedRunCount: number;
    daily: Array<{
      day: string;
      tokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
      overBudget?: boolean;
    }>;
    models: Array<{
      model: string;
      tokens: number;
      costUsd: number;
      costCny: number;
      runCount: number;
    }>;
    budgetPolicy: {
      dailyTokenWarning: number;
      dailyCostCnyWarning: number;
      totalCostCnyWarning: number;
    };
    historyDays?: number;
    historyRange?: {
      earliestDay?: string;
      latestDay?: string;
    };
    persistedDailyHistory?: Array<{
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
    providerBillingStatus?: {
      status: 'disabled' | 'configured' | 'synced' | 'error';
      provider: string;
      source: string;
      syncedAt?: string;
      message?: string;
    };
    providerBillingDailyHistory?: Array<{
      day: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
    }>;
    providerBillingTotals?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
    };
    recentUsageAudit?: Array<{
      taskId: string;
      day: string;
      totalTokens: number;
      totalCostUsd: number;
      totalCostCny: number;
      measuredCallCount: number;
      estimatedCallCount: number;
      updatedAt: string;
      modelBreakdown: Array<{
        model: string;
        totalTokens: number;
        costUsd: number;
        costCny: number;
        pricingSource?: 'provider' | 'estimated';
        callCount: number;
      }>;
    }>;
    alerts: Array<{
      level: 'info' | 'warning' | 'critical';
      title: string;
      description: string;
    }>;
  };
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
      | 'counselor-selector'
      | 'learning-conflict';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  diagnosisEvidenceCount?: number;
  thoughtGraphs?: Array<{
    taskId: string;
    goal: string;
    currentMinistry?: string;
    currentNode?: string;
    graph: {
      nodes: Array<{
        id: string;
        kind: 'planning' | 'research' | 'execution' | 'approval' | 'review' | 'recovery' | 'finalize' | 'failure';
        label: string;
        ministry?: string;
        status: 'completed' | 'running' | 'blocked' | 'failed' | 'pending';
        at?: string;
        errorCode?: string;
        checkpointRef?: {
          sessionId: string;
          taskId?: string;
          checkpointId: string;
          checkpointCursor: number;
          recoverability: 'safe' | 'partial' | 'unsafe';
        };
      }>;
      edges: Array<{
        from: string;
        to: string;
        reason: string;
      }>;
    };
  }>;
  modelHeatmap?: Array<{
    ministry: string;
    model: string;
    successRate: number | null;
    avgLatencyMs: number | null;
    avgCostUsd: number | null;
    retryRate: number | null;
  }>;
  imperialChain?: Array<{
    taskId: string;
    goal: string;
    node?: string;
    modeGateState?: {
      requestedMode?: 'plan' | 'execute' | 'imperial_direct';
      activeMode: 'plan' | 'execute' | 'imperial_direct';
      reason: string;
      updatedAt: string;
    };
    budgetGateState?: {
      status: 'open' | 'soft_blocked' | 'hard_blocked' | 'throttled';
      summary: string;
      queueDepth?: number;
    };
    complexTaskPlan?: {
      status: 'pending' | 'completed' | 'blocked';
      summary: string;
      subGoals: string[];
      recoveryPoints?: string[];
    };
    blackboardState?: {
      visibleScopes: Array<'supervisor' | 'strategy' | 'ministry' | 'fallback' | 'governance'>;
      refs: {
        traceCount: number;
        evidenceCount: number;
        checkpointId?: string;
        activeInterruptId?: string;
      };
    };
    contextFilterState?: {
      status: 'pending' | 'completed' | 'blocked';
      filteredContextSlice: {
        summary: string;
        historyTraceCount: number;
        evidenceCount: number;
        specialistCount: number;
        ministryCount: number;
      };
      audienceSlices?: {
        strategy: {
          summary: string;
          dispatchCount: number;
        };
        ministry: {
          summary: string;
          dispatchCount: number;
        };
        fallback: {
          summary: string;
          dispatchCount: number;
        };
      };
      dispatchOrder?: Array<'strategy' | 'ministry' | 'fallback'>;
    };
    criticState?: {
      decision: 'pass_through' | 'rewrite_required';
      summary: string;
      blockingIssues?: string[];
    };
    guardrailState?: {
      stage: 'pre' | 'post';
      verdict: 'pass_through' | 'rewrite_required' | 'block';
      summary: string;
    };
    sandboxState?: {
      stage: 'gongbu' | 'bingbu' | 'review';
      status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
      attempt: number;
      maxAttempts: number;
      verdict?: 'safe' | 'unsafe' | 'retry';
      exhaustedReason?: string;
    };
    finalReviewState?: {
      decision: 'pass' | 'revise_required' | 'block';
      summary: string;
      interruptRequired: boolean;
      deliveryStatus?: 'pending' | 'delivered' | 'interrupted';
      deliveryMinistry?: string;
    };
    knowledgeIndexState?: {
      indexStatus: 'ready' | 'partial' | 'building' | 'failed';
      searchableDocumentCount?: number;
      blockedDocumentCount?: number;
    };
    dispatches?: Array<{
      taskId: string;
      subTaskId: string;
      from: string;
      to: string;
      kind: 'strategy' | 'ministry' | 'fallback';
      objective: string;
    }>;
    governanceScore?: {
      ministry: 'libu-governance';
      score: number;
      status: 'healthy' | 'watch' | 'risky';
      summary: string;
      trustAdjustment: 'promote' | 'hold' | 'downgrade';
    };
  }>;
  strategyCounselors?: Array<{
    taskId: string;
    goal: string;
    counselors: Array<{
      id: string;
      displayName: string;
    }>;
  }>;
  executionSpans?: Array<{
    taskId: string;
    ministries: string[];
    currentMinistry?: string;
    microLoopCount: number;
    maxMicroLoops: number;
    microLoopState?: {
      state: 'idle' | 'retrying' | 'exhausted' | 'completed';
      attempt: number;
      maxAttempts: number;
      exhaustedReason?: string;
      updatedAt: string;
    };
    sandboxState?: {
      stage: 'gongbu' | 'bingbu' | 'review';
      status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
      attempt: number;
      maxAttempts: number;
      verdict?: 'safe' | 'unsafe' | 'retry';
      exhaustedReason?: string;
      updatedAt: string;
    };
    dispatchKinds?: Array<'strategy' | 'ministry' | 'fallback'>;
  }>;
  interruptLedger?: Array<{
    taskId: string;
    // Legacy interrupt projections; runtime ownership is 司礼监 / InterruptController.
    activeInterrupt?: Record<string, unknown>;
    interruptHistory: Array<Record<string, unknown>>;
    entryRouterState?: Record<string, unknown>;
    interruptControllerState?: {
      activeInterrupt?: Record<string, unknown>;
      interruptHistory: Array<Record<string, unknown>>;
    };
    revisionState?: string;
  }>;
  libuScorecards?: Array<{
    taskId: string;
    reportId?: string;
    score?: number;
    summary?: string;
  }>;
  governanceScorecards?: Array<{
    taskId: string;
    status?: 'healthy' | 'watch' | 'risky';
    score?: number;
    summary?: string;
    trustAdjustment?: 'promote' | 'hold' | 'downgrade';
    recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
    governanceReport?: {
      summary: string;
      reviewOutcome: {
        decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
        summary: string;
      };
      evidenceSufficiency: {
        score: number;
        summary: string;
      };
      sandboxReliability: {
        score: number;
        summary: string;
      };
    };
  }>;
  shiluAdjustments?: Array<{
    taskId: string;
    recommendedCandidateIds: string[];
    autoConfirmCandidateIds: string[];
    governanceWarnings: string[];
  }>;
  recentAgentErrors?: Array<{
    id: string;
    taskId: string;
    goal: string;
    status: string;
    at: string;
    node?: string;
    step?: string;
    ministry?: string;
    worker?: string;
    phase?: string;
    routeFlow?: string;
    errorCode: string;
    errorCategory: string;
    errorName: string;
    message: string;
    retryable: boolean;
    toolName?: string;
    intent?: string;
    stack?: string;
    diagnosisHint?: string;
    recommendedAction?: string;
    recoveryPlaybook?: string[];
  }>;
  tools?: {
    totalTools: number;
    familyCount: number;
    blockedToolCount: number;
    approvalRequiredCount: number;
    mcpBackedCount: number;
    governanceToolCount: number;
    families: Array<{
      id: string;
      displayName: string;
      description: string;
      capabilityType: string;
      ownerType: string;
      ownerId?: string;
      bootstrap?: boolean;
      preferredMinistries?: string[];
      preferredSpecialists?: string[];
      toolCount: number;
    }>;
    tools: Array<{
      name: string;
      description: string;
      family: string;
      familyDisplayName: string;
      category: string;
      riskLevel: string;
      requiresApproval: boolean;
      timeoutMs: number;
      sandboxProfile: string;
      ownerType?: string;
      ownerId?: string;
      bootstrap?: boolean;
      preferredMinistries?: string[];
      preferredSpecialists?: string[];
      capabilityType: string;
      usageCount: number;
      blockedCount: number;
    }>;
    attachments: Array<{
      toolName: string;
      family: string;
      ownerType: string;
      ownerId?: string;
      attachedAt: string;
      attachedBy: string;
      preferred: boolean;
      reason?: string;
    }>;
    recentUsage: Array<{
      toolName: string;
      family: string;
      capabilityType: string;
      status: string;
      route: string;
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      approvalRequired?: boolean;
      riskLevel?: string;
      usedAt: string;
    }>;
    blockedReasons: Array<{
      toolName: string;
      family: string;
      capabilityType: string;
      status: string;
      route: string;
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      approvalRequired?: boolean;
      riskLevel?: string;
      usedAt: string;
    }>;
  };
  recentRuns: TaskRecord[];
}
