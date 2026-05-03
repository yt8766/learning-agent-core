import type { RetrievalRequest } from '../../index';

import type { QueryNormalizer } from '../stages/query-normalizer';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_RETRIEVAL_LIMIT } from './retrieval-runtime-defaults';
import { buildQueryVariants, cleanQueryText, rewriteQueryText } from './default-query-normalizer.helpers';

export class DefaultQueryNormalizer implements QueryNormalizer {
  async normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest> {
    const originalQuery = request.query;
    const cleanedQuery = cleanQueryText(originalQuery);
    const rewriteResult = rewriteQueryText(cleanedQuery);
    const normalizedQuery = rewriteResult.query || cleanedQuery;
    const queryVariants = buildQueryVariants(originalQuery, normalizedQuery);

    return {
      ...request,
      originalQuery,
      normalizedQuery,
      topK: request.limit ?? DEFAULT_RETRIEVAL_LIMIT,
      rewriteApplied: rewriteResult.applied,
      rewriteReason: rewriteResult.reason,
      queryVariants: queryVariants.length > 0 ? queryVariants : [normalizedQuery || cleanedQuery || originalQuery]
    };
  }
}
