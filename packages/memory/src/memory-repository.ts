import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { MemoryRecord } from '@agent/shared';
import type { VectorIndexRepository } from './vector-index-repository';

export interface MemoryRepository {
  append(record: MemoryRecord): Promise<void>;
  list(): Promise<MemoryRecord[]>;
  search(query: string, limit: number): Promise<MemoryRecord[]>;
  getById(id: string): Promise<MemoryRecord | undefined>;
  quarantine(
    id: string,
    reason: string,
    evidenceRefs?: string[],
    category?: MemoryRecord['quarantineCategory'],
    detail?: string,
    restoreSuggestion?: string
  ): Promise<MemoryRecord | undefined>;
  invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
  supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
  retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
  restore(id: string): Promise<MemoryRecord | undefined>;
}

export class FileMemoryRepository implements MemoryRepository {
  private readonly filePath: string;
  private vectorIndexRepository?: VectorIndexRepository;

  constructor(filePath = loadSettings().memoryFilePath) {
    this.filePath = resolve(filePath);
  }

  setVectorIndexRepository(repository: VectorIndexRepository) {
    this.vectorIndexRepository = repository;
  }

  async append(record: MemoryRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const existing = await readFile(this.filePath, 'utf8').catch(() => '');
    const prefix = existing.trim().length > 0 ? '\n' : '';
    await appendFile(this.filePath, `${prefix}${JSON.stringify(record)}`, 'utf8');
    await this.vectorIndexRepository?.upsertMemory(record);
  }

  async list(): Promise<MemoryRecord[]> {
    return this.readAll();
  }

  async search(query: string, limit: number): Promise<MemoryRecord[]> {
    const lowerQuery = query.toLowerCase();
    const records = await this.readAll();

    return records
      .filter(record => {
        if (record.quarantined) {
          return false;
        }
        if (record.status === 'invalidated') {
          return false;
        }
        if (record.status === 'superseded' || record.status === 'retired') {
          return false;
        }
        if (record.tags.includes('chat-session')) {
          return false;
        }
        if (record.type === 'task_summary' && !isTaskSummaryQuery(lowerQuery)) {
          return false;
        }
        const haystack = `${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
        return haystack.includes(lowerQuery);
      })
      .slice(0, limit);
  }

  async getById(id: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    return records.find(record => record.id === id);
  }

  async quarantine(
    id: string,
    reason: string,
    evidenceRefs: string[] = [],
    category?: MemoryRecord['quarantineCategory'],
    detail?: string,
    restoreSuggestion?: string
  ): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.quarantined = true;
    target.quarantineReason = reason;
    target.quarantineCategory = category;
    target.quarantineReasonDetail = detail;
    target.quarantineRestoreSuggestion = restoreSuggestion;
    target.quarantineEvidenceRefs = evidenceRefs;
    target.quarantinedAt = new Date().toISOString();
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async invalidate(id: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'invalidated';
    target.invalidatedAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'superseded';
    target.supersededById = replacementId;
    target.supersededAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async retire(id: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'retired';
    target.retiredAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async restore(id: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'active';
    target.restoredAt = new Date().toISOString();
    target.invalidatedAt = undefined;
    target.invalidationReason = undefined;
    target.supersededAt = undefined;
    target.supersededById = undefined;
    target.retiredAt = undefined;
    target.quarantined = false;
    target.quarantineReason = undefined;
    target.quarantineCategory = undefined;
    target.quarantineReasonDetail = undefined;
    target.quarantineRestoreSuggestion = undefined;
    target.quarantineEvidenceRefs = undefined;
    target.quarantinedAt = undefined;
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.vectorIndexRepository?.upsertMemory(target);
    return target;
  }

  private async readAll(): Promise<MemoryRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .flatMap(line => {
          try {
            return [JSON.parse(line) as MemoryRecord];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }
}

function isTaskSummaryQuery(query: string): boolean {
  return ['复盘', '总结', 'summary', 'retrospective', 'postmortem', '经验'].some(token => query.includes(token));
}
