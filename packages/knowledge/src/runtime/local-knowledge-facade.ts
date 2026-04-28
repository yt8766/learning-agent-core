import type { RetrievalRequest } from '@agent/knowledge';

import type { KnowledgeRetrievalRuntime, RetrievalPipelineConfig } from '../contracts/knowledge-retrieval-runtime';
import { InMemoryKnowledgeChunkRepository } from '../repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../repositories/knowledge-source.repository';
import { DefaultKnowledgeSearchService } from '../retrieval/knowledge-search-service';
import { runKnowledgeRetrieval } from './pipeline/run-knowledge-retrieval';
import type { KnowledgeRetrievalResult } from './types/retrieval-runtime.types';

export class LocalKnowledgeFacade implements KnowledgeRetrievalRuntime {
  readonly sourceRepository = new InMemoryKnowledgeSourceRepository();
  readonly chunkRepository = new InMemoryKnowledgeChunkRepository();
  readonly searchService = new DefaultKnowledgeSearchService(this.sourceRepository, this.chunkRepository);

  async retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult> {
    return runKnowledgeRetrieval({ request, searchService: this.searchService, pipeline });
  }
}
