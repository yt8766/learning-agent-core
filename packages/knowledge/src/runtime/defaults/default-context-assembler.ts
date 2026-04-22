import type { RetrievalHit } from '@agent/core';

import type { ContextAssembler } from '../stages/context-assembler';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_CONTEXT_SEPARATOR } from './retrieval-runtime-defaults';

export class DefaultContextAssembler implements ContextAssembler {
  async assemble(hits: RetrievalHit[], _request: NormalizedRetrievalRequest): Promise<string> {
    return hits.map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.content}`).join(DEFAULT_CONTEXT_SEPARATOR);
  }
}
