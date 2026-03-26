import { MemoryRecord, RuleRecord } from '@agent/shared';

import { MemoryRepository } from './memory-repository';
import { RuleRepository } from './rule-repository';
import { NullVectorIndexRepository, VectorIndexRepository } from './vector-index-repository';

export interface MemorySearchResult {
  memories: MemoryRecord[];
  rules: RuleRecord[];
}

export interface MemorySearchService {
  search(query: string, limit?: number): Promise<MemorySearchResult>;
}

export class DefaultMemorySearchService implements MemorySearchService {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly vectorIndexRepository: VectorIndexRepository = new NullVectorIndexRepository()
  ) {}

  async search(query: string, limit = 5): Promise<MemorySearchResult> {
    const hits = await this.vectorIndexRepository.search(query, limit);
    const memoryIds = hits.filter(hit => hit.namespace === 'memory').map(hit => hit.id);
    const ruleIds = hits.filter(hit => hit.namespace === 'rule').map(hit => hit.id);

    const [textMemories, textRules, vectorMemories, vectorRules] = await Promise.all([
      this.memoryRepository.search(query, limit),
      this.ruleRepository.search(query, limit),
      Promise.all(memoryIds.map(id => this.memoryRepository.getById(id))),
      Promise.all(ruleIds.map(id => this.ruleRepository.getById(id)))
    ]);

    return {
      memories: this.dedupeById([...vectorMemories, ...textMemories].filter(Boolean) as MemoryRecord[], limit),
      rules: this.dedupeById([...vectorRules, ...textRules].filter(Boolean) as RuleRecord[], limit)
    };
  }

  private dedupeById<T extends { id: string }>(items: T[], limit: number): T[] {
    const seen = new Set<string>();
    const results: T[] = [];
    for (const item of items) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      results.push(item);
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  }
}
