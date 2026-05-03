import type { RetrievalHit } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export type PostRetrievalFilterReason =
  | 'low-score'
  | 'duplicate-chunk'
  | 'duplicate-parent'
  | 'low-context-value'
  | 'unsafe-content'
  | 'conflict-risk';

export interface PostRetrievalFilterDiagnostics {
  enabled: boolean;
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
  maskedCount?: number;
  reasons: Partial<Record<PostRetrievalFilterReason, number>>;
}

export interface PostRetrievalFilterResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalFilterDiagnostics;
}

export type RetrievalSafetyScanAction = 'keep' | 'mask' | 'drop';

export interface RetrievalSafetyScanResult {
  action: RetrievalSafetyScanAction;
  maskedContent?: string;
  reason?: string;
}

export interface RetrievalSafetyScanner {
  scan(hit: RetrievalHit): Promise<RetrievalSafetyScanResult>;
}

export interface PostRetrievalFilterContext {
  minScore?: number;
}

export interface PostRetrievalFilter {
  filter(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: PostRetrievalFilterContext
  ): Promise<PostRetrievalFilterResult>;
}
