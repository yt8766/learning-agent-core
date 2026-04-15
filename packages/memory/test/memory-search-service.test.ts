import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRecord, RuleRecord } from '@agent/shared';

import type { EmbeddingProvider } from '@agent/memory';
import { DefaultMemorySearchService, LocalVectorIndexRepository, NullVectorIndexRepository } from '@agent/memory';

describe('DefaultMemorySearchService', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('merges text search results from memories and rules', async () => {
    const memoryRecord: MemoryRecord = {
      id: 'mem_1',
      type: 'success_case',
      taskId: 'task_1',
      summary: 'React build fix',
      content: 'Use vite build cache',
      tags: ['frontend'],
      qualityScore: 0.9,
      createdAt: '2026-03-25T00:00:00.000Z',
      status: 'active'
    };
    const ruleRecord: RuleRecord = {
      id: 'rule_1',
      name: 'build_gate',
      summary: 'Always run build before ship',
      conditions: ['before release'],
      action: 'Run build before shipping.',
      createdAt: '2026-03-25T00:00:00.000Z',
      status: 'active'
    };
    const memoryRepository = {
      append: async () => undefined,
      list: async () => [memoryRecord],
      search: async () => [memoryRecord],
      getById: async (id: string) => (id === 'mem_1' ? memoryRecord : undefined),
      quarantine: async () => undefined,
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };
    const ruleRepository = {
      append: async () => undefined,
      list: async () => [ruleRecord],
      search: async () => [ruleRecord],
      getById: async (id: string) => (id === 'rule_1' ? ruleRecord : undefined),
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };
    const service = new DefaultMemorySearchService(memoryRepository, ruleRepository, new NullVectorIndexRepository());

    const result = await service.search('build', 3);

    expect(result.memories).toEqual([expect.objectContaining({ id: 'mem_1' })]);
    expect(result.rules).toEqual([expect.objectContaining({ id: 'rule_1' })]);
  });

  it('local vector index ranks active memory and rule hits by embeddings and rebuilds the local file index', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-vector-index-'));
    const memories: MemoryRecord[] = [
      {
        id: 'mem_best',
        type: 'success_case',
        summary: 'vite build cache release pipeline',
        content: 'release build cache',
        tags: ['build', 'release'],
        createdAt: '2026-03-25T00:00:00.000Z',
        status: 'active'
      },
      {
        id: 'mem_other',
        type: 'success_case',
        summary: 'frontend styling notes',
        content: 'css tokens',
        tags: ['ui'],
        createdAt: '2026-03-25T00:00:00.000Z',
        status: 'active'
      }
    ];
    const rules: RuleRecord[] = [
      {
        id: 'rule_build',
        name: 'build_gate',
        summary: 'release requires build',
        conditions: ['before release'],
        action: 'run build',
        createdAt: '2026-03-25T00:00:00.000Z',
        status: 'active'
      }
    ];
    const memoryRepository = {
      append: async () => undefined,
      list: async () => memories,
      search: async () => [],
      getById: async () => undefined,
      quarantine: async () => undefined,
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };
    const ruleRepository = {
      append: async () => undefined,
      list: async () => rules,
      search: async () => [],
      getById: async () => undefined,
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };

    const embeddingProvider: EmbeddingProvider = {
      embedQuery: async text => toEmbedding(text),
      embedDocuments: async texts => texts.map(text => toEmbedding(text))
    };
    const repo = new LocalVectorIndexRepository(memoryRepository, ruleRepository, embeddingProvider, {
      filePath: join(tempDir, 'vector-index.json'),
      loadKnowledgeDocuments: async () => []
    });
    const hits = await repo.search('build release', 3);
    const snapshot = JSON.parse(await readFile(join(tempDir, 'vector-index.json'), 'utf8')) as { records: unknown[] };

    expect(hits[0]).toEqual(expect.objectContaining({ id: 'mem_best', namespace: 'memory' }));
    expect(hits).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'rule_build', namespace: 'rule' })]));
    expect(snapshot.records).toHaveLength(3);
  });
});

function toEmbedding(text: string) {
  const normalized = text.toLowerCase();
  return [
    normalized.includes('build') ? 1 : 0,
    normalized.includes('release') ? 1 : 0,
    normalized.includes('frontend') ? 1 : 0,
    normalized.includes('styling') ? 1 : 0
  ];
}
