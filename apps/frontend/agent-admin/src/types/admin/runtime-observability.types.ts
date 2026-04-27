import type { ChatEventRecord } from '@agent/core';

export interface RuntimeCenterThoughtGraphRecord {
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
}

export interface RuntimeCenterImperialChainRecord {
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
    specialistDomain?: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
    selectedAgentId?: string;
    selectionSource?:
      | 'explicit-agent'
      | 'strategy-counselor'
      | 'specialist-lead'
      | 'supporting-specialist'
      | 'candidate-first';
  }>;
  governanceScore?: {
    ministry: 'libu-governance';
    score: number;
    status: 'healthy' | 'watch' | 'risky';
    summary: string;
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
  };
}

export interface RuntimeCenterExecutionSpanRecord {
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
}

export interface RuntimeCenterInterruptLedgerRecord {
  taskId: string;
  activeInterrupt?: unknown;
  interruptHistory: unknown[];
  entryRouterState?: unknown;
  interruptControllerState?: {
    activeInterrupt?: unknown;
    interruptHistory: unknown[];
  };
  revisionState?: string;
}

export interface RuntimeCenterPlannerStrategyRecord {
  taskId: string;
  goal: string;
  strategy?: {
    mode?: 'default' | 'capability-gap' | 'rich-candidates';
    summary?: string;
    leadDomain?: string;
    requiredCapabilities: string[];
    preferredAgentId?: string;
    candidateAgentIds: string[];
    candidateCount: number;
    gapDetected: boolean;
    updatedAt?: string;
  };
}

export interface RuntimeCenterGovernanceScorecardRecord {
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
}

export interface RuntimeCenterRecentAgentErrorDetailsRecord {
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
}

export interface RuntimeCenterToolsRecord {
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
  agentToolExecutions?: {
    requests: Array<{
      id?: string;
      requestId?: string;
      taskId: string;
      toolName: string;
      nodeId?: string;
      capabilityId?: string;
      status: string;
      riskClass?: string;
      policyDecisionId?: string;
      requestedAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
    results?: Array<{
      id?: string;
      resultId?: string;
      requestId: string;
      status: string;
      completedAt?: string;
      createdAt?: string;
    }>;
    capabilities?: Array<{
      id?: string;
      capabilityId?: string;
      toolName: string;
      nodeId?: string;
      displayName?: string;
      riskClass?: string;
      requiresApproval?: boolean;
    }>;
    nodes?: Array<{
      id?: string;
      nodeId?: string;
      displayName?: string;
      status?: string;
      riskClass?: string;
    }>;
    policyDecisions?: Array<{
      id?: string;
      decisionId?: string;
      requestId: string;
      decision: string;
      riskClass?: string;
      reason?: string;
    }>;
    events?: ChatEventRecord[];
  };
}
