import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { MemoryRecord } from '@agent/shared';

export interface MemoryRepository {
  append(record: MemoryRecord): Promise<void>;
  search(query: string, limit: number): Promise<MemoryRecord[]>;
  getById(id: string): Promise<MemoryRecord | undefined>;
}

export class FileMemoryRepository implements MemoryRepository {
  private readonly filePath = resolve(loadSettings().memoryFilePath);

  async append(record: MemoryRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const current = await this.readAll();
    current.push(record);
    await writeFile(this.filePath, current.map(item => JSON.stringify(item)).join('\n'));
  }

  async search(query: string, limit: number): Promise<MemoryRecord[]> {
    const lowerQuery = query.toLowerCase();
    const records = await this.readAll();

    return records
      .filter(record => {
        const haystack = `${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
        return haystack.includes(lowerQuery);
      })
      .slice(0, limit);
  }

  async getById(id: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    return records.find(record => record.id === id);
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
