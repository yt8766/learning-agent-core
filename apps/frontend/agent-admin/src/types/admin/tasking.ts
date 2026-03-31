export type DashboardPageKey =
  | 'runtime'
  | 'approvals'
  | 'learning'
  | 'evals'
  | 'archives'
  | 'skills'
  | 'evidence'
  | 'connectors'
  | 'skillSources'
  | 'companyAgents';

export interface ApprovalDecisionRecord {
  intent?: string;
  decision: string;
  reason?: string;
}

export interface SpecialistLeadRecord {
  id: string;
  displayName: string;
  domain: string;
  reason: string;
}

export interface SpecialistSupportRecord {
  id: string;
  displayName: string;
  domain: string;
  reason?: string;
}

export interface CritiqueResultRecord {
  contractVersion?: 'critique-result.v1';
  decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
  summary: string;
  blockingIssues?: string[];
  constraints?: string[];
  evidenceRefs?: string[];
  shouldBlockEarly?: boolean;
}

export interface SpecialistFindingRecord {
  specialistId: string;
  role: 'lead' | 'support';
  contractVersion: 'specialist-finding.v1';
  source: 'route' | 'research' | 'execution' | 'critique';
  stage: 'planning' | 'research' | 'execution' | 'review';
  domain: string;
  summary: string;
  riskLevel?: string;
  blockingIssues?: string[];
  constraints?: string[];
  suggestions?: string[];
  evidenceRefs?: string[];
  confidence?: number;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: string;
  sessionId?: string;
  runId?: string;
  traceId?: string;
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    version?: string;
  };
  subgraphTrail?: Array<'research' | 'execution' | 'review' | 'skill-install' | 'background-runner'>;
  currentNode?: string;
  mainChainNode?:
    | 'entry_router'
    | 'mode_gate'
    | 'dispatch_planner'
    | 'context_filter'
    | 'result_aggregator'
    | 'interrupt_controller'
    | 'learning_recorder';
  currentMinistry?: string;
  currentWorker?: string;
  modeGateState?: {
    requestedMode?: 'plan' | 'execute' | 'imperial_direct';
    activeMode: 'plan' | 'execute' | 'imperial_direct';
    reason: string;
    updatedAt: string;
  };
  budgetGateState?: {
    node: 'budget_gate';
    status: 'open' | 'soft_blocked' | 'hard_blocked' | 'throttled';
    summary: string;
    queueDepth?: number;
    rateLimitKey?: string;
    triggeredAt?: string;
    updatedAt: string;
  };
  complexTaskPlan?: {
    node: 'complex_task_plan';
    status: 'pending' | 'completed' | 'blocked';
    summary: string;
    subGoals: string[];
    dependencies: Array<{
      from: string;
      to: string;
    }>;
    recoveryPoints?: string[];
    createdAt: string;
    updatedAt: string;
  };
  blackboardState?: {
    node: 'blackboard_state';
    taskId: string;
    sessionId?: string;
    visibleScopes: Array<'supervisor' | 'strategy' | 'ministry' | 'fallback' | 'governance'>;
    refs: {
      traceCount: number;
      evidenceCount: number;
      checkpointId?: string;
      activeInterruptId?: string;
    };
    updatedAt: string;
  };
  contextFilterState?: {
    node: 'context_filter';
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
    hiddenTraceCount?: number;
    redactedKeys?: string[];
    createdAt: string;
    updatedAt: string;
  };
  finalReviewState?: {
    node: 'final_review';
    ministry: string;
    decision: 'pass' | 'revise_required' | 'block';
    summary: string;
    interruptRequired: boolean;
    deliveryStatus?: 'pending' | 'delivered' | 'interrupted';
    deliveryMinistry?: string;
    createdAt: string;
    updatedAt: string;
  };
  guardrailState?: {
    stage: 'pre' | 'post';
    verdict: 'pass_through' | 'rewrite_required' | 'block';
    summary: string;
    eventId?: string;
    updatedAt: string;
  };
  criticState?: {
    node: 'critic';
    decision: 'pass_through' | 'rewrite_required';
    summary: string;
    blockingIssues?: string[];
    createdAt: string;
    updatedAt: string;
  };
  sandboxState?: {
    node: 'sandbox';
    stage: 'gongbu' | 'bingbu' | 'review';
    status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
    attempt: number;
    maxAttempts: number;
    verdict?: 'safe' | 'unsafe' | 'retry';
    exhaustedReason?: string;
    updatedAt: string;
  };
  knowledgeIngestionState?: {
    node: 'knowledge_ingestion';
    store: 'wenyuan' | 'cangjing';
    sourceId?: string;
    receiptId?: string;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
    updatedAt: string;
  };
  knowledgeIndexState?: {
    node: 'knowledge_index';
    store: 'wenyuan' | 'cangjing';
    indexStatus: 'ready' | 'partial' | 'building' | 'failed';
    searchableDocumentCount?: number;
    blockedDocumentCount?: number;
    updatedAt: string;
  };
  libuEvaluationReportId?: string;
  evaluationReport?: {
    id: string;
    ministry: 'libu-governance';
    score: number;
    summary: string;
    rlaifNotes: string[];
    derivedFromTaskId: string;
    derivedFromTraceId?: string;
    createdAt: string;
    updatedAt: string;
  };
  queueState?: {
    mode: 'foreground' | 'background';
    backgroundRun: boolean;
    status: 'queued' | 'running' | 'waiting_approval' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    enqueuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    lastTransitionAt: string;
    attempt: number;
    leaseOwner?: string;
    leaseExpiresAt?: string;
    lastHeartbeatAt?: string;
  };
  currentStep?: string;
  pendingApproval?: {
    toolName?: string;
    intent?: string;
    riskLevel?: string;
    requestedBy?: string;
    reason?: string;
    reasonCode?: string;
    feedback?: string;
    serverId?: string;
    capabilityId?: string;
    preview?: Array<{
      label: string;
      value: string;
    }>;
  };
  // Legacy admin projection; runtime ownership is 司礼监 / InterruptController.
  activeInterrupt?: {
    id: string;
    status: 'pending' | 'resolved' | 'cancelled';
    mode: 'blocking' | 'non-blocking';
    source: 'graph' | 'tool';
    kind: 'tool-approval' | 'skill-install' | 'connector-governance' | 'runtime-governance' | 'user-input';
    intent?: string;
    toolName?: string;
    family?: string;
    capabilityType?: string;
    requestedBy?: string;
    ownerType?: string;
    ownerId?: string;
    reason?: string;
    blockedReason?: string;
    riskLevel?: string;
    threadId?: string;
    checkpointId?: string;
    resumeStrategy: 'command' | 'approval-recovery';
    preview?: Array<{
      label: string;
      value: string;
    }>;
    payload?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
  };
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
  // Legacy aliases still read here; canonical writes should align with executionPlan.mode.
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  planModeTransitions?: Array<{
    from?: 'intent' | 'implementation' | 'finalized' | 'aborted';
    to: 'intent' | 'implementation' | 'finalized' | 'aborted';
    reason: string;
    at: string;
  }>;
  planDraft?: {
    summary: string;
    autoResolved: string[];
    openQuestions: string[];
    assumptions: string[];
    decisions?: Array<{
      questionId: string;
      resolutionSource:
        | 'user-answer'
        | 'default-assumption'
        | 'auto-resolved'
        | 'bypass-recommended'
        | 'fallback-assumption';
      selectedOptionId?: string;
      freeform?: string;
      assumedValue?: string;
      whyAsked?: string;
      decisionRationale?: string;
      impactOnPlan?: string;
      answeredAt: string;
    }>;
    questionSet?: {
      title?: string;
      summary?: string;
    };
    questions?: Array<{
      id: string;
      question: string;
      questionType: 'direction' | 'detail' | 'tradeoff';
      options: Array<{
        id: string;
        label: string;
        description: string;
      }>;
      recommendedOptionId?: string;
      allowFreeform?: boolean;
      defaultAssumption?: string;
      whyAsked?: string;
      impactOnPlan?: string;
    }>;
    maxPlanTurns?: number;
    planTurnsUsed?: number;
    microBudget?: {
      readOnlyToolLimit: number;
      readOnlyToolsUsed: number;
      tokenBudgetUsd?: number;
      budgetTriggered: boolean;
    };
  };
  retryCount?: number;
  maxRetries?: number;
  revisionCount?: number;
  maxRevisions?: number;
  microLoopCount?: number;
  maxMicroLoops?: number;
  microLoopState?: {
    state: 'idle' | 'retrying' | 'exhausted' | 'completed';
    attempt: number;
    maxAttempts: number;
    exhaustedReason?: string;
    updatedAt: string;
  };
  revisionState?: 'idle' | 'needs_revision' | 'revising' | 'blocked' | 'completed';
  specialistLead?: SpecialistLeadRecord;
  supportingSpecialists?: SpecialistSupportRecord[];
  specialistFindings?: SpecialistFindingRecord[];
  routeConfidence?: number;
  dispatches?: Array<{
    taskId: string;
    subTaskId: string;
    from: string;
    to: string;
    kind: 'strategy' | 'ministry' | 'fallback';
    objective: string;
  }>;
  critiqueResult?: CritiqueResultRecord;
  governanceScore?: {
    ministry: 'libu-governance';
    score: number;
    status: 'healthy' | 'watch' | 'risky';
    summary: string;
    rationale: string[];
    recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  };
  governanceReport?: {
    ministry: 'libu-governance';
    summary: string;
    executionQuality: {
      score: number;
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
    reviewOutcome: {
      decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      summary: string;
    };
    interruptLoad: {
      interruptCount: number;
      microLoopCount: number;
      summary: string;
    };
    businessFeedback: {
      score: number;
      summary: string;
    };
    recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  };
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
  connectorRefs?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  result?: string;
  approvals: ApprovalDecisionRecord[];
  updatedAt: string;
  createdAt: string;
}

export interface TaskPlan {
  id: string;
  summary: string;
  steps: string[];
  subTasks: Array<{ id: string; title: string; description: string; assignedTo: string; status: string }>;
}

export interface AgentStateRecord {
  agentId: string;
  role: string;
  goal: string;
  subTask?: string;
  plan: string[];
  toolCalls: string[];
  observations: string[];
  shortTermMemory: string[];
  status: string;
  finalOutput?: string;
}

export interface AgentMessageRecord {
  id: string;
  from: string;
  to: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface ReviewRecord {
  taskId: string;
  decision: string;
  notes: string[];
}

export interface TraceRecord {
  node: string;
  at: string;
  summary: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  specialistId?: string;
  role?: 'lead' | 'support' | 'ministry';
  latencyMs?: number;
  status?: string;
  revisionCount?: number;
  modelUsed?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
  audit?: {
    taskId: string;
    entries: Array<{
      id: string;
      at: string;
      type: 'trace' | 'approval' | 'governance' | 'usage';
      title: string;
      summary: string;
      detail?: unknown;
      outcome?: string;
    }>;
    browserReplays: Array<{
      sessionId?: string;
      url?: string;
      artifactRef?: string;
      snapshotRef?: string;
      screenshotRef?: string;
      stepCount: number;
    }>;
    traceSummary?: {
      criticalPaths: Array<{
        pathLabel: string;
        totalLatencyMs: number;
        spanCount: number;
        fallbackNodes: string[];
        reviseNodes: string[];
      }>;
      fallbackSpans: string[];
      reviseSpans: string[];
      roleLatencyBreakdown: Array<{
        role: string;
        totalLatencyMs: number;
        spanCount: number;
      }>;
      slowestSpan?: {
        node: string;
        latencyMs: number;
      };
    };
  };
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  action: string;
  status?: string;
  invalidationReason?: string;
  supersededById?: string;
  restoredAt?: string;
  createdAt?: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  status: string;
  description: string;
  sourceId?: string;
  installReceiptId?: string;
  requiredCapabilities?: string[];
  requiredConnectors?: string[];
  version?: string;
  successRate?: number;
  promotionState?: string;
  governanceRecommendation?: string;
  sourceRuns?: string[];
  allowedTools?: string[];
  compatibility?: string;
  disabledReason?: string;
  restoredAt?: string;
  updatedAt?: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  // Derived approval items should prefer canonical values, but legacy aliases remain readable for compatibility.
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  currentMinistry?: string;
  currentWorker?: string;
  intent: string;
  interactionKind?:
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition';
  questionSetTitle?: string;
  reason?: string;
  reasonCode?: string;
  toolName?: string;
  riskLevel?: string;
  requestedBy?: string;
  interruptSource?: 'graph' | 'tool';
  interruptMode?: 'blocking' | 'non-blocking';
  resumeStrategy?: 'command' | 'approval-recovery';
  preview?: Array<{
    label: string;
    value: string;
  }>;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  taskGoal: string;
  sourceId?: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  sourceStore?: 'wenyuan' | 'cangjing';
  summary: string;
  detail?: Record<string, unknown>;
  linkedRunId?: string;
  checkpointRef?: {
    sessionId: string;
    taskId?: string;
    checkpointId: string;
    checkpointCursor: number;
    recoverability: 'safe' | 'partial' | 'unsafe';
  };
  recoverable?: boolean;
  createdAt: string;
  fetchedAt?: string;
  replay?: {
    sessionId?: string;
    url?: string;
    snapshotSummary?: string;
    screenshotRef?: string;
    artifactRef?: string;
    snapshotRef?: string;
    stepTrace?: string[];
    steps?: Array<{
      id: string;
      title: string;
      status: 'completed' | 'failed' | 'running';
      at: string;
      summary?: string;
      artifactRef?: string;
    }>;
  };
}
