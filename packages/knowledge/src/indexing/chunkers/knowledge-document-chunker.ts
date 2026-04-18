import type { KnowledgeChunk, KnowledgeSource } from '@agent/core';

import type { KnowledgeIndexingContext, KnowledgeIndexingDocument } from '../types/indexing.types';

export interface KnowledgeDocumentChunker {
  chunk(params: {
    source: KnowledgeSource;
    document: KnowledgeIndexingDocument;
    context: KnowledgeIndexingContext;
  }): Promise<KnowledgeChunk[]> | KnowledgeChunk[];
}
