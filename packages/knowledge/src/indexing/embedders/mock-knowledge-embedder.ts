import type { KnowledgeEmbedder } from './knowledge-embedder';
import type {
  KnowledgeEmbeddingRecord,
  KnowledgeIndexingContext,
  KnowledgeChunkEnvelope
} from '../types/indexing.types';

export class MockKnowledgeEmbedder implements KnowledgeEmbedder {
  constructor(
    private readonly dimensions = 4,
    private readonly modelId = 'mock-knowledge-embedder'
  ) {}

  async embed(params: {
    chunks: KnowledgeChunkEnvelope[];
    context: KnowledgeIndexingContext;
  }): Promise<KnowledgeEmbeddingRecord[]> {
    return params.chunks.map(item => ({
      chunkId: item.chunk.id,
      modelId: this.modelId,
      vector: buildDeterministicVector(item.chunk.content, this.dimensions),
      metadata: item.metadata
    }));
  }
}

function buildDeterministicVector(content: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (let index = 0; index < content.length; index += 1) {
    const slot = index % dimensions;
    vector[slot] = (vector[slot] ?? 0) + (content.charCodeAt(index) % 31);
  }
  return vector;
}
