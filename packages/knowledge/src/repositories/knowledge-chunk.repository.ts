import type { KnowledgeChunk } from '@agent/knowledge';

import type { KnowledgeChunkRepository } from '../contracts/knowledge-facade';

export class InMemoryKnowledgeChunkRepository implements KnowledgeChunkRepository {
  private readonly records = new Map<string, KnowledgeChunk>();

  constructor(seed: KnowledgeChunk[] = []) {
    for (const chunk of seed) {
      this.records.set(chunk.id, chunk);
    }
  }

  async list(): Promise<KnowledgeChunk[]> {
    return [...this.records.values()];
  }

  async getByIds(ids: string[]): Promise<KnowledgeChunk[]> {
    return ids.flatMap(id => {
      const chunk = this.records.get(id);
      return chunk ? [chunk] : [];
    });
  }

  async listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    return [...this.records.values()].filter(chunk => chunk.sourceId === sourceId);
  }

  async upsert(chunk: KnowledgeChunk): Promise<void> {
    this.records.set(chunk.id, chunk);
  }
}
