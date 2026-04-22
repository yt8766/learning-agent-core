import type { RetrievalRequest } from '@agent/core';

import type { QueryNormalizer } from '../stages/query-normalizer';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_RETRIEVAL_LIMIT } from './retrieval-runtime-defaults';

export class DefaultQueryNormalizer implements QueryNormalizer {
  async normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest> {
    return {
      ...request,
      normalizedQuery: request.query.trim(),
      topK: request.limit ?? DEFAULT_RETRIEVAL_LIMIT
    };
  }
}
