import type { RetrievalRequest } from '@agent/core';

import type { ContextAssembler } from '../runtime/stages/context-assembler';
import type { QueryNormalizer } from '../runtime/stages/query-normalizer';
import type { RetrievalPostProcessor } from '../runtime/stages/post-processor';
import type { KnowledgeRetrievalResult } from '../runtime/types/retrieval-runtime.types';
import type { KnowledgeFacade } from './knowledge-facade';

export interface RetrievalPipelineConfig {
  queryNormalizer?: QueryNormalizer;
  postProcessor?: RetrievalPostProcessor;
  contextAssembler?: ContextAssembler;
}

export interface KnowledgeRetrievalRuntime extends KnowledgeFacade {
  retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult>;
}
