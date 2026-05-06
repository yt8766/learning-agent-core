import type { RetrievalRequest } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface QueryNormalizer {
  normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest>;
}
