import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { FileMemoryRepository } from '../src/index.js';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'memory-demo-'));

  try {
    const repository = new FileMemoryRepository(join(root, 'memory.jsonl'));
    await repository.append({
      id: 'mem-runtime',
      type: 'success_case',
      summary: 'Runtime center should surface active approvals first',
      content: 'Prioritize pending approvals and recent runs in runtime center summaries.',
      tags: ['runtime', 'approval'],
      createdAt: '2026-04-19T00:00:00.000Z',
      status: 'active'
    });

    const [records, searchResults] = await Promise.all([repository.list(), repository.search('approval', 5)]);

    console.log(
      JSON.stringify(
        {
          totalRecords: records.length,
          matchedIds: searchResults.map(record => record.id)
        },
        null,
        2
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main();
