import type { KnowledgeEmbeddingRecord, KnowledgeIndexingContext } from '../types/indexing.types';

export interface KnowledgeEmbedder {
  embed(params: {
    chunks: import('../types/indexing.types').KnowledgeChunkEnvelope[];
    context: KnowledgeIndexingContext;
  }): Promise<KnowledgeEmbeddingRecord[]>;
}
