import type { RetrievalHit, RetrievalRequest } from '@agent/knowledge';
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
