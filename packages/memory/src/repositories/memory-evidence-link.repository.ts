import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { MemoryEvidenceLinkRecord } from '../index';

export interface MemoryEvidenceLinkRepository {
  replaceForMemory(memoryId: string, links: MemoryEvidenceLinkRecord[]): Promise<void>;
  listByMemoryId(memoryId: string): Promise<MemoryEvidenceLinkRecord[]>;
}

export class FileMemoryEvidenceLinkRepository implements MemoryEvidenceLinkRepository {
  constructor(private readonly filePath: string) {
    this.filePath = resolve(filePath);
  }

  async replaceForMemory(memoryId: string, links: MemoryEvidenceLinkRecord[]): Promise<void> {
    const current = await this.readAll();
    const next = [...current.filter(item => item.memoryId !== memoryId), ...links];
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf8');
  }

  async listByMemoryId(memoryId: string): Promise<MemoryEvidenceLinkRecord[]> {
    return (await this.readAll()).filter(item => item.memoryId === memoryId);
  }

  private async readAll(): Promise<MemoryEvidenceLinkRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MemoryEvidenceLinkRecord[]) : [];
    } catch {
      return [];
    }
  }
}
