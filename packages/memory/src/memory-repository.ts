import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { MemoryRecord } from '@agent/shared';

export interface MemoryRepository {
  append(record: MemoryRecord): Promise<void>;
  list(): Promise<MemoryRecord[]>;
  search(query: string, limit: number): Promise<MemoryRecord[]>;
  getById(id: string): Promise<MemoryRecord | undefined>;
  invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
  supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
  retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
  restore(id: string): Promise<MemoryRecord | undefined>;
}

export class FileMemoryRepository implements MemoryRepository {
  private readonly filePath = resolve(loadSettings().memoryFilePath);

  async append(record: MemoryRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const current = await this.readAll();
    current.push(record);
    await writeFile(this.filePath, current.map(item => JSON.stringify(item)).join('\n'));
  }

  async list(): Promise<MemoryRecord[]> {
    return this.readAll();
  }

  async search(query: string, limit: number): Promise<MemoryRecord[]> {
    const lowerQuery = query.toLowerCase();
    const records = await this.readAll();

    return records
      .filter(record => {
        if (record.status === 'invalidated') {
          return false;
        }
        if (record.status === 'superseded' || record.status === 'retired') {
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
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
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
