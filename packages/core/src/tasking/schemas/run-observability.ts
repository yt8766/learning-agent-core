import { z } from 'zod';

import { TaskStatusSchema } from '../../primitives';
import { RunTraceSpanRecordSchema } from '../../execution-trace';
import {
  RunDiagnosticKindSchema,
  RunDiagnosticSeveritySchema,
  RunRecoverabilitySchema,
  RunStageSchema,
  RunStageStatusSchema
} from './run-observability-semantics';
import { TaskLineageRecordSchema } from './task-lineage';

export const RunSummaryRecordSchema = z.object({
  taskId: z.string(),
  sessionId: z.string().optional(),
  goal: z.string(),
  lineage: TaskLineageRecordSchema.optional(),
  status: TaskStatusSchema.or(z.literal('blocked')),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  executionMode: z.enum(['plan', 'execute', 'imperial_direct']).optional(),
  interactionKind: z.enum(['approval', 'plan-question', 'supplemental-input']).optional(),
  currentStage: RunStageSchema.optional(),
  currentStep: z.string().optional(),
  currentNode: z.string().optional(),
  currentMinistry: z.string().optional(),
  currentWorker: z.string().optional(),
  workflow: z
    .object({
      id: z.string(),
      version: z.string().optional(),
      displayName: z.string().optional()
    })
    .optional(),
  subgraphTrail: z.array(z.string()).optional(),
  modelRoute: z
    .array(
      z.object({
        ministry: z.string().optional(),
        selectedModel: z.string().optional()
      })
    )
    .optional(),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
  hasInterrupt: z.boolean(),
  hasFallback: z.boolean(),
  hasRecoverableCheckpoint: z.boolean(),
  hasEvidenceWarning: z.boolean(),
  diagnosticFlags: z.array(RunDiagnosticKindSchema)
});

export const RunTimelineActorSchema = z.object({
  type: z.enum(['supervisor', 'ministry', 'worker', 'system', 'human']),
  id: z.string().optional(),
  displayName: z.string().optional()
});

export const RunTimelineItemRecordSchema = z.object({
  id: z.string(),
  stage: RunStageSchema,
  status: RunStageStatusSchema,
  title: z.string(),
  summary: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  actor: RunTimelineActorSchema.optional(),
  linkedSpanIds: z.array(z.string()).optional(),
  linkedCheckpointIds: z.array(z.string()).optional(),
  linkedEvidenceIds: z.array(z.string()).optional(),
  linkedInterruptIds: z.array(z.string()).optional(),
  detail: z
    .object({
      nodeCount: z.number().optional(),
      retryCount: z.number().optional(),
      fallbackCount: z.number().optional(),
      evidenceCount: z.number().optional(),
      approvalCount: z.number().optional()
    })
    .optional()
});

export const RunCheckpointSummaryRecordSchema = z.object({
  checkpointId: z.string(),
  sessionId: z.string().optional(),
  cursor: z.number().optional(),
  stage: RunStageSchema.optional(),
  currentStep: z.string().optional(),
  nodeLabel: z.string().optional(),
  status: TaskStatusSchema.or(z.literal('blocked')).optional(),
  summary: z.string(),
  createdAt: z.string(),
  recoverable: z.boolean(),
  recoverability: RunRecoverabilitySchema,
  agentStateCount: z.number().optional(),
  pendingApprovalCount: z.number().optional(),
  evidenceCount: z.number().optional(),
  thoughtChainCount: z.number().optional(),
  linkedSpanIds: z.array(z.string()).optional()
});

export const RunInterruptLedgerItemRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(['approval', 'reject', 'reject_with_feedback', 'cancel', 'recover', 'supplemental_input']),
  status: z.enum(['pending', 'resolved', 'timed_out', 'cancelled']),
  title: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  actor: z
    .object({
      type: z.enum(['human', 'system']),
      id: z.string().optional(),
      displayName: z.string().optional()
    })
    .optional(),
  stage: RunStageSchema.optional(),
  relatedCheckpointId: z.string().optional(),
  relatedSpanId: z.string().optional(),
  feedback: z.string().optional()
});

export const RunDiagnosticSuggestedActionSchema = z.object({
  type: z.enum(['approve', 'recover', 'inspect_evidence', 'retry', 'review_trace', 'human_input']),
  label: z.string()
});

export const RunDiagnosticRecordSchema = z.object({
  id: z.string(),
  kind: RunDiagnosticKindSchema,
  severity: RunDiagnosticSeveritySchema,
  title: z.string(),
  summary: z.string(),
  detail: z.string().optional(),
  detectedAt: z.string(),
  linkedStage: RunStageSchema.optional(),
  linkedSpanId: z.string().optional(),
  linkedCheckpointId: z.string().optional(),
  suggestedAction: RunDiagnosticSuggestedActionSchema.optional()
});

export const RunArtifactRecordSchema = z.object({
  id: z.string(),
  type: z.enum(['final_answer', 'review_summary', 'learning_summary', 'tool_output', 'delivery']),
  title: z.string(),
  summary: z.string().optional(),
  content: z.string().optional(),
  createdAt: z.string()
});

export const RunEvidenceRecordSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  summary: z.string(),
  sourceType: z.string().optional(),
  trustLevel: z.enum(['low', 'medium', 'high']).optional(),
  stage: RunStageSchema.optional(),
  citedAt: z.string().optional(),
  linkedSpanId: z.string().optional(),
  linkedCheckpointId: z.string().optional()
});

export const RunReviewSummaryRecordSchema = z.object({
  decision: z.string().optional(),
  summary: z.string().optional()
});

export const RunLearningSummaryRecordSchema = z.object({
  recommendedCandidateIds: z.array(z.string()).optional(),
  autoConfirmCandidateIds: z.array(z.string()).optional(),
  governanceWarnings: z.array(z.string()).optional()
});

export const RunBundleRecordSchema = z.object({
  run: RunSummaryRecordSchema,
  timeline: z.array(RunTimelineItemRecordSchema),
  traces: z.array(RunTraceSpanRecordSchema),
  checkpoints: z.array(RunCheckpointSummaryRecordSchema),
  interrupts: z.array(RunInterruptLedgerItemRecordSchema),
  diagnostics: z.array(RunDiagnosticRecordSchema),
  artifacts: z.array(RunArtifactRecordSchema),
  evidence: z.array(RunEvidenceRecordSchema),
  review: RunReviewSummaryRecordSchema.optional(),
  learning: RunLearningSummaryRecordSchema.optional()
});
