import type { RetrievalHit } from '@agent/core';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface ContextAssembler {
  assemble(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<string>;
}
