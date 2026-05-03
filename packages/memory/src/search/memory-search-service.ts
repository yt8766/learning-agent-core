import { MemoryRecord, MemorySearchRequest, MemorySearchResult, ReflectionRecord, RuleRecord } from '../index';

import { MemoryRepository } from '../repositories/memory-repository';
import { RuleRepository } from '../repositories/rule-repository';
import { NullVectorIndexRepository, VectorIndexRepository } from '../vector/vector-index-repository';

export interface LegacyMemorySearchResult {
  memories: MemoryRecord[];
  rules: RuleRecord[];
}

export interface MemorySearchService {
  search(query: string, limit?: number): Promise<LegacyMemorySearchResult>;
  search(request: MemorySearchRequest): Promise<MemorySearchResult>;
}

export class DefaultMemorySearchService implements MemorySearchService {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly vectorIndexRepository: VectorIndexRepository = new NullVectorIndexRepository()
  ) {}

  async search(query: string, limit?: number): Promise<LegacyMemorySearchResult>;
  async search(request: MemorySearchRequest): Promise<MemorySearchResult>;
  async search(
    queryOrRequest: string | MemorySearchRequest,
    limit = 5
  ): Promise<LegacyMemorySearchResult | MemorySearchResult> {
    if (typeof queryOrRequest !== 'string') {
      return this.searchStructured(queryOrRequest);
    }

    const query = queryOrRequest;
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

  private async searchStructured(request: MemorySearchRequest): Promise<MemorySearchResult> {
    if (this.memoryRepository.searchStructured) {
      const structured = await this.memoryRepository.searchStructured(request);
      const ruleHits =
        request.includeRules === false ? [] : await this.ruleRepository.search(request.query, request.limit ?? 5);
      return {
        ...structured,
        rules: ruleHits
      };
    }

    const legacy = await this.search(request.query, request.limit ?? 5);
    return {
      coreMemories: legacy.memories.slice(0, 3),
      archivalMemories: legacy.memories.slice(3),
      rules: legacy.rules,
      reflections: [] as ReflectionRecord[],
      reasons: legacy.memories.map(item => ({
        id: item.id,
        kind: 'memory' as const,
        summary: item.summary,
        score: 0.5,
        reason: 'legacy fallback search result'
      }))
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
