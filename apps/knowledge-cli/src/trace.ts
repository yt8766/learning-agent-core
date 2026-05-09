import { dirname } from 'node:path';

import fs from 'fs-extra';

import type { KnowledgeCliTraceEvent } from './types';

export class KnowledgeCliTraceWriter {
  private readonly events: KnowledgeCliTraceEvent[] = [];

  record(event: Omit<KnowledgeCliTraceEvent, 'timestamp'>): void {
    this.events.push({ ...event, timestamp: new Date().toISOString() });
  }

  async flush(path: string | undefined): Promise<void> {
    if (!path) {
      return;
    }
    await fs.ensureDir(dirname(path));
    const content = this.events.map(event => JSON.stringify(event)).join('\n');
    await fs.writeFile(path, content ? `${content}\n` : '');
  }
}
