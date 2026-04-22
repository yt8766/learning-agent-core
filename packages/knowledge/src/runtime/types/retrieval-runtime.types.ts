import type { RetrievalHit, RetrievalRequest } from '@agent/core';

export interface NormalizedRetrievalRequest extends RetrievalRequest {
  normalizedQuery: string;
  topK: number;
  rewriteReason?: string;
}

export interface RetrievalDiagnostics {
  runId: string;
  startedAt: string;
  durationMs: number;
  normalizedQuery: string;
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
