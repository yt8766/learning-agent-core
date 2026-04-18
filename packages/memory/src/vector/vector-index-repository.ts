import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { MemoryRecord, RuleRecord } from '@agent/core';

import type { EmbeddingProvider } from '../embeddings/embedding-provider';
import { loadKnowledgeVectorDocuments, type KnowledgeVectorDocumentRecord } from './knowledge-vector-documents';
import { MemoryRepository } from '../repositories/memory-repository';
import { RuleRepository } from '../repositories/rule-repository';

export interface VectorSearchHit {
  id: string;
  score: number;
  namespace: 'memory' | 'rule' | 'knowledge';
  metadata?: EmbeddingVectorRecord['metadata'];
}

export interface VectorIndexRepository {
  search(query: string, limit: number, namespace?: VectorSearchHit['namespace']): Promise<VectorSearchHit[]>;
  upsertMemory(record: MemoryRecord): Promise<void>;
  upsertRule(record: RuleRecord): Promise<void>;
  upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void>;
  remove(namespace: VectorSearchHit['namespace'], id: string): Promise<void>;
  rebuild(): Promise<void>;
}

export interface EmbeddingVectorRecord {
  id: string;
  namespace: VectorSearchHit['namespace'];
  embedding: number[];
  updatedAt: string;
  sourceHash: string;
  metadata: Record<string, unknown>;
}

interface LocalVectorIndexSnapshot {
  version: 1;
  records: EmbeddingVectorRecord[];
}

function isActiveRecord(
  status?: 'disputed' | 'candidate' | 'active' | 'stale' | 'superseded' | 'archived' | 'invalidated' | 'retired'
): boolean {
  return !status || status === 'active';
}

function memorySemanticText(record: MemoryRecord): string {
  const relatedEntities = (record.relatedEntities ?? []).map(
    entity => `${entity.entityType}:${entity.entityId}:${entity.relation ?? ''}`
  );
  return [record.summary, record.content, record.memoryType ?? record.type, ...record.tags, ...relatedEntities].join(
    ' '
  );
}

export class NullVectorIndexRepository implements VectorIndexRepository {
  async search(): Promise<VectorSearchHit[]> {
    return [];
  }
  async upsertMemory(): Promise<void> {}
  async upsertRule(): Promise<void> {}
  async upsertKnowledge(): Promise<void> {}
  async remove(): Promise<void> {}
  async rebuild(): Promise<void> {}
}

export class LocalVectorIndexRepository implements VectorIndexRepository {
  private readonly filePath: string;

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    options?: {
      filePath?: string;
      knowledgeRoot?: string;
      loadKnowledgeDocuments?: () => Promise<KnowledgeVectorDocumentRecord[]>;
    }
  ) {
    this.filePath = resolve(options?.filePath ?? loadSettings().vectorIndexFilePath);
    this.knowledgeRoot = options?.knowledgeRoot ?? loadSettings().knowledgeRoot;
    this.loadKnowledgeDocuments = options?.loadKnowledgeDocuments;
  }

  private readonly knowledgeRoot: string;
  private readonly loadKnowledgeDocuments?: () => Promise<KnowledgeVectorDocumentRecord[]>;

  async search(query: string, limit: number, namespace?: VectorSearchHit['namespace']): Promise<VectorSearchHit[]> {
    if (!query.trim()) {
      return [];
    }
    await this.rebuild();
    const queryEmbedding = await this.embeddingProvider.embedQuery(query);
    const snapshot = await this.readSnapshot();
    const candidates = snapshot.records.filter(record => !namespace || record.namespace === namespace);

    return candidates
      .map(record => ({
        id: record.id,
        namespace: record.namespace,
        score: cosineSimilarity(queryEmbedding, record.embedding),
        metadata: record.metadata
      }))
      .filter(hit => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async upsertMemory(record: MemoryRecord): Promise<void> {
    if (!isActiveMemory(record)) {
      await this.remove('memory', record.id);
      return;
    }
    const semanticHash = hashText(memorySemanticText(record));
    const snapshot = await this.readSnapshot();
    const existing = snapshot.records.find(item => item.namespace === 'memory' && item.id === record.id);
    if (existing && existing.sourceHash === semanticHash) {
      await this.upsertRecord({
        ...existing,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...existing.metadata,
          status: record.status,
          version: record.version,
          usageMetrics: record.usageMetrics,
          lastUsedAt: record.lastUsedAt,
          lastVerifiedAt: record.lastVerifiedAt
        }
      });
      return;
    }
    const embedding = await this.embeddingProvider.embedQuery(memorySemanticText(record));
    await this.upsertRecord({
      id: record.id,
      namespace: 'memory',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: semanticHash,
      metadata: {
        summary: record.summary,
        content: record.content,
        tags: record.tags,
        memoryType: record.memoryType,
        relatedEntities: record.relatedEntities,
        status: record.status,
        version: record.version,
        usageMetrics: record.usageMetrics
      }
    });
  }

  async upsertRule(record: RuleRecord): Promise<void> {
    if (!isActiveRecord(record.status)) {
      await this.remove('rule', record.id);
      return;
    }
    const semanticHash = hashText(ruleSemanticText(record));
    const snapshot = await this.readSnapshot();
    const existing = snapshot.records.find(item => item.namespace === 'rule' && item.id === record.id);
    if (existing && existing.sourceHash === semanticHash) {
      await this.upsertRecord({
        ...existing,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...existing.metadata,
          status: record.status,
          version: record.version
        }
      });
      return;
    }
    const embedding = await this.embeddingProvider.embedQuery(ruleSemanticText(record));
    await this.upsertRecord({
      id: record.id,
      namespace: 'rule',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: semanticHash,
      metadata: {
        name: record.name,
        summary: record.summary,
        conditions: record.conditions,
        action: record.action,
        status: record.status,
        version: record.version
      }
    });
  }

  async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
    if (!record.searchable) {
      await this.remove('knowledge', record.id);
      return;
    }
    const embedding = await this.embeddingProvider.embedQuery(record.content);
    await this.upsertRecord({
      id: record.id,
      namespace: 'knowledge',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: hashText(record.content),
      metadata: {
        chunkId: record.chunkId,
        documentId: record.documentId,
        sourceId: record.sourceId,
        uri: record.uri,
        title: record.title,
        sourceType: record.sourceType,
        content: record.content
      }
    });
  }

  async remove(namespace: VectorSearchHit['namespace'], id: string): Promise<void> {
    const snapshot = await this.readSnapshot();
    const next = snapshot.records.filter(record => !(record.namespace === namespace && record.id === id));
    if (next.length === snapshot.records.length) {
      return;
    }
    await this.writeSnapshot({ version: 1, records: next });
  }

  async rebuild(): Promise<void> {
    const [memories, rules, knowledgeDocuments] = await Promise.all([
      this.memoryRepository.list(),
      this.ruleRepository.list(),
      this.resolveKnowledgeDocuments()
    ]);

    const memoryRecords = memories.filter(isActiveMemory);
    const ruleRecords = rules.filter(rule => isActiveRecord(rule.status));
    const knowledgeRecords = knowledgeDocuments.filter(document => document.searchable);

    const texts = [
      ...memoryRecords.map(record => memorySemanticText(record)),
      ...ruleRecords.map(record => ruleSemanticText(record)),
      ...knowledgeRecords.map(record => record.content)
    ];
    const embeddings = texts.length ? await this.embeddingProvider.embedDocuments(texts) : [];
    let cursor = 0;

    const records: EmbeddingVectorRecord[] = [
      ...memoryRecords.map(record => this.toMemoryVectorRecord(record, embeddings[cursor++] ?? [])),
      ...ruleRecords.map(record => this.toRuleVectorRecord(record, embeddings[cursor++] ?? [])),
      ...knowledgeRecords.map(record => this.toKnowledgeVectorRecord(record, embeddings[cursor++] ?? []))
    ];

    await this.writeSnapshot({
      version: 1,
      records
    });
  }

  private async upsertRecord(record: EmbeddingVectorRecord): Promise<void> {
    const snapshot = await this.readSnapshot();
    const next = snapshot.records.filter(item => !(item.namespace === record.namespace && item.id === record.id));
    next.push(record);
    await this.writeSnapshot({ version: 1, records: next });
  }

  private async resolveKnowledgeDocuments() {
    if (this.loadKnowledgeDocuments) {
      return this.loadKnowledgeDocuments();
    }
    return loadKnowledgeVectorDocuments(this.knowledgeRoot);
  }

  private toMemoryVectorRecord(record: MemoryRecord, embedding: number[]): EmbeddingVectorRecord {
    return {
      id: record.id,
      namespace: 'memory',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: hashText(memorySemanticText(record)),
      metadata: {
        summary: record.summary,
        content: record.content,
        tags: record.tags,
        memoryType: record.memoryType,
        relatedEntities: record.relatedEntities,
        status: record.status,
        version: record.version,
        usageMetrics: record.usageMetrics
      }
    };
  }

  private toRuleVectorRecord(record: RuleRecord, embedding: number[]): EmbeddingVectorRecord {
    return {
      id: record.id,
      namespace: 'rule',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: hashText(ruleSemanticText(record)),
      metadata: {
        name: record.name,
        summary: record.summary,
        conditions: record.conditions,
        action: record.action,
        status: record.status,
        version: record.version
      }
    };
  }

  private toKnowledgeVectorRecord(record: KnowledgeVectorDocumentRecord, embedding: number[]): EmbeddingVectorRecord {
    return {
      id: record.id,
      namespace: 'knowledge',
      embedding,
      updatedAt: new Date().toISOString(),
      sourceHash: hashText(record.content),
      metadata: {
        chunkId: record.chunkId,
        documentId: record.documentId,
        sourceId: record.sourceId,
        uri: record.uri,
        title: record.title,
        sourceType: record.sourceType,
        content: record.content
      }
    };
  }

  private async readSnapshot(): Promise<LocalVectorIndexSnapshot> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as LocalVectorIndexSnapshot;
      return parsed?.version === 1 && Array.isArray(parsed.records) ? parsed : { version: 1, records: [] };
    } catch {
      return { version: 1, records: [] };
    }
  }

  private async writeSnapshot(snapshot: LocalVectorIndexSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }
}

function hashText(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function isActiveMemory(record: MemoryRecord) {
  return isActiveRecord(record.status) && !record.quarantined;
}

function ruleSemanticText(record: RuleRecord) {
  return [record.name, record.summary, ...record.conditions, record.action].join(' ');
}

export function shouldReindexMemory(previous: MemoryRecord, next: MemoryRecord) {
  return hashText(memorySemanticText(previous)) !== hashText(memorySemanticText(next));
}
