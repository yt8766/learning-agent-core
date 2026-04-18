import type { KnowledgeSource } from '@agent/core';

import type { KnowledgeSourceRepository } from '../contracts/knowledge-facade';

export class InMemoryKnowledgeSourceRepository implements KnowledgeSourceRepository {
  private readonly records = new Map<string, KnowledgeSource>();

  constructor(seed: KnowledgeSource[] = []) {
    for (const source of seed) {
      this.records.set(source.id, source);
    }
  }

  async list(): Promise<KnowledgeSource[]> {
    return [...this.records.values()];
  }

  async getById(id: string): Promise<KnowledgeSource | null> {
    return this.records.get(id) ?? null;
  }

  async upsert(source: KnowledgeSource): Promise<void> {
    this.records.set(source.id, source);
  }
}
