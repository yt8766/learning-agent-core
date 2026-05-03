import type { LearningEvaluationRecord } from '@agent/core';
import type { EvidenceRecord } from '@agent/memory';
import type { ExecutionTrace, TrustClass } from '@agent/core';

export type RuntimeLearningSourceType =
  | 'execution'
  | 'document'
  | 'research'
  | 'memory'
  | 'official-docs'
  | 'repo'
  | 'community'
  | 'web'
  | 'market';

export interface RuntimeLearningJob {
  id: string;
  sourceType: RuntimeLearningSourceType;
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

export interface RuntimeLearningQueueItem {
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
