import type { Vector } from '../schemas/index';

export interface VectorStore {
  upsert(vectors: Vector[]): Promise<void>;
}
