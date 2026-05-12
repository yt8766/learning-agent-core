import { describe, expect, it, vi } from 'vitest';

import {
  SnapshotKnowledgeSourceRepository,
  SnapshotKnowledgeChunkRepository
} from '../../src/runtime/core/runtime-knowledge-search-repositories';

// Mock the @agent/knowledge module
vi.mock('@agent/knowledge', () => ({
  listKnowledgeArtifacts: vi.fn()
}));

import { listKnowledgeArtifacts } from '@agent/knowledge';

const mockListKnowledgeArtifacts = vi.mocked(listKnowledgeArtifacts);

describe('SnapshotKnowledgeSourceRepository', () => {
  it('list returns sources from knowledge artifacts', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [{ id: 'src-1', name: 'Source 1' }],
      chunks: []
    } as never);

    const repo = new SnapshotKnowledgeSourceRepository({} as never);
    const sources = await repo.list();

    expect(sources).toEqual([{ id: 'src-1', name: 'Source 1' }]);
  });

  it('getById returns the matching source', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [
        { id: 'src-1', name: 'Source 1' },
        { id: 'src-2', name: 'Source 2' }
      ],
      chunks: []
    } as never);

    const repo = new SnapshotKnowledgeSourceRepository({} as never);
    const source = await repo.getById('src-2');

    expect(source).toEqual({ id: 'src-2', name: 'Source 2' });
  });

  it('getById returns null when source not found', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [{ id: 'src-1', name: 'Source 1' }],
      chunks: []
    } as never);

    const repo = new SnapshotKnowledgeSourceRepository({} as never);
    const source = await repo.getById('missing');

    expect(source).toBeNull();
  });

  it('upsert throws read-only error', async () => {
    const repo = new SnapshotKnowledgeSourceRepository({} as never);

    await expect(repo.upsert()).rejects.toThrow('SnapshotKnowledgeSourceRepository is read-only');
  });
});

describe('SnapshotKnowledgeChunkRepository', () => {
  it('list returns chunks from knowledge artifacts', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [],
      chunks: [{ id: 'chk-1', sourceId: 'src-1', content: 'hello' }]
    } as never);

    const repo = new SnapshotKnowledgeChunkRepository({} as never);
    const chunks = await repo.list();

    expect(chunks).toEqual([{ id: 'chk-1', sourceId: 'src-1', content: 'hello' }]);
  });

  it('getByIds returns matching chunks', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [],
      chunks: [
        { id: 'chk-1', sourceId: 'src-1', content: 'hello' },
        { id: 'chk-2', sourceId: 'src-1', content: 'world' },
        { id: 'chk-3', sourceId: 'src-2', content: 'other' }
      ]
    } as never);

    const repo = new SnapshotKnowledgeChunkRepository({} as never);
    const chunks = await repo.getByIds(['chk-1', 'chk-3']);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).toBe('chk-1');
    expect(chunks[1].id).toBe('chk-3');
  });

  it('getByIds skips missing ids', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [],
      chunks: [{ id: 'chk-1', sourceId: 'src-1', content: 'hello' }]
    } as never);

    const repo = new SnapshotKnowledgeChunkRepository({} as never);
    const chunks = await repo.getByIds(['chk-1', 'missing']);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('chk-1');
  });

  it('listBySourceId filters chunks by sourceId', async () => {
    mockListKnowledgeArtifacts.mockResolvedValue({
      sources: [],
      chunks: [
        { id: 'chk-1', sourceId: 'src-1', content: 'hello' },
        { id: 'chk-2', sourceId: 'src-2', content: 'world' },
        { id: 'chk-3', sourceId: 'src-1', content: 'other' }
      ]
    } as never);

    const repo = new SnapshotKnowledgeChunkRepository({} as never);
    const chunks = await repo.listBySourceId('src-1');

    expect(chunks).toHaveLength(2);
    expect(chunks.every(c => c.sourceId === 'src-1')).toBe(true);
  });

  it('upsert throws read-only error', async () => {
    const repo = new SnapshotKnowledgeChunkRepository({} as never);

    await expect(repo.upsert()).rejects.toThrow('SnapshotKnowledgeChunkRepository is read-only');
  });
});
