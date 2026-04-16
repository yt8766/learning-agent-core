import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { MemoryEventRecord } from '@agent/shared';

export interface MemoryEventRepository {
  append(event: MemoryEventRecord): Promise<void>;
  list(memoryId?: string): Promise<MemoryEventRecord[]>;
}

export class FileMemoryEventRepository implements MemoryEventRepository {
  constructor(private readonly filePath: string) {
    this.filePath = resolve(filePath);
  }

  async append(event: MemoryEventRecord): Promise<void> {
    const records = await this.list();
    records.push(event);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'), 'utf8');
  }

  async list(memoryId?: string): Promise<MemoryEventRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const items = raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .flatMap(line => {
          try {
            return [JSON.parse(line) as MemoryEventRecord];
          } catch {
            return [];
          }
        });
      return memoryId ? items.filter(item => item.memoryId === memoryId) : items;
    } catch {
      return [];
    }
  }
}
