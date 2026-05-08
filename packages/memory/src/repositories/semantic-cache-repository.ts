import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';

import { SemanticCacheRecordSchema, type SemanticCacheRecord, type SemanticCacheRepository } from '../contracts';

const cloneSemanticCacheRecord = (record: SemanticCacheRecord): SemanticCacheRecord => ({ ...record });

export class InMemorySemanticCacheRepository implements SemanticCacheRepository {
  private readonly records = new Map<string, SemanticCacheRecord>();

  async get(key: string): Promise<SemanticCacheRecord | undefined> {
    const target = this.records.get(key);
    if (!target) {
      return undefined;
    }

    const updated = {
      ...target,
      hitCount: target.hitCount + 1,
      updatedAt: new Date().toISOString()
    };
    this.records.set(key, updated);
    return cloneSemanticCacheRecord(updated);
  }

  async set(record: SemanticCacheRecord): Promise<void> {
    const parsed = SemanticCacheRecordSchema.parse(record);
    const existing = this.records.get(parsed.key);
    this.records.set(parsed.key, {
      ...existing,
      ...parsed,
      updatedAt: existing ? new Date().toISOString() : parsed.updatedAt
    });
  }
}

export class FileSemanticCacheRepository implements SemanticCacheRepository {
  private readonly filePath: string;

  constructor(filePath = loadSettings().semanticCacheFilePath) {
    this.filePath = resolve(filePath);
  }

  async get(key: string): Promise<SemanticCacheRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.key === key);
    if (!target) {
      return undefined;
    }

    target.hitCount += 1;
    target.updatedAt = new Date().toISOString();
    await this.writeAll(records);
    return target;
  }

  async set(record: SemanticCacheRecord): Promise<void> {
    const parsed = SemanticCacheRecordSchema.parse(record);
    const records = await this.readAll();
    const existingIndex = records.findIndex(item => item.key === parsed.key);
    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...parsed,
        updatedAt: new Date().toISOString()
      };
    } else {
      records.push(parsed);
    }
    await this.writeAll(records);
  }

  private async readAll(): Promise<SemanticCacheRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.flatMap(item => {
        const result = SemanticCacheRecordSchema.safeParse(item);
        return result.success ? [result.data] : [];
      });
    } catch {
      return [];
    }
  }

  private async writeAll(records: SemanticCacheRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), 'utf8');
  }
}
