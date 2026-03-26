import { MemoryRecord, RuleRecord } from '@agent/shared';

import { MemoryRepository } from './memory-repository';
import { RuleRepository } from './rule-repository';

export interface VectorSearchHit {
  id: string;
  score: number;
  namespace: 'memory' | 'rule';
}

export interface VectorIndexRepository {
  search(query: string, limit: number, namespace?: VectorSearchHit['namespace']): Promise<VectorSearchHit[]>;
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    )
  );
}

function scoreTokens(queryTokens: string[], documentTokens: string[]): number {
  if (queryTokens.length === 0 || documentTokens.length === 0) {
    return 0;
  }

  const documentSet = new Set(documentTokens);
  let matches = 0;
  for (const token of queryTokens) {
    if (documentSet.has(token)) {
      matches += 1;
    }
  }
  return matches / Math.max(queryTokens.length, documentTokens.length);
}

function isActiveRecord(status?: 'active' | 'invalidated' | 'superseded' | 'retired'): boolean {
  return !status || status === 'active';
}

function memoryText(record: MemoryRecord): string {
  return [record.summary, record.content, ...record.tags].join(' ');
}

function ruleText(record: RuleRecord): string {
  return [record.name, record.summary, ...record.conditions, record.action].join(' ');
}

export class NullVectorIndexRepository implements VectorIndexRepository {
  async search(): Promise<VectorSearchHit[]> {
    return [];
  }
}

export class LocalVectorIndexRepository implements VectorIndexRepository {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly ruleRepository: RuleRepository
  ) {}

  async search(query: string, limit: number, namespace?: VectorSearchHit['namespace']): Promise<VectorSearchHit[]> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const [memories, rules] = await Promise.all([
      namespace === 'rule' ? Promise.resolve([] as MemoryRecord[]) : this.memoryRepository.list(),
      namespace === 'memory' ? Promise.resolve([] as RuleRecord[]) : this.ruleRepository.list()
    ]);

    const hits: VectorSearchHit[] = [];

    for (const memory of memories) {
      if (!isActiveRecord(memory.status)) {
        continue;
      }
      const score = scoreTokens(queryTokens, tokenize(memoryText(memory)));
      if (score > 0) {
        hits.push({
          id: memory.id,
          score,
          namespace: 'memory'
        });
      }
    }

    for (const rule of rules) {
      if (!isActiveRecord(rule.status)) {
        continue;
      }
      const score = scoreTokens(queryTokens, tokenize(ruleText(rule)));
      if (score > 0) {
        hits.push({
          id: rule.id,
          score,
          namespace: 'rule'
        });
      }
    }

    return hits.sort((left, right) => right.score - left.score).slice(0, limit);
  }
}
