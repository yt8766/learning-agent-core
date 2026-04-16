import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { ReflectionRecord } from '@agent/shared';

export interface ReflectionRepository {
  append(record: ReflectionRecord): Promise<void>;
  list(): Promise<ReflectionRecord[]>;
  search(query: string, limit: number): Promise<ReflectionRecord[]>;
}

export class FileReflectionRepository implements ReflectionRepository {
  constructor(private readonly filePath: string) {
    this.filePath = resolve(filePath);
  }

  async append(record: ReflectionRecord): Promise<void> {
    const current = await this.list();
    current.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(current, null, 2), 'utf8');
  }

  async list(): Promise<ReflectionRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ReflectionRecord[]) : [];
    } catch {
      return [];
    }
  }

  async search(query: string, limit: number): Promise<ReflectionRecord[]> {
    const normalized = query.toLowerCase();
    return (await this.list())
      .filter(item =>
        `${item.summary} ${item.whatWorked.join(' ')} ${item.whatFailed.join(' ')} ${item.nextAttemptAdvice.join(' ')}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, limit);
  }
}
