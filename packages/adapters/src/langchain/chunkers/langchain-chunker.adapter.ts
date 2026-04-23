import type { BaseDocumentTransformer } from '@langchain/core/documents';
import type { Chunker, Chunk, Document } from '@agent/core';

import { mapLangChainSplitToCoreChunk } from '../shared/langchain-chunk.mapper';
import { mapCoreDocumentToLangChainDocument } from '../shared/langchain-chunk.mapper';

export class LangChainChunkerAdapter implements Chunker {
  constructor(private readonly splitter: BaseDocumentTransformer) {}

  async chunk(document: Document): Promise<Chunk[]> {
    const lcDoc = mapCoreDocumentToLangChainDocument(document);
    const splits = await this.splitter.transformDocuments([lcDoc]);
    const chunks: Chunk[] = [];
    let chunkIndex = 0;
    for (const split of splits) {
      if (!split.pageContent.trim()) continue;
      chunks.push(mapLangChainSplitToCoreChunk(split, document.id, chunkIndex++));
    }
    return chunks;
  }
}
