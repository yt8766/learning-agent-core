import type { Chunk, Vector } from '../schemas/index';

export interface Embedder {
  embed(chunks: Chunk[]): Promise<Vector[]>;
}
