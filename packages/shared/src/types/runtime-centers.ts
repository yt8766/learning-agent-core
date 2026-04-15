import type { ApprovalPolicyRecord, ApprovalScopePolicyRecord, ConnectorHealthRecord } from './governance';
import type { ExecutionTrace, EvidenceRecord } from './knowledge';
import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from './skills';
import type { RuntimeProfile, TaskStatus } from './primitives';
import type { TaskRecord } from './tasking';

export const RUNTIME_CENTER_PAGE_TITLES = {
  runtime: 'Runtime Center',
  approvals: 'Approvals Center',
  learning: 'Learning Center',
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
    id:
      | 'research'
      | 'execution'
      | 'review'
      | 'skill-install'
      | 'background-runner'
      | 'data-report-sandpack'
      | 'data-report-json'
      | string;
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
  appliedFilters?: RuntimeCenterAppliedFilters;
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
      | 'approval-policy'
      | 'counselor-selector'
      | 'learning-conflict';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  approvalScopePolicies?: ApprovalScopePolicyRecord[];
  dailyTechBriefing?: {
    enabled: boolean;
    schedule: string;
    cron?: string;
    scheduleValid?: boolean;
    jobKey?: string;
    lastRegisteredAt?: string;
    scheduler?: 'bree';
    timezone?: string;
    lastRunAt?: string;
    lastSuccessAt?: string;
    scheduleStates?: Partial<
      Record<
        | 'frontend-security'
        | 'general-security'
        | 'devtool-security'
        | 'ai-tech'
        | 'frontend-tech'
        | 'backend-tech'
        | 'cloud-infra-tech',
        {
          enabled: boolean;
          baseIntervalHours: number;
          currentIntervalHours: number;
          allowedIntervalHours: number[];
          lookbackDays: number;
          lastRunAt?: string;
          nextRunAt?: string;
          lastSuccessAt?: string;
          lastHotAt?: string;
          consecutiveHotRuns: number;
          consecutiveEmptyRuns: number;
          lastAdaptiveReason?: 'hot_streak' | 'cooldown' | 'manual_reset';
          recentRunStats: Array<{
            runAt: string;
            itemCount: number;
            newCount: number;
            updateCount: number;
            hot: boolean;
            status: 'sent' | 'empty' | 'failed' | 'skipped';
          }>;
        }
      >
    >;
    recentRuns?: Array<{
      id: string;
      runAt: string;
      status: 'sent' | 'partial' | 'failed';
      categories: Array<{
        category:
          | 'frontend-security'
          | 'general-security'
          | 'devtool-security'
          | 'ai-tech'
          | 'frontend-tech'
          | 'backend-tech'
          | 'cloud-infra-tech';
        title: string;
        status: 'sent' | 'empty' | 'failed' | 'skipped';
        itemCount: number;
        emptyDigest: boolean;
      }>;
    }>;
    categories: Array<{
      category:
        | 'frontend-security'
        | 'general-security'
        | 'devtool-security'
        | 'ai-tech'
        | 'frontend-tech'
        | 'backend-tech'
        | 'cloud-infra-tech';
      title: string;
      status: 'sent' | 'empty' | 'failed' | 'skipped';
      itemCount: number;
      emptyDigest: boolean;
      scheduleState?: {
        enabled: boolean;
        baseIntervalHours: number;
        currentIntervalHours: number;
        allowedIntervalHours: number[];
        lookbackDays: number;
        lastRunAt?: string;
        nextRunAt?: string;
        lastSuccessAt?: string;
        lastHotAt?: string;
        consecutiveHotRuns: number;
        consecutiveEmptyRuns: number;
        lastAdaptiveReason?: 'hot_streak' | 'cooldown' | 'manual_reset';
        recentRunStats: Array<{
          runAt: string;
          itemCount: number;
          newCount: number;
          updateCount: number;
          hot: boolean;
          status: 'sent' | 'empty' | 'failed' | 'skipped';
        }>;
      };
      newCount?: number;
      updateCount?: number;
      crossRunSuppressedCount?: number;
      sameRunMergedCount?: number;
      overflowCollapsedCount?: number;
      suppressedSummary?: string;
      savedAttentionCount?: number;
      displayedItemCount?: number;
      overflowTitles?: string[];
      preferredSourceNames?: string[];
      preferredTopicLabels?: string[];
      focusAreas?: string[];
      trendHighlights?: string[];
      auditRecords?: Array<{
        messageKey: string;
        title: string;
        category:
          | 'frontend-security'
          | 'general-security'
          | 'devtool-security'
          | 'ai-tech'
          | 'frontend-tech'
          | 'backend-tech'
          | 'cloud-infra-tech';
        decisionReason:
          | 'send_new'
          | 'send_update'
          | 'critical_override'
          | 'suppress_duplicate'
          | 'suppress_metadata_only'
          | 'same_run_merged'
          | 'overflow_collapsed';
        updateStatus?:
          | 'new'
          | 'version_upgrade'
          | 'breaking_change'
          | 'security_status_change'
          | 'capability_added'
          | 'official_confirmation'
          | 'patch_released'
          | 'metadata_only';
        displaySeverity?: 'critical' | 'high' | 'medium' | 'normal' | 'stable';
        sourceName: string;
        sourceGroup: 'official' | 'authority' | 'community';
        publishedAt: string;
        sent: boolean;
        crossVerified: boolean;
        displayScope?: string;
        url: string;
        whyItMatters?: string;
        relevanceLevel?: 'immediate' | 'team' | 'watch';
        recommendedAction?: 'ignore' | 'watch' | 'evaluate' | 'pilot' | 'fix-now';
        impactScenarioTags?: string[];
        recommendedNextStep?: string;
        helpful?: number;
        notHelpful?: number;
      }>;
      helpful?: number;
      notHelpful?: number;
      sentAt?: string;
      error?: string;
    }>;
  };
  streamMonitor?: RuntimeCenterStreamMonitorRecord[];
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
        compressionApplied?: boolean;
        compressionSource?: 'heuristic' | 'llm';
        compressedMessageCount?: number;
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
    streamStatus?: {
      nodeId?: string;
      nodeLabel?: string;
      detail?: string;
      progressPercent?: number;
      updatedAt: string;
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
    activeInterrupt?: unknown;
    interruptHistory: unknown[];
    entryRouterState?: unknown;
    interruptControllerState?: {
      activeInterrupt?: unknown;
      interruptHistory: unknown[];
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
    message?: string;
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
