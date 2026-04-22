import type { RetrievalRequest } from '@agent/core';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface QueryNormalizer {
  normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest>;
}
