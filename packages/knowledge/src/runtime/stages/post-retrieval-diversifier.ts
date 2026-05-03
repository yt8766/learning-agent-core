import type { RetrievalHit } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface PostRetrievalDiversificationPolicy {
  maxPerSource?: number;
  maxPerParent?: number;
}

export interface PostRetrievalDiversificationDiagnostics {
  enabled: boolean;
  strategy: 'source-parent-section-coverage';
  beforeCount: number;
  afterCount: number;
  maxPerSource: number;
  maxPerParent: number;
}

export interface PostRetrievalDiversifyResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalDiversificationDiagnostics;
}

export interface PostRetrievalDiversificationContext {
  policy?: PostRetrievalDiversificationPolicy;
}

export interface PostRetrievalDiversifier {
  diversify(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: PostRetrievalDiversificationContext
  ): Promise<PostRetrievalDiversifyResult>;
}
