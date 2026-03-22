import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { RuleRecord } from '@agent/shared';

export interface RuleRepository {
  append(record: RuleRecord): Promise<void>;
  list(): Promise<RuleRecord[]>;
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
}
