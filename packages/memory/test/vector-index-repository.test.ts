import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRecord, RuleRecord } from '@agent/core';

import type { EmbeddingProvider } from '@agent/memory';
import { LocalVectorIndexRepository } from '@agent/memory';

describe('LocalVectorIndexRepository', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('indexes knowledge chunks and returns knowledge hits with metadata', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vector-knowledge-'));
    await mkdir(join(tempDir, 'knowledge', 'chunks'), { recursive: true });
    await mkdir(join(tempDir, 'knowledge', 'sources'), { recursive: true });
    await writeFile(
      join(tempDir, 'knowledge', 'chunks', 'records.json'),
      JSON.stringify([
        {
          id: 'chunk-1',
          sourceId: 'source-1',
          documentId: 'doc-1',
          content: 'runtime architecture knowledge flow',
          searchable: true
        }
      ]),
      'utf8'
    );
    await writeFile(
      join(tempDir, 'knowledge', 'sources', 'records.json'),
      JSON.stringify([
        {
          id: 'source-1',
          uri: 'docs/ARCHITECTURE.md',
          title: 'Architecture',
          sourceType: 'repo-docs'
        }
      ]),
      'utf8'
    );

    const embeddingProvider: EmbeddingProvider = {
      embedQuery: async text => embed(text),
      embedDocuments: async texts => texts.map(text => embed(text))
    };
    const repo = new LocalVectorIndexRepository(
      {
        list: async () => [] as MemoryRecord[],
        search: async () => [],
        getById: async () => undefined
      } as any,
      {
        list: async () => [] as RuleRecord[],
        search: async () => [],
        getById: async () => undefined
      } as any,
      embeddingProvider,
      {
        filePath: join(tempDir, 'vector-index.json'),
        knowledgeRoot: join(tempDir, 'knowledge')
      }
    );

    const hits = await repo.search('runtime architecture', 5, 'knowledge');

    expect(hits).toEqual([
      expect.objectContaining({
        id: 'chunk-1',
        namespace: 'knowledge',
        metadata: expect.objectContaining({
          documentId: 'doc-1',
          uri: 'docs/ARCHITECTURE.md',
          title: 'Architecture'
        })
      })
    ]);
  });

  it('rebuilds the vector index from source data when the local index file is deleted', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vector-rebuild-'));
    const filePath = join(tempDir, 'vector-index.json');
    const memoryRecord: MemoryRecord = {
      id: 'mem-1',
      type: 'fact',
      summary: 'build release checklist',
      content: 'run build before release',
      tags: ['build'],
      createdAt: '2026-03-25T00:00:00.000Z',
      status: 'active'
    };
    const embeddingProvider: EmbeddingProvider = {
      embedQuery: async text => embed(text),
      embedDocuments: async texts => texts.map(text => embed(text))
    };
    const repo = new LocalVectorIndexRepository(
      {
        list: async () => [memoryRecord],
        search: async () => [],
        getById: async (id: string) => (id === memoryRecord.id ? memoryRecord : undefined)
      } as any,
      {
        list: async () => [] as RuleRecord[],
        search: async () => [],
        getById: async () => undefined
      } as any,
      embeddingProvider,
      {
        filePath,
        loadKnowledgeDocuments: async () => []
      }
    );

    const firstHits = await repo.search('build release', 3, 'memory');
    await unlink(filePath);
    const rebuiltHits = await repo.search('build release', 3, 'memory');

    expect(firstHits[0]).toEqual(expect.objectContaining({ id: 'mem-1', namespace: 'memory' }));
    expect(rebuiltHits[0]).toEqual(expect.objectContaining({ id: 'mem-1', namespace: 'memory' }));
  });
});

function embed(text: string) {
  const normalized = text.toLowerCase();
  return [
    normalized.includes('runtime') ? 1 : 0,
    normalized.includes('architecture') ? 1 : 0,
    normalized.includes('build') ? 1 : 0,
    normalized.includes('release') ? 1 : 0
  ];
}
