import type {
  ChatCheckpointRecord,
  ExecutionTrace,
  RunBundleRecord,
  RunCheckpointSummaryRecord,
  RunDiagnosticKind,
  RunDiagnosticRecord,
  RunInterruptLedgerItemRecord,
  RunStage,
  RunSummaryRecord,
  RunTimelineItemRecord,
  RunTraceSpanRecord
} from '@agent/core';

export interface RuntimeObservabilityTaskLike {
  id: string;
  goal: string;
  lineage?: RunSummaryRecord['lineage'];
  status: string;
  executionMode?: string;
  planMode?: string;
  executionPlan?: {
    mode?: string;
  };
  sessionId?: string;
  currentNode?: string;
  currentStep?: string;
  currentMinistry?: string;
  currentWorker?: string;
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
  maxRetries?: number;
  resolvedWorkflow?: RunSummaryRecord['workflow'];
  subgraphTrail?: string[];
  modelRoute?: RunSummaryRecord['modelRoute'];
  trace?: ExecutionTrace[];
  activeInterrupt?: {
    id?: string;
    kind?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    feedback?: string;
    intent?: string;
    toolName?: string;
    requestedBy?: string;
    reason?: string;
    source?: string;
    resumeStrategy?: string;
    payload?: Record<string, unknown>;
  };
  interruptHistory?: Array<{
    id?: string;
    kind?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    feedback?: string;
    intent?: string;
    toolName?: string;
    requestedBy?: string;
    reason?: string;
    source?: string;
    resumeStrategy?: string;
    payload?: Record<string, unknown>;
  }>;
  externalSources?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    sourceType?: string;
    trustClass?: string;
    createdAt?: string;
    sourceUrl?: string;
  }>;
  learningEvaluation?: {
    governanceWarnings?: string[];
    recommendedCandidateIds?: string[];
    autoConfirmCandidateIds?: string[];
  };
  governanceReport?: {
    reviewOutcome?: {
      decision?: string;
      summary?: string;
    };
  };
  result?: string;
}

export interface RunObservabilityBundleParts {
  run: RunSummaryRecord;
  timeline: RunTimelineItemRecord[];
  traces: RunTraceSpanRecord[];
  checkpoints: RunCheckpointSummaryRecord[];
  interrupts: RunInterruptLedgerItemRecord[];
  diagnostics: RunDiagnosticRecord[];
  diagnosticFlags: RunDiagnosticKind[];
}

export interface RunStageInput {
  node?: string;
  stage?: string;
  summary?: string;
  currentStep?: string;
  currentNode?: string;
  currentMinistry?: string;
}

export type RuntimeObservabilityBundle = RunBundleRecord;

export type RuntimeObservabilityCheckpointLike = Partial<ChatCheckpointRecord> | undefined;
