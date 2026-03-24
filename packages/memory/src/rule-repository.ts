import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { RuleRecord } from '@agent/shared';

export interface RuleRepository {
  append(record: RuleRecord): Promise<void>;
  list(): Promise<RuleRecord[]>;
  getById(id: string): Promise<RuleRecord | undefined>;
  invalidate(id: string, reason: string): Promise<RuleRecord | undefined>;
  supersede(id: string, replacementId: string, reason: string): Promise<RuleRecord | undefined>;
  retire(id: string, reason: string): Promise<RuleRecord | undefined>;
  restore(id: string): Promise<RuleRecord | undefined>;
}

export class FileRuleRepository implements RuleRepository {
  private readonly filePath = resolve(loadSettings().rulesFilePath);

  async append(record: RuleRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const current = await this.list();
    current.push(record);
    await writeFile(this.filePath, current.map(item => JSON.stringify(item)).join('\n'));
  }

  async list(): Promise<RuleRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .flatMap(line => {
          try {
            return [JSON.parse(line) as RuleRecord];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<RuleRecord | undefined> {
    const items = await this.list();
    return items.find(item => item.id === id);
  }

  async invalidate(id: string, reason: string): Promise<RuleRecord | undefined> {
    const items = await this.list();
    const target = items.find(item => item.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'invalidated';
    target.invalidatedAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, items.map(item => JSON.stringify(item)).join('\n'));
    return target;
  }

  async supersede(id: string, replacementId: string, reason: string): Promise<RuleRecord | undefined> {
    const items = await this.list();
    const target = items.find(item => item.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'superseded';
    target.supersededById = replacementId;
    target.supersededAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, items.map(item => JSON.stringify(item)).join('\n'));
    return target;
  }

  async retire(id: string, reason: string): Promise<RuleRecord | undefined> {
    const items = await this.list();
    const target = items.find(item => item.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'retired';
    target.retiredAt = new Date().toISOString();
    target.invalidationReason = reason;
    await writeFile(this.filePath, items.map(item => JSON.stringify(item)).join('\n'));
    return target;
  }

  async restore(id: string): Promise<RuleRecord | undefined> {
    const items = await this.list();
    const target = items.find(item => item.id === id);
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
    await writeFile(this.filePath, items.map(item => JSON.stringify(item)).join('\n'));
    return target;
  }
}
