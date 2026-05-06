import { z } from 'zod';

import {
  BudgetInterruptStateSchema,
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningConflictRecordSchema,
  LearningConflictScanResultSchema,
  LearningConflictScanSuggestionSchema,
  LearningEvaluationBudgetEfficiencySchema,
  LearningEvaluationRecordSchema,
  LearningEvaluationSourceSummarySchema,
  LearningEvaluationTimeoutStatsSchema,
  SkillGovernanceRecommendationSchema
} from '@agent/core';

import { KnowledgeChunkMetadataSchema } from './knowledge-retrieval.schema';

/** Re-export learning contracts from {@link @agent/core} for callers that historically imported `@agent/knowledge`. */
export {
  BudgetInterruptStateSchema,
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningConflictRecordSchema,
  LearningConflictScanResultSchema,
  LearningConflictScanSuggestionSchema,
  LearningEvaluationBudgetEfficiencySchema,
  LearningEvaluationRecordSchema,
  LearningEvaluationSourceSummarySchema,
  LearningEvaluationTimeoutStatsSchema,
  SkillGovernanceRecommendationSchema
};

const KnowledgeStoreSchema = z.enum(['wenyuan', 'cangjing']);
const KnowledgeSourceTypeSchema = z.enum([
  'workspace-docs',
  'repo-docs',
  'connector-manifest',
  'catalog-sync',
  'user-upload',
  'web-curated'
]);
const KnowledgeStoreStatusSchema = z.enum(['active', 'degraded', 'readonly']);
const EmbeddingProviderSchema = z.string();
const EmbeddingModelSchema = z.string();

export const KnowledgeStoreRecordSchema = z.object({
  id: z.string(),
  store: KnowledgeStoreSchema,
  displayName: z.string(),
  summary: z.string(),
  rootPath: z.string().optional(),
  status: KnowledgeStoreStatusSchema,
  updatedAt: z.string()
});

export const KnowledgeSourceRecordSchema = z.object({
  id: z.string(),
  store: z.literal('cangjing'),
  sourceType: KnowledgeSourceTypeSchema,
  uri: z.string(),
  title: z.string(),
  trustClass: z.enum(['official', 'curated', 'community', 'unverified', 'internal']),
  receiptId: z.string().optional(),
  version: z.string().optional(),
  lastIngestedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const KnowledgeChunkRecordSchema = z.object({
  id: z.string(),
  store: z.literal('cangjing'),
  sourceId: z.string(),
  documentId: z.string(),
  chunkIndex: z.number(),
  content: z.string(),
  tokenCount: z.number().optional(),
  searchable: z.boolean(),
  metadata: KnowledgeChunkMetadataSchema.optional(),
  receiptId: z.string().optional(),
  version: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const KnowledgeEmbeddingRecordSchema = z.object({
  id: z.string(),
  store: z.literal('cangjing'),
  sourceId: z.string(),
  documentId: z.string(),
  chunkId: z.string(),
  embeddingProvider: EmbeddingProviderSchema,
  embeddingModel: EmbeddingModelSchema,
  dimensions: z.number(),
  embeddedAt: z.string(),
  receiptId: z.string().optional(),
  version: z.string().optional(),
  status: z.enum(['ready', 'failed']),
  failureReason: z.string().optional()
});

export const KnowledgeIngestionReceiptRecordSchema = z.object({
  id: z.string(),
  store: z.literal('cangjing'),
  sourceId: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  version: z.string(),
  status: z.enum(['completed', 'partial', 'failed']),
  documentCount: z.number(),
  chunkCount: z.number(),
  embeddedChunkCount: z.number(),
  skippedChunkCount: z.number().optional(),
  failureReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
