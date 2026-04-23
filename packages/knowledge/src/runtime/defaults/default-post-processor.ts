import type { RetrievalHit } from '@agent/core';

import type { RetrievalPostProcessor } from '../stages/post-processor';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_RETRIEVAL_MIN_SCORE } from './retrieval-runtime-defaults';

export class DefaultRetrievalPostProcessor implements RetrievalPostProcessor {
  constructor(private readonly minScore: number = DEFAULT_RETRIEVAL_MIN_SCORE) {}

  async process(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<RetrievalHit[]> {
    return hits.filter(hit => hit.score > this.minScore).slice(0, request.topK);
  }
}
