import type { Embeddings } from '@langchain/core/embeddings';
import type { Chunk, Embedder, Vector } from '@agent/knowledge';

import { AdapterError } from '../../shared/errors/adapter-error';
import { validateVectorDimensions } from '../../shared/validation/vector-dimensions';
import { mergeMetadata } from '../../shared/metadata/merge-metadata';

export class LangChainEmbedderAdapter implements Embedder {
  constructor(private readonly embeddings: Embeddings) {}

  async embed(chunks: Chunk[]): Promise<Vector[]> {
    if (chunks.length === 0) return [];

    const texts = chunks.map(c => c.content);
    const rawVectors = await this.embeddings.embedDocuments(texts);

    if (rawVectors.length !== chunks.length) {
      throw new AdapterError(
        'LangChainEmbedderAdapter',
        `Embedder returned ${rawVectors.length} vectors for ${chunks.length} chunks`
      );
    }

    const vectors: Vector[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      values: rawVectors[i] ?? [],
      metadata: mergeMetadata(chunk.metadata, { sourceChunkId: chunk.id }),
      sourceChunkId: chunk.id
    }));

    validateVectorDimensions(vectors, 'LangChainEmbedderAdapter');

    return vectors;
  }
}
