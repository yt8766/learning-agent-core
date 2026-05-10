import { z } from 'zod';

import {
  KnowledgeEvalExpectedAnswerSchema,
  KnowledgeEvalMetricSummarySchema,
  KnowledgeEvalObservedAnswerSchema,
  KnowledgeEvalSampleSchema,
  KnowledgeRagErrorRecordSchema,
  KnowledgeRagEventNameSchema,
  KnowledgeRagEventSchema,
  KnowledgeRagEventStageSchema,
  KnowledgeRagFeedbackLabelSchema,
  KnowledgeRagFeedbackSchema,
  KnowledgeRagFeedbackSourceSchema,
  KnowledgeRagGenerationSnapshotSchema,
  KnowledgeRagIndexingSnapshotSchema,
  KnowledgeRagMetricSchema,
  KnowledgeRagMetricUnitSchema,
  KnowledgeRagQuerySnapshotSchema,
  KnowledgeRagTraceRetrievalModeSchema,
  KnowledgeRagTraceRetrievalDiagnosticsSchema,
  KnowledgeRagRetrievalHitSnapshotSchema,
  KnowledgeRagRetrievalSnapshotSchema,
  KnowledgeRagTraceOperationSchema,
  KnowledgeRagTraceSchema,
  KnowledgeRagTraceStatusSchema
} from '../schemas/knowledge-observability-eval.schema';

export type KnowledgeRagEventName = z.infer<typeof KnowledgeRagEventNameSchema>;
export type KnowledgeRagTraceOperation = z.infer<typeof KnowledgeRagTraceOperationSchema>;
export type KnowledgeRagTraceStatus = z.infer<typeof KnowledgeRagTraceStatusSchema>;
export type KnowledgeRagTraceRetrievalMode = z.infer<typeof KnowledgeRagTraceRetrievalModeSchema>;
export type KnowledgeRagEventStage = z.infer<typeof KnowledgeRagEventStageSchema>;
export type KnowledgeRagFeedbackLabel = z.infer<typeof KnowledgeRagFeedbackLabelSchema>;
export type KnowledgeRagFeedbackSource = z.infer<typeof KnowledgeRagFeedbackSourceSchema>;
export type KnowledgeRagQuerySnapshot = z.infer<typeof KnowledgeRagQuerySnapshotSchema>;
export type KnowledgeRagTraceRetrievalDiagnostics = z.infer<typeof KnowledgeRagTraceRetrievalDiagnosticsSchema>;
export type KnowledgeRagRetrievalHitSnapshot = z.infer<typeof KnowledgeRagRetrievalHitSnapshotSchema>;
export type KnowledgeRagRetrievalSnapshot = z.infer<typeof KnowledgeRagRetrievalSnapshotSchema>;
export type KnowledgeRagGenerationSnapshot = z.infer<typeof KnowledgeRagGenerationSnapshotSchema>;
export type KnowledgeRagIndexingSnapshot = z.infer<typeof KnowledgeRagIndexingSnapshotSchema>;
export type KnowledgeRagFeedback = z.infer<typeof KnowledgeRagFeedbackSchema>;
export type KnowledgeRagErrorRecord = z.infer<typeof KnowledgeRagErrorRecordSchema>;
export type KnowledgeRagMetricUnit = z.infer<typeof KnowledgeRagMetricUnitSchema>;
export type KnowledgeRagMetric = z.infer<typeof KnowledgeRagMetricSchema>;
export type KnowledgeRagEvent = z.infer<typeof KnowledgeRagEventSchema>;
export type KnowledgeRagTrace = z.infer<typeof KnowledgeRagTraceSchema>;
export type KnowledgeEvalExpectedAnswer = z.infer<typeof KnowledgeEvalExpectedAnswerSchema>;
export type KnowledgeEvalObservedAnswer = z.infer<typeof KnowledgeEvalObservedAnswerSchema>;
export type KnowledgeEvalSample = z.infer<typeof KnowledgeEvalSampleSchema>;
export type KnowledgeEvalMetricSummary = z.infer<typeof KnowledgeEvalMetricSummarySchema>;
