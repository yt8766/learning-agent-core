import { z } from 'zod';

import { KnowledgeChunkMetadataSchema } from './knowledge-retrieval.schema';

export const BudgetInterruptStateSchema = z.object({
  status: z.enum(['idle', 'soft-threshold-triggered', 'hard-threshold-triggered', 'resolved']),
  interactionKind: z
    .enum([
      'approval',
      'plan-question',
      'supplemental-input',
      'revise-required',
      'micro-loop-exhausted',
      'mode-transition'
    ])
    .optional(),
  triggeredAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  reason: z.string().optional()
});

export const BudgetStateSchema = z.object({
  stepBudget: z.number(),
  stepsConsumed: z.number(),
  retryBudget: z.number(),
  retriesConsumed: z.number(),
  sourceBudget: z.number(),
  sourcesConsumed: z.number(),
  tokenBudget: z.number().optional(),
  tokenConsumed: z.number().optional(),
  costBudgetUsd: z.number().optional(),
  costConsumedUsd: z.number().optional(),
  costConsumedCny: z.number().optional(),
  softBudgetThreshold: z.number().optional(),
  hardBudgetThreshold: z.number().optional(),
  budgetInterruptState: BudgetInterruptStateSchema.optional(),
  fallbackModelId: z.string().optional(),
  overBudget: z.boolean().optional()
});

export const LearningEvaluationBudgetEfficiencySchema = z.object({
  tokenEfficiencyScore: z.number().optional(),
  costEfficiencyScore: z.number().optional(),
  summary: z.string().optional()
});

export const LearningEvaluationTimeoutStatsSchema = z.object({
  count: z.number(),
  defaultAppliedCount: z.number()
});

export const SkillGovernanceRecommendationSchema = z.object({
  skillId: z.string(),
  recommendation: z.enum(['promote', 'keep-lab', 'disable', 'retire']),
  successRate: z.number().optional(),
  promotionState: z.string().optional()
});

export const LearningEvaluationSourceSummarySchema = z.object({
  externalSourceCount: z.number(),
  internalSourceCount: z.number(),
  reusedMemoryCount: z.number(),
  reusedRuleCount: z.number(),
  reusedSkillCount: z.number()
});

export const EvaluationResultSchema = z.object({
  success: z.boolean(),
  quality: z.enum(['low', 'medium', 'high']),
  shouldRetry: z.boolean(),
  shouldWriteMemory: z.boolean(),
  shouldCreateRule: z.boolean(),
  shouldExtractSkill: z.boolean(),
  notes: z.array(z.string())
});

export const LearningEvaluationRecordSchema = z.object({
  score: z.number(),
  confidence: z.enum(['low', 'medium', 'high']),
  shouldLearn: z.boolean().optional(),
  shouldSearchSkills: z.boolean().optional(),
  suggestedCandidateTypes: z.array(z.enum(['memory', 'rule', 'skill'])).optional(),
  rationale: z.string().optional(),
  notes: z.array(z.string()),
  governanceWarnings: z.array(z.string()).optional(),
  candidateReasons: z.array(z.string()).optional(),
  skippedReasons: z.array(z.string()).optional(),
  conflictDetected: z.boolean().optional(),
  conflictTargets: z.array(z.string()).optional(),
  derivedFromLayers: z.array(z.string()).optional(),
  policyMode: z.string().optional(),
  expertiseSignals: z.array(z.string()).optional(),
  budgetEfficiency: LearningEvaluationBudgetEfficiencySchema.optional(),
  timeoutStats: LearningEvaluationTimeoutStatsSchema.optional(),
  skillGovernanceRecommendations: z.array(SkillGovernanceRecommendationSchema).optional(),
  recommendedCandidateIds: z.array(z.string()),
  autoConfirmCandidateIds: z.array(z.string()),
  sourceSummary: LearningEvaluationSourceSummarySchema
});

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

export const LearningConflictRecordSchema = z.object({
  id: z.string(),
  contextSignature: z.string(),
  conflictSetId: z.string().optional(),
  memoryIds: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high']),
  resolution: z.enum(['auto_preferred', 'lightweight_review_required', 'plan_question_required']),
  status: z.enum(['open', 'merged', 'dismissed', 'escalated']),
  preferredMemoryId: z.string().optional(),
  effectivenessSpread: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const LearningConflictScanSuggestionSchema = z.object({
  conflictId: z.string(),
  preferredMemoryId: z.string().optional(),
  loserMemoryIds: z.array(z.string()),
  suggestion: z.string()
});

export const LearningConflictScanResultSchema = z.object({
  scannedAt: z.string(),
  conflictPairs: z.array(LearningConflictRecordSchema),
  mergeSuggestions: z.array(LearningConflictScanSuggestionSchema),
  manualReviewQueue: z.array(LearningConflictRecordSchema)
});
