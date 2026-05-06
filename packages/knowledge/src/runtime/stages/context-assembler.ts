import type { RetrievalHit } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface ContextAssembler {
  assemble(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<string>;
}
