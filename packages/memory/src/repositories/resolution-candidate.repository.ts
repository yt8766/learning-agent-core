import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { ResolutionCandidateRecord } from '../index';

export interface ResolutionCandidateRepository {
  append(record: ResolutionCandidateRecord): Promise<void>;
  list(): Promise<ResolutionCandidateRecord[]>;
  resolve(
    id: string,
    resolution: 'accepted' | 'rejected',
    resolvedAt: string
  ): Promise<ResolutionCandidateRecord | undefined>;
}

export class FileResolutionCandidateRepository implements ResolutionCandidateRepository {
  constructor(private readonly filePath: string) {
    this.filePath = resolve(filePath);
  }

  async append(record: ResolutionCandidateRecord): Promise<void> {
    const current = await this.list();
    current.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(current, null, 2), 'utf8');
  }

  async list(): Promise<ResolutionCandidateRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ResolutionCandidateRecord[]) : [];
    } catch {
      return [];
    }
  }

  async resolve(
    id: string,
    resolution: 'accepted' | 'rejected',
    resolvedAt: string
  ): Promise<ResolutionCandidateRecord | undefined> {
    const current = await this.list();
    const target = current.find(item => item.id === id);
    if (!target) {
      return undefined;
    }
    target.resolution = resolution;
    target.resolvedAt = resolvedAt;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(current, null, 2), 'utf8');
    return target;
  }
}
