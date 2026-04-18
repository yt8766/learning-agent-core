import type { KnowledgeSource } from '@agent/core';

import type { KnowledgeIndexWriter } from './knowledge-index-writer';
import type {
  KnowledgeChunkEnvelope,
  KnowledgeEmbeddingRecord,
  KnowledgeIndexingContext
} from '../types/indexing.types';

export class InMemoryKnowledgeIndexWriter implements KnowledgeIndexWriter {
  readonly sources: KnowledgeSource[] = [];
  readonly chunks: KnowledgeChunkEnvelope[] = [];
  readonly embeddings: KnowledgeEmbeddingRecord[] = [];

  async write(params: {
    sources: KnowledgeSource[];
    chunks: KnowledgeChunkEnvelope[];
    embeddings: KnowledgeEmbeddingRecord[];
    context: KnowledgeIndexingContext;
  }): Promise<void> {
    this.sources.push(...params.sources);
    this.chunks.push(...params.chunks);
    this.embeddings.push(...params.embeddings);
  }
}
