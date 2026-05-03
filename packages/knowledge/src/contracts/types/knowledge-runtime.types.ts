import { z } from 'zod';

import {
  KnowledgeChunkRecordSchema,
  KnowledgeEmbeddingRecordSchema,
  KnowledgeIngestionReceiptRecordSchema,
  KnowledgeSourceRecordSchema,
  KnowledgeStoreRecordSchema
} from '../schemas/knowledge-runtime.schema';

export type {
  BudgetInterruptState,
  BudgetState,
  EvaluationResult,
  LearningConflictRecord,
  LearningConflictScanResult,
  LearningConflictScanSuggestion,
  LearningEvaluationBudgetEfficiency,
  LearningEvaluationRecord,
  LearningEvaluationSourceSummary,
  LearningEvaluationTimeoutStats,
  SkillGovernanceRecommendation
} from '@agent/core';

export type KnowledgeStoreRecord = z.infer<typeof KnowledgeStoreRecordSchema>;
export type KnowledgeSourceRecord = z.infer<typeof KnowledgeSourceRecordSchema>;
export type KnowledgeChunkRecord = z.infer<typeof KnowledgeChunkRecordSchema>;
export type KnowledgeEmbeddingRecord = z.infer<typeof KnowledgeEmbeddingRecordSchema>;
export type KnowledgeIngestionReceiptRecord = z.infer<typeof KnowledgeIngestionReceiptRecordSchema>;
