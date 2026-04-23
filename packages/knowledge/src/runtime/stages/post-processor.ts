import type { RetrievalHit } from '@agent/core';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface RetrievalPostProcessor {
  process(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<RetrievalHit[]>;
}
