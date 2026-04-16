import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';

export interface SemanticCacheRecord {
  id: string;
  key: string;
  role: string;
  modelId: string;
  responseText: string;
  promptFingerprint: string;
  createdAt: string;
  updatedAt: string;
  hitCount: number;
}

export interface SemanticCacheRepository {
  get(key: string): Promise<SemanticCacheRecord | undefined>;
  set(record: SemanticCacheRecord): Promise<void>;
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
    const records = await this.readAll();
    const existingIndex = records.findIndex(item => item.key === record.key);
    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...record,
        updatedAt: new Date().toISOString()
      };
    } else {
      records.push(record);
    }
    await this.writeAll(records);
  }

  private async readAll(): Promise<SemanticCacheRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as SemanticCacheRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeAll(records: SemanticCacheRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), 'utf8');
  }
}
