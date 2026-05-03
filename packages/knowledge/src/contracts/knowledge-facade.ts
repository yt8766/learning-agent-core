import type { KnowledgeChunk, KnowledgeSource, RetrievalRequest, RetrievalResult } from '../index';

export interface KnowledgeSourceRepository {
  list(): Promise<KnowledgeSource[]>;
  getById(id: string): Promise<KnowledgeSource | null>;
  upsert(source: KnowledgeSource): Promise<void>;
}

export interface KnowledgeChunkRepository {
  list(): Promise<KnowledgeChunk[]>;
  getByIds(ids: string[]): Promise<KnowledgeChunk[]>;
  listBySourceId(sourceId: string): Promise<KnowledgeChunk[]>;
  upsert(chunk: KnowledgeChunk): Promise<void>;
}

export interface KnowledgeSearchService {
  search(request: RetrievalRequest): Promise<RetrievalResult>;
}

export interface KnowledgeFacade {
  readonly sourceRepository: KnowledgeSourceRepository;
  readonly chunkRepository: KnowledgeChunkRepository;
  readonly searchService: KnowledgeSearchService;
}
