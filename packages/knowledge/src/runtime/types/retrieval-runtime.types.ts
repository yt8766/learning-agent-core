import type { RetrievalHit, RetrievalRequest } from '../../index';
import { z } from 'zod';

import { PostRetrievalDiagnosticsSchema } from '../../contracts/schemas/knowledge-retrieval.schema';
import type { ContextExpansionDiagnostics } from '../stages/context-expander';

export const HybridRetrievalModeSchema = z.enum(['hybrid', 'keyword-only', 'vector-only', 'none']);
export const HybridRetrieverIdSchema = z.enum(['keyword', 'vector']);
export const RetrievalFusionStrategyNameSchema = z.enum(['rrf']);

export const HybridRetrievalDiagnosticsSchema = z.object({
  retrievalMode: HybridRetrievalModeSchema,
  enabledRetrievers: z.array(HybridRetrieverIdSchema),
  failedRetrievers: z.array(HybridRetrieverIdSchema),
  fusionStrategy: RetrievalFusionStrategyNameSchema,
  prefilterApplied: z.boolean(),
  candidateCount: z.number().int().nonnegative()
});

export type HybridRetrievalMode = z.infer<typeof HybridRetrievalModeSchema>;
export type HybridRetrieverId = z.infer<typeof HybridRetrieverIdSchema>;
export type RetrievalFusionStrategyName = z.infer<typeof RetrievalFusionStrategyNameSchema>;
export type HybridRetrievalDiagnostics = z.infer<typeof HybridRetrievalDiagnosticsSchema>;

export interface NormalizedRetrievalRequest extends RetrievalRequest {
  originalQuery?: string;
  normalizedQuery: string;
  topK: number;
  rewriteApplied?: boolean;
  rewriteReason?: string;
  queryVariants?: string[];
}

export interface RetrievalFilteringStageDiagnostics {
  stage: 'pre-merge-defensive' | 'context-expansion-defensive';
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
}

export interface RetrievalFilteringDiagnostics {
  enabled: boolean;
  stages: RetrievalFilteringStageDiagnostics[];
}

export type PostRetrievalDiagnostics = z.infer<typeof PostRetrievalDiagnosticsSchema>;

export const RetrievalFilteringStageDiagnosticsSchema = z.object({
  stage: z.enum(['pre-merge-defensive', 'context-expansion-defensive']),
  beforeCount: z.number().int().nonnegative(),
  afterCount: z.number().int().nonnegative(),
  droppedCount: z.number().int().nonnegative()
});

export const RetrievalFilteringDiagnosticsSchema = z.object({
  enabled: z.boolean(),
  stages: z.array(RetrievalFilteringStageDiagnosticsSchema)
});

export const ContextExpansionDiagnosticsSchema = z
  .object({
    enabled: z.boolean(),
    seedCount: z.number().int().nonnegative(),
    candidateCount: z.number().int().nonnegative(),
    addedCount: z.number().int().nonnegative(),
    dedupedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative().optional(),
    droppedByFilterCount: z.number().int().nonnegative(),
    maxExpandedHits: z.number().int().nonnegative().optional()
  })
  .strict();

export const RetrievalDiagnosticsSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  durationMs: z.number().nonnegative(),
  originalQuery: z.string(),
  normalizedQuery: z.string(),
  rewriteApplied: z.boolean(),
  rewriteReason: z.string().optional(),
  queryVariants: z.array(z.string()),
  executedQueries: z.array(z.string()),
  preHitCount: z.number().int().nonnegative(),
  postHitCount: z.number().int().nonnegative(),
  contextAssembled: z.boolean(),
  contextExpansion: ContextExpansionDiagnosticsSchema.optional(),
  postRetrieval: PostRetrievalDiagnosticsSchema.optional(),
  filtering: RetrievalFilteringDiagnosticsSchema.optional(),
  hybrid: HybridRetrievalDiagnosticsSchema.optional()
});

export interface RetrievalDiagnostics {
  runId: string;
  startedAt: string;
  durationMs: number;
  originalQuery: string;
  normalizedQuery: string;
  rewriteApplied: boolean;
  rewriteReason?: string;
  queryVariants: string[];
  executedQueries: string[];
  preHitCount: number;
  postHitCount: number;
  contextAssembled: boolean;
  contextExpansion?: ContextExpansionDiagnostics;
  postRetrieval?: PostRetrievalDiagnostics;
  filtering?: RetrievalFilteringDiagnostics;
  hybrid?: HybridRetrievalDiagnostics;
}

export interface KnowledgeRetrievalResult {
  hits: RetrievalHit[];
  total: number;
  contextBundle?: string;
  diagnostics?: RetrievalDiagnostics;
}
