import type { Chunk, Chunker, Document } from '@agent/core';

export class FixedWindowChunker implements Chunker {
  constructor(
    private readonly chunkSize: number = 800,
    private readonly chunkOverlap: number = 120
  ) {}

  async chunk(document: Document): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    const size = Math.max(1, this.chunkSize);
    const overlap = Math.max(0, Math.min(this.chunkOverlap, size - 1));
    const step = Math.max(1, size - overlap);

    let chunkIndex = 0;
    for (let start = 0; start < document.content.length; start += step) {
      const content = document.content.slice(start, start + size).trim();
      if (content) {
        chunks.push({
          id: `${document.id}#chunk-${chunkIndex}`,
          content,
          sourceDocumentId: document.id,
          chunkIndex,
          metadata: document.metadata
        });
        chunkIndex += 1;
      }
      if (start + size >= document.content.length) break;
    }

    return chunks;
  }
}
