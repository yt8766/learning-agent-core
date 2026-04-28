import type { RetrievalRequest } from '@agent/knowledge';

import type { QueryNormalizer } from '../stages/query-normalizer';
import type { QueryRewriteProvider } from '../stages/query-rewrite-provider';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { buildQueryVariants } from './default-query-normalizer.helpers';
import { DefaultQueryNormalizer } from './default-query-normalizer';

function isAlreadyNormalized(request: RetrievalRequest): request is NormalizedRetrievalRequest {
  return 'normalizedQuery' in request && typeof (request as NormalizedRetrievalRequest).normalizedQuery === 'string';
}

export class LlmQueryNormalizer implements QueryNormalizer {
  constructor(
    private readonly rewriteProvider: QueryRewriteProvider,
    private readonly fallback: QueryNormalizer = new DefaultQueryNormalizer()
  ) {}

  async normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest> {
    const base = isAlreadyNormalized(request) ? request : await this.fallback.normalize(request);

    try {
      const rewritten = await this.rewriteProvider.rewrite(base.normalizedQuery);
      return {
        ...base,
        normalizedQuery: rewritten,
        rewriteApplied: true,
        rewriteReason: 'llm-semantic-rewrite',
        queryVariants: buildQueryVariants(base.originalQuery ?? request.query, rewritten)
      };
    } catch {
      return base;
    }
  }
}
