import type { KnowledgeFacade } from '../contracts/knowledge-facade';
import { InMemoryKnowledgeChunkRepository } from '../repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../repositories/knowledge-source.repository';
import { DefaultKnowledgeSearchService } from '../retrieval/knowledge-search-service';

export class LocalKnowledgeFacade implements KnowledgeFacade {
  readonly sourceRepository = new InMemoryKnowledgeSourceRepository();
  readonly chunkRepository = new InMemoryKnowledgeChunkRepository();
  readonly searchService = new DefaultKnowledgeSearchService(this.sourceRepository, this.chunkRepository);
}
