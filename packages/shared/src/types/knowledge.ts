import type { CapabilityOwnershipRecord } from './skills';
import type {
  EmbeddingModel,
  EmbeddingProvider,
  KnowledgeStore,
  LearningSourceType,
  MemoryType,
  RiskLevel,
  SkillStatus,
  SpecialistDomain,
  SpecialistSpanRole,
  TrustClass,
  WorkerDomain
} from './primitives';

export interface ExecutionTrace {
  node: string;
  at: string;
  summary: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  specialistId?: SpecialistDomain | string;
  role?: SpecialistSpanRole;
  latencyMs?: number;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  status?: 'success' | 'timeout' | 'rejected' | 'running' | 'failed';
  revisionCount?: number;
  modelUsed?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  data?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  taskId?: string;
  summary: string;
  content: string;
  tags: string[];
  contextSignature?: string;
  effectiveness?: number;
  conflictSetId?: string;
  embeddingRef?: string;
  qualityScore?: number;
  status?: 'active' | 'invalidated' | 'superseded' | 'retired';
  invalidatedAt?: string;
  invalidationReason?: string;
  conflictWithIds?: string[];
  supersededAt?: string;
  supersededById?: string;
  retiredAt?: string;
  restoredAt?: string;
  quarantined?: boolean;
  quarantineReason?: string;
  quarantineCategory?: 'runtime_noise' | 'stale_fact' | 'conflicts_with_official_docs' | 'unsupported_claim';
  quarantineReasonDetail?: string;
  quarantineRestoreSuggestion?: string;
  quarantineEvidenceRefs?: string[];
  quarantinedAt?: string;
  createdAt: string;
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  conditions: string[];
  action: string;
  sourceTaskId?: string;
  contextSignature?: string;
  effectiveness?: number;
  conflictSetId?: string;
  status?: 'active' | 'invalidated' | 'superseded' | 'retired';
  invalidatedAt?: string;
  invalidationReason?: string;
  supersededAt?: string;
  supersededById?: string;
  retiredAt?: string;
  restoredAt?: string;
  createdAt: string;
}

export interface SkillStep {
  title: string;
  instruction: string;
  toolNames: string[];
}

export interface SkillToolContract {
  required: string[];
  optional?: string[];
  approvalSensitive?: string[];
}

export interface SkillConnectorContract {
  preferred: string[];
  required?: string[];
  configureIfMissing?: boolean;
}

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  applicableGoals: string[];
  requiredTools: string[];
  steps: SkillStep[];
  constraints: string[];
  successSignals: string[];
  riskLevel: RiskLevel;
  source: LearningSourceType;
  status: SkillStatus;
  previousStatus?: SkillStatus;
  disabledReason?: string;
  retiredAt?: string;
  restoredAt?: string;
  version?: string;
  successRate?: number;
  promotionState?: string;
  governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
  sourceRuns?: string[];
  sourceId?: string;
  installReceiptId?: string;
  bootstrap?: boolean;
  ownership?: CapabilityOwnershipRecord;
  domains?: string[];
  specialistAffinity?: string[];
  preferredMinistries?: WorkerDomain[];
  preferredConnectors?: string[];
  toolContract?: SkillToolContract;
  connectorContract?: SkillConnectorContract;
  requiredCapabilities?: string[];
  requiredConnectors?: string[];
  allowedTools?: string[];
  compatibility?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDraft {
  id: string;
  name: string;
  description: string;
  manifest: Record<string, unknown>;
  code?: string;
  status: 'draft' | 'lab' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecutionTrace {
  skillId: string;
  taskId: string;
  success: boolean;
  durationMs: number;
  failureReason?: string;
  reviewedByHuman?: boolean;
  createdAt: string;
}

export interface SkillEvalResult {
  skillId: string;
  pass: boolean;
  consecutiveSuccesses: number;
  severeIncidents: number;
  notes: string[];
}

export interface EvaluationResult {
  success: boolean;
  quality: 'low' | 'medium' | 'high';
  shouldRetry: boolean;
  shouldWriteMemory: boolean;
  shouldCreateRule: boolean;
  shouldExtractSkill: boolean;
  notes: string[];
}

export interface KnowledgeStoreRecord {
  id: string;
  store: KnowledgeStore;
  displayName: string;
  summary: string;
  rootPath?: string;
  status: 'active' | 'degraded' | 'readonly';
  updatedAt: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceType: 'workspace-docs' | 'repo-docs' | 'connector-manifest' | 'catalog-sync';
  uri: string;
  title: string;
  trustClass: TrustClass;
  receiptId?: string;
  version?: string;
  lastIngestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  searchable: boolean;
  receiptId?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEmbeddingRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  documentId: string;
  chunkId: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: EmbeddingModel;
  dimensions: number;
  embeddedAt: string;
  receiptId?: string;
  version?: string;
  status: 'ready' | 'failed';
  failureReason?: string;
}

export interface KnowledgeIngestionReceiptRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  sourceType: KnowledgeSourceRecord['sourceType'];
  version: string;
  status: 'completed' | 'partial' | 'failed';
  documentCount: number;
  chunkCount: number;
  embeddedChunkCount: number;
  skippedChunkCount?: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetState {
  stepBudget: number;
  stepsConsumed: number;
  retryBudget: number;
  retriesConsumed: number;
  sourceBudget: number;
  sourcesConsumed: number;
  tokenBudget?: number;
  tokenConsumed?: number;
  costBudgetUsd?: number;
  costConsumedUsd?: number;
  costConsumedCny?: number;
  softBudgetThreshold?: number;
  hardBudgetThreshold?: number;
  budgetInterruptState?: {
    status: 'idle' | 'soft-threshold-triggered' | 'hard-threshold-triggered' | 'resolved';
    interactionKind?: import('./primitives').InteractionKind;
    triggeredAt?: string;
    resolvedAt?: string;
    reason?: string;
  };
  fallbackModelId?: string;
  overBudget?: boolean;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  sourceId?: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: TrustClass;
  summary: string;
  detail?: Record<string, unknown>;
  linkedRunId?: string;
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

export function isCitationEvidenceSource(source: Pick<EvidenceRecord, 'sourceType' | 'sourceUrl' | 'trustClass'>) {
  if (
    source.sourceType === 'freshness_meta' ||
    source.sourceType === 'web_search_result' ||
    source.sourceType === 'web_research_plan'
  ) {
    return false;
  }

  if (source.sourceUrl) {
    return true;
  }

  return source.sourceType === 'document' || source.sourceType === 'web';
}

export interface LearningEvaluationRecord {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  shouldLearn?: boolean;
  shouldSearchSkills?: boolean;
  suggestedCandidateTypes?: Array<'memory' | 'rule' | 'skill'>;
  rationale?: string;
  notes: string[];
  governanceWarnings?: string[];
  candidateReasons?: string[];
  skippedReasons?: string[];
  conflictDetected?: boolean;
  conflictTargets?: string[];
  derivedFromLayers?: string[];
  policyMode?: string;
  expertiseSignals?: string[];
  budgetEfficiency?: {
    tokenEfficiencyScore?: number;
    costEfficiencyScore?: number;
    summary?: string;
  };
  timeoutStats?: {
    count: number;
    defaultAppliedCount: number;
  };
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
}

export interface ReflectionResult {
  failureReason?: string;
  rootCause?: string;
  whatWorked: string[];
  whatFailed: string[];
  nextAttemptAdvice: string[];
  memoryCandidate?: MemoryRecord;
}

export interface LearningJob {
  id: string;
  sourceType: LearningSourceType;
  status: 'queued' | 'running' | 'completed' | 'failed';
  documentUri: string;
  goal?: string;
  workflowId?: string;
  preferredUrls?: string[];
  summary?: string;
  sources?: EvidenceRecord[];
  trustSummary?: Partial<Record<TrustClass, number>>;
  learningEvaluation?: LearningEvaluationRecord;
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningQueueItem {
  id: string;
  taskId: string;
  runId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  mode?: 'task-learning' | 'dream-task';
  priority?: 'high' | 'normal';
  reason?: 'high_risk_failure' | 'rollback' | 'timeout_defaulted' | 'blocked_review' | 'normal' | 'dream-task';
  selectedCounselorId?: string;
  selectedVersion?: string;
  trace: ExecutionTrace[];
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

export interface LearningConflictRecord {
  id: string;
  contextSignature: string;
  conflictSetId?: string;
  memoryIds: string[];
  severity: 'low' | 'medium' | 'high';
  resolution: 'auto_preferred' | 'lightweight_review_required' | 'plan_question_required';
  status: 'open' | 'merged' | 'dismissed' | 'escalated';
  preferredMemoryId?: string;
  effectivenessSpread?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LearningConflictScanResult {
  scannedAt: string;
  conflictPairs: LearningConflictRecord[];
  mergeSuggestions: Array<{
    conflictId: string;
    preferredMemoryId?: string;
    loserMemoryIds: string[];
    suggestion: string;
  }>;
  manualReviewQueue: LearningConflictRecord[];
}
