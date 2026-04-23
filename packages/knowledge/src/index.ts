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
export type { KnowledgeRetrievalRuntime, RetrievalPipelineConfig } from './contracts/knowledge-retrieval-runtime';
export type { ContextAssembler } from './runtime/stages/context-assembler';
export type { QueryNormalizer } from './runtime/stages/query-normalizer';
export type { RetrievalPostProcessor } from './runtime/stages/post-processor';
export type {
  KnowledgeRetrievalResult,
  NormalizedRetrievalRequest,
  RetrievalDiagnostics
} from './runtime/types/retrieval-runtime.types';
export { DefaultContextAssembler } from './runtime/defaults/default-context-assembler';
export { DefaultQueryNormalizer } from './runtime/defaults/default-query-normalizer';
export { DefaultRetrievalPostProcessor } from './runtime/defaults/default-post-processor';
export {
  DEFAULT_CONTEXT_SEPARATOR,
  DEFAULT_RETRIEVAL_LIMIT,
  DEFAULT_RETRIEVAL_MIN_SCORE
} from './runtime/defaults/retrieval-runtime-defaults';
export type { KnowledgeRetrievalRunOptions } from './runtime/pipeline/run-knowledge-retrieval';
export { runKnowledgeRetrieval } from './runtime/pipeline/run-knowledge-retrieval';
export * from './runtime/local-knowledge-facade';
export * from './runtime/local-knowledge-store';
export * from './shared/knowledge-text-scoring';
export * from './indexing';
