import type { RetrievalHit, RetrievalRequest } from '@agent/knowledge';

export interface NormalizedRetrievalRequest extends RetrievalRequest {
  originalQuery?: string;
  normalizedQuery: string;
  topK: number;
  rewriteApplied?: boolean;
  rewriteReason?: string;
  queryVariants?: string[];
}

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
}

export interface KnowledgeRetrievalResult {
  hits: RetrievalHit[];
  total: number;
  contextBundle?: string;
  diagnostics?: RetrievalDiagnostics;
}
