import { z } from 'zod';

import {
  CitationSchema,
  ChromaClientConfigSchema,
  ChromaCollectionConfigSchema,
  ChromaKnowledgeConfigSchema,
  HybridKnowledgeSearchDiagnosticsConfigSchema,
  HybridKnowledgeSearchHealthConfigSchema,
  HybridKnowledgeSearchModeSchema,
  HybridKnowledgeSearchProductionConfigSchema,
  KnowledgeChunkMetadataSchema,
  KnowledgeChunkSchema,
  KnowledgeRetrievalFiltersSchema,
  KnowledgeSourceSchema,
  KnowledgeSourceTypeSchema,
  KnowledgeTrustClassSchema,
  OpenSearchClientConfigSchema,
  OpenSearchIndexConfigSchema,
  OpenSearchKnowledgeConfigSchema,
  RetrievalHitSchema,
  RetrievalRequestSchema,
  RetrievalResultSchema
} from '../schemas/knowledge-retrieval.schema';

export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;
export type KnowledgeTrustClass = z.infer<typeof KnowledgeTrustClassSchema>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type KnowledgeChunkMetadata = z.infer<typeof KnowledgeChunkMetadataSchema>;
export type KnowledgeRetrievalFilters = z.infer<typeof KnowledgeRetrievalFiltersSchema>;
export type HybridKnowledgeSearchMode = z.infer<typeof HybridKnowledgeSearchModeSchema>;
export type OpenSearchIndexConfig = z.infer<typeof OpenSearchIndexConfigSchema>;
export type OpenSearchClientConfig = z.infer<typeof OpenSearchClientConfigSchema>;
export type OpenSearchKnowledgeConfig = z.infer<typeof OpenSearchKnowledgeConfigSchema>;
export type ChromaCollectionConfig = z.infer<typeof ChromaCollectionConfigSchema>;
export type ChromaClientConfig = z.infer<typeof ChromaClientConfigSchema>;
export type ChromaKnowledgeConfig = z.infer<typeof ChromaKnowledgeConfigSchema>;
export type HybridKnowledgeSearchDiagnosticsConfig = z.infer<typeof HybridKnowledgeSearchDiagnosticsConfigSchema>;
export type HybridKnowledgeSearchHealthConfig = z.infer<typeof HybridKnowledgeSearchHealthConfigSchema>;
export type HybridKnowledgeSearchProductionConfig = z.infer<typeof HybridKnowledgeSearchProductionConfigSchema>;
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type RetrievalRequest = z.infer<typeof RetrievalRequestSchema>;
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
