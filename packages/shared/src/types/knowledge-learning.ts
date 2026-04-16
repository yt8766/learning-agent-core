import type { LearningSourceType, TrustClass } from './primitives';
import type { EvidenceRecord } from './knowledge-evidence';
import type { ExecutionTrace, MemoryRecord } from './knowledge-memory';

export interface EvaluationResult {
  success: boolean;
  quality: 'low' | 'medium' | 'high';
  shouldRetry: boolean;
  shouldWriteMemory: boolean;
  shouldCreateRule: boolean;
  shouldExtractSkill: boolean;
  notes: string[];
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
