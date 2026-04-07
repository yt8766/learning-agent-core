import type { AgentStateRecord, ApprovalRecord } from './chat-session';
import type { ChatThinkState, ChatThoughtChainItem } from './chat-events';

export type ExecutionStepRoute = 'direct-reply' | 'research-first' | 'workflow-execute' | 'approval-recovery';
export type ExecutionStepStage =
  | 'request-received'
  | 'route-selection'
  | 'task-planning'
  | 'research'
  | 'execution'
  | 'review'
  | 'delivery'
  | 'approval-interrupt'
  | 'recovery';
export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'blocked';
export type ExecutionStepOwner = 'session' | 'libu' | 'hubu' | 'gongbu' | 'bingbu' | 'xingbu' | 'libu-docs' | 'system';

export interface ExecutionStepRecord {
  id: string;
  route: ExecutionStepRoute;
  stage: ExecutionStepStage;
  label: string;
  owner: ExecutionStepOwner;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  detail?: string;
  reason?: string;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
  traceId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    command?: string;
    requiredMinistries: string[];
    allowedCapabilities: string[];
    approvalPolicy: string;
    outputContract: {
      type: string;
      requiredSections: string[];
    };
  };
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  specialistLead?: {
    id: string;
    displayName: string;
    domain: string;
    reason?: string;
  };
  supportingSpecialists?: Array<{
    id: string;
    displayName: string;
    domain: string;
    reason?: string;
  }>;
  specialistFindings?: Array<{
    specialistId: string;
    role: 'lead' | 'support';
    contractVersion: 'specialist-finding.v1';
    source: 'route' | 'research' | 'execution' | 'critique';
    stage: 'planning' | 'research' | 'execution' | 'review';
    summary: string;
    domain: string;
    riskLevel?: string;
    blockingIssues?: string[];
    constraints?: string[];
    suggestions?: string[];
    evidenceRefs?: string[];
    confidence?: number;
  }>;
  routeConfidence?: number;
  contextSlicesBySpecialist?: Array<{
    specialistId: string;
    summary?: string;
    recentTurns?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    relatedHistory?: string[];
    evidenceRefs?: string[];
    domainInstruction?: string;
    outputInstruction?: string;
  }>;
  dispatches?: Array<{
    taskId: string;
    subTaskId: string;
    from: string;
    to: string;
    kind: 'strategy' | 'ministry' | 'fallback';
    objective: string;
  }>;
  critiqueResult?: {
    decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    summary: string;
    blockingIssues?: string[];
    constraints?: string[];
    evidenceRefs?: string[];
    shouldBlockEarly?: boolean;
  };
  chatRoute?: {
    graph: 'workflow' | 'approval-recovery' | 'learning';
    flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
    reason: string;
    adapter:
      | 'workflow-command'
      | 'approval-recovery'
      | 'identity-capability'
      | 'figma-design'
      | 'modification-intent'
      | 'general-prompt'
      | 'research-first'
      | 'plan-only'
      | 'readiness-fallback'
      | 'fallback';
    priority: number;
    intent?: ExecutionStepRoute | 'plan-only';
    intentConfidence?: number;
    executionReadiness?:
      | 'ready'
      | 'approval-required'
      | 'missing-capability'
      | 'missing-connector'
      | 'missing-workspace'
      | 'blocked-by-policy';
    matchedSignals?: string[];
    readinessReason?: string;
    profileAdjustmentReason?: string;
    preferredExecutionMode?: 'direct-reply' | 'plan-first' | 'execute-first';
    stepsSummary?: ExecutionStepRecord[];
  };
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  pendingAction?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
  };
  pendingApproval?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
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
  interruptHistory?: Array<{
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
  }>;
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
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
      budgetTriggered?: boolean;
    };
  };
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
    noiseGuards?: string[];
    hiddenTraceCount?: number;
    redactedKeys?: string[];
    createdAt: string;
    updatedAt: string;
  };
  streamStatus?: {
    nodeId?: string;
    nodeLabel?: string;
    detail?: string;
    progressPercent?: number;
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
  approvalFeedback?: string;
  modelRoute?: Array<{
    ministry: string;
    workerId: string;
    defaultModel: string;
    selectedModel: string;
    reason: string;
  }>;
  externalSources?: Array<{
    id: string;
    sourceId?: string;
    taskId: string;
    sourceType: string;
    sourceUrl?: string;
    trustClass: string;
    summary: string;
    detail?: Record<string, unknown>;
    linkedRunId?: string;
    createdAt: string;
    fetchedAt?: string;
  }>;
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  connectorRefs?: string[];
  requestedHints?: {
    requestedSpecialist?: string;
    requestedSkill?: string;
    requestedConnectorTemplate?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
    requestedCapability?: string;
    preferredMode?: 'direct-reply' | 'workflow' | 'research-first';
    createSkillIntent?: {
      description: string;
      displayName?: string;
    };
  };
  capabilityAugmentations?: Array<{
    id: string;
    kind: 'skill' | 'connector' | 'tool' | 'both' | 'none';
    status: 'suggested' | 'waiting_approval' | 'installing' | 'configuring' | 'ready' | 'failed' | 'blocked';
    requestedBy: 'user' | 'supervisor' | 'specialist' | 'workflow';
    target?: string;
    reason: string;
    summary?: string;
    owner: {
      ownerType: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      capabilityType: 'skill' | 'connector' | 'tool';
      scope: 'task' | 'session' | 'workspace';
      trigger:
        | 'bootstrap'
        | 'user_requested'
        | 'specialist_requested'
        | 'capability_gap_detected'
        | 'workflow_required';
      consumedByMinistry?: string;
      consumedBySpecialist?: string;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  currentSkillExecution?: {
    skillId: string;
    displayName: string;
    phase: 'research' | 'execute';
    stepIndex: number;
    totalSteps: number;
    title: string;
    instruction: string;
    toolNames?: string[];
    updatedAt: string;
  };
  learningEvaluation?: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
    notes: string[];
    governanceWarnings?: string[];
    candidateReasons?: string[];
    skippedReasons?: string[];
    conflictDetected?: boolean;
    conflictTargets?: string[];
    derivedFromLayers?: string[];
    policyMode?: string;
    expertiseSignals?: string[];
    skillGovernanceRecommendations?: Array<{
      skillId: string;
      recommendation: 'promote' | 'keep-lab' | 'disable' | 'retire';
      successRate?: number;
      promotionState?: string;
    }>;
    recommendedCandidateIds: string[];
    autoConfirmCandidateIds: string[];
    sourceSummary: {
      externalSourceCount: number;
      internalSourceCount: number;
      reusedMemoryCount: number;
      reusedRuleCount: number;
      reusedSkillCount: number;
    };
  };
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
  skillSearch?: {
    capabilityGapDetected: boolean;
    status: 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';
    safetyNotes: string[];
    query?: string;
    triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
    remoteSearch?: {
      query: string;
      discoverySource: string;
      resultCount: number;
      executedAt: string;
    };
    mcpRecommendation?: {
      kind: 'skill' | 'connector' | 'not-needed';
      summary: string;
      reason: string;
      connectorTemplateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
    };
    suggestions: Array<{
      id: string;
      kind: 'installed' | 'manifest' | 'connector-template' | 'remote-skill';
      displayName: string;
      summary: string;
      sourceId?: string;
      score: number;
      availability:
        | 'ready'
        | 'installable'
        | 'installable-local'
        | 'installable-remote'
        | 'approval-required'
        | 'blocked';
      reason: string;
      requiredCapabilities: string[];
      requiredConnectors?: string[];
      version?: string;
      sourceLabel?: string;
      sourceTrustClass?: string;
      installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
      successRate?: number;
      governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
      repo?: string;
      skillName?: string;
      detailsUrl?: string;
      installCommand?: string;
      discoverySource?: string;
      triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
      safety?: {
        verdict: 'allow' | 'needs-approval' | 'blocked';
        trustScore: number;
        sourceTrustClass?: string;
        profileCompatible?: boolean;
        maxRiskLevel: string;
        reasons: string[];
        riskyTools: string[];
        missingDeclarations: string[];
      };
      installState?: {
        receiptId: string;
        status: 'requesting' | 'pending' | 'approved' | 'installing' | 'installed' | 'failed' | 'rejected';
        phase?: string;
        result?: string;
        failureCode?: string;
        failureDetail?: string;
        installedAt?: string;
      };
    }>;
  };
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState?: {
    status: string;
    currentStep?: string;
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
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentStateRecord[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
