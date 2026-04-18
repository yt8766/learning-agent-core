export type {
  Citation,
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceType,
  KnowledgeTrustClass,
  RetrievalHit,
  RetrievalRequest,
  RetrievalResult
} from '@agent/core';
export {
  CitationSchema,
  KnowledgeChunkSchema,
  KnowledgeSourceSchema,
  KnowledgeSourceTypeSchema,
  KnowledgeTrustClassSchema,
  RetrievalHitSchema,
  RetrievalRequestSchema,
  RetrievalResultSchema
} from '@agent/core';
export type {
  KnowledgeChunkRepository,
  KnowledgeFacade,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from './contracts/knowledge-facade';
export * from './contracts/knowledge-facade';
export * from './repositories/knowledge-source.repository';
export * from './repositories/knowledge-chunk.repository';
export * from './retrieval/knowledge-search-service';
export * from './runtime/local-knowledge-facade';
export * from './shared/knowledge-text-scoring';
export * from './indexing';
