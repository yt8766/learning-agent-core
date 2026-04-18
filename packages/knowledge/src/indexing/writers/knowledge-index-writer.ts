import type { KnowledgeSource } from '@agent/core';

import type {
  KnowledgeChunkEnvelope,
  KnowledgeEmbeddingRecord,
  KnowledgeIndexingContext
} from '../types/indexing.types';

export interface KnowledgeIndexWriter {
  write(params: {
    sources: KnowledgeSource[];
    chunks: KnowledgeChunkEnvelope[];
    embeddings: KnowledgeEmbeddingRecord[];
    context: KnowledgeIndexingContext;
  }): Promise<void>;
}
