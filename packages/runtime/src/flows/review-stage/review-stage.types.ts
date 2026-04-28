import type { EvaluationResult } from '@agent/knowledge';
import type { AgentRoleValue, ReviewRecord } from '@agent/core';
import type { MinistryContractMeta, ReviewMinistryLike } from '@agent/core';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';

export type NormalizedReviewResult = {
  review: ReviewRecord;
  evaluation: EvaluationResult;
  critiqueResult?: TaskRecord['critiqueResult'];
  specialistFinding?: NonNullable<TaskRecord['specialistFindings']>[number];
  contractMeta: MinistryContractMeta;
};

export interface ReviewCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: TaskRecord, subgraphId: 'review') => void;
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRoleValue) => void;
  addMessage: (task: TaskRecord, type: 'review_result' | 'summary', content: string, from: AgentRoleValue) => void;
  upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  resolveReviewMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'xingbu-review' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  reviewExecution: (
    task: TaskRecord,
    xingbu: ReviewMinistryLike,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ) => Promise<NormalizedReviewResult>;
  persistReviewArtifacts: (
    task: TaskRecord,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ) => Promise<void>;
  enqueueTaskLearning: (task: TaskRecord, userFeedback?: string) => void;
  shouldRunLibuDocsDelivery: (workflow?: TaskRecord['resolvedWorkflow']) => boolean;
  buildFreshnessSourceSummary: (task: TaskRecord) => string | undefined;
  buildCitationSourceSummary: (task: TaskRecord) => string | undefined;
  appendDiagnosisEvidence: (
    task: TaskRecord,
    review: ReviewRecord,
    executionSummary: string,
    finalAnswer: string
  ) => void;
}
