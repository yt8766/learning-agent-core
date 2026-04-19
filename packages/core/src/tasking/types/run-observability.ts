import { z } from 'zod';

import {
  RunArtifactRecordSchema,
  RunBundleRecordSchema,
  RunCheckpointSummaryRecordSchema,
  RunDiagnosticRecordSchema,
  RunEvidenceRecordSchema,
  RunInterruptLedgerItemRecordSchema,
  RunLearningSummaryRecordSchema,
  RunReviewSummaryRecordSchema,
  RunSummaryRecordSchema,
  RunTimelineItemRecordSchema
} from '../schemas/run-observability';
import {
  RunDiagnosticKindSchema,
  RunDiagnosticSeveritySchema,
  RunRecoverabilitySchema,
  RunSpanStatusSchema,
  RunStageSchema,
  RunStageStatusSchema
} from '../schemas/run-observability-semantics';

export type RunStage = z.infer<typeof RunStageSchema>;
export type RunStageStatus = z.infer<typeof RunStageStatusSchema>;
export type RunSpanStatus = z.infer<typeof RunSpanStatusSchema>;
export type RunDiagnosticKind = z.infer<typeof RunDiagnosticKindSchema>;
export type RunDiagnosticSeverity = z.infer<typeof RunDiagnosticSeveritySchema>;
export type RunRecoverability = z.infer<typeof RunRecoverabilitySchema>;
export type RunSummaryRecord = z.infer<typeof RunSummaryRecordSchema>;
export type RunTimelineItemRecord = z.infer<typeof RunTimelineItemRecordSchema>;
export type RunCheckpointSummaryRecord = z.infer<typeof RunCheckpointSummaryRecordSchema>;
export type RunInterruptLedgerItemRecord = z.infer<typeof RunInterruptLedgerItemRecordSchema>;
export type RunDiagnosticRecord = z.infer<typeof RunDiagnosticRecordSchema>;
export type RunArtifactRecord = z.infer<typeof RunArtifactRecordSchema>;
export type RunEvidenceRecord = z.infer<typeof RunEvidenceRecordSchema>;
export type RunReviewSummaryRecord = z.infer<typeof RunReviewSummaryRecordSchema>;
export type RunLearningSummaryRecord = z.infer<typeof RunLearningSummaryRecordSchema>;
export type RunBundleRecord = z.infer<typeof RunBundleRecordSchema>;
