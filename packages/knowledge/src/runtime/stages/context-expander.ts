import type { RetrievalHit } from '../../index';

import type { ResolvedKnowledgeRetrievalFilters } from '../../retrieval/knowledge-retrieval-filters';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface ContextExpansionPolicy {
  includeParents?: boolean;
  includeNeighbors?: boolean;
  maxExpandedHits?: number;
}

export interface ContextExpansionDiagnostics {
  enabled: boolean;
  seedCount: number;
  candidateCount: number;
  addedCount: number;
  dedupedCount: number;
  missingCount?: number;
  droppedByFilterCount: number;
  maxExpandedHits?: number;
}

export interface ContextExpansionContext {
  filters: ResolvedKnowledgeRetrievalFilters;
  policy?: ContextExpansionPolicy;
}

export interface ContextExpansionResult {
  hits: RetrievalHit[];
  diagnostics: ContextExpansionDiagnostics;
}

export interface ContextExpander {
  expand(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context: ContextExpansionContext
  ): Promise<ContextExpansionResult>;
}
