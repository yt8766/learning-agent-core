export type DashboardPageKey =
  | 'runtime'
  | 'approvals'
  | 'learning'
  | 'evals'
  | 'archives'
  | 'skills'
  | 'evidence'
  | 'connectors';

export interface ApprovalDecisionRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: string;
  sessionId?: string;
  runId?: string;
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
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
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
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
  version?: string;
  successRate?: number;
  promotionState?: string;
  sourceRuns?: string[];
  disabledReason?: string;
  restoredAt?: string;
  updatedAt?: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  currentMinistry?: string;
  currentWorker?: string;
  intent: string;
  reason?: string;
}

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
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  taskGoal: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
  linkedRunId?: string;
  createdAt: string;
}

export interface ConnectorCapabilityRecord {
  id: string;
  displayName: string;
  toolName: string;
  category: string;
  riskLevel: string;
  requiresApproval: boolean;
}

export interface ConnectorRecord {
  id: string;
  displayName: string;
  transport: string;
  enabled: boolean;
  healthState: string;
  healthReason?: string;
  capabilityCount: number;
  implementedCapabilityCount?: number;
  discoveredCapabilityCount?: number;
  discoveredCapabilities?: string[];
  discoveryMode?: 'registered' | 'remote';
  sessionState?: 'stateless' | 'disconnected' | 'connected' | 'error';
  sessionCreatedAt?: string;
  sessionLastActivityAt?: string;
  sessionRequestCount?: number;
  sessionIdleMs?: number;
  lastDiscoveredAt?: string;
  lastDiscoveryError?: string;
  approvalRequiredCount: number;
  highRiskCount: number;
  capabilities: ConnectorCapabilityRecord[];
}

export interface SessionRecord {
  id: string;
  title: string;
  status: string;
  currentTaskId?: string;
  updatedAt: string;
}

export interface RuntimeCenterRecord {
  taskCount: number;
  activeTaskCount: number;
  queueDepth: number;
  blockedRunCount: number;
  budgetExceededCount?: number;
  pendingApprovalCount: number;
  sessionCount: number;
  activeSessionCount: number;
  activeMinistries: string[];
  activeWorkers: string[];
  appliedFilters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
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
  recentRuns: TaskRecord[];
}

export interface LearningCenterRecord {
  totalCandidates: number;
  pendingCandidates: number;
  confirmedCandidates: number;
  researchJobs?: number;
  averageEvaluationScore?: number;
  autoConfirmableCandidates?: number;
  autoPersistedResearchJobs?: number;
  conflictingResearchJobs?: number;
  invalidatedMemories?: number;
  invalidatedRules?: number;
  candidates: LearningCandidateItem[];
  recentJobs?: LearningJobRecord[];
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
}

export interface PlatformConsoleRecord {
  runtime: RuntimeCenterRecord;
  approvals: Array<{
    taskId: string;
    goal: string;
    status: string;
    sessionId?: string;
    currentMinistry?: string;
    currentWorker?: string;
    approvals: ApprovalDecisionRecord[];
  }>;
  learning: LearningCenterRecord;
  evals: EvalsCenterRecord;
  skills: SkillRecord[];
  evidence: EvidenceRecord[];
  connectors: ConnectorRecord[];
  rules: RuleRecord[];
  tasks: TaskRecord[];
  sessions: SessionRecord[];
}
