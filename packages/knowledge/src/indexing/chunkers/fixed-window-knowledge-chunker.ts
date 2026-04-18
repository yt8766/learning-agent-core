import type { KnowledgeChunk, KnowledgeSource } from '@agent/core';

import type { KnowledgeDocumentChunker } from './knowledge-document-chunker';
import type { KnowledgeIndexingContext, KnowledgeIndexingDocument } from '../types/indexing.types';

export class FixedWindowKnowledgeChunker implements KnowledgeDocumentChunker {
  async chunk(params: {
    source: KnowledgeSource;
    document: KnowledgeIndexingDocument;
    context: KnowledgeIndexingContext;
  }): Promise<KnowledgeChunk[]> {
    const { document, context } = params;
    const chunks: KnowledgeChunk[] = [];
    const size = Math.max(1, context.chunkSize);
    const overlap = Math.max(0, Math.min(context.chunkOverlap, size - 1));
    const step = Math.max(1, size - overlap);

    let chunkIndex = 0;
    for (let start = 0; start < document.content.length; start += step) {
      const content = document.content.slice(start, start + size).trim();
      if (!content) {
        continue;
      }
      chunks.push({
        id: `${document.id}#chunk-${chunkIndex}`,
        sourceId: document.sourceId,
        documentId: document.id,
        chunkIndex,
        content,
        searchable: true,
        tokenCount: content.length,
        updatedAt: document.updatedAt
      });
      chunkIndex += 1;
      if (start + size >= document.content.length) {
        break;
      }
    }

    return chunks;
  }
}
