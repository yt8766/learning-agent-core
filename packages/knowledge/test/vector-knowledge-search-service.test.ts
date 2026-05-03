import { describe, expect, it } from 'vitest';

import type { KnowledgeChunk, KnowledgeSource } from '@agent/knowledge';
import type { VectorSearchProvider } from '../src/retrieval/vector-search-provider';

import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';
import { VectorKnowledgeSearchService } from '../src/retrieval/vector-knowledge-search-service';

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id: 'source-1',
    sourceType: 'repo-docs',
    uri: '/test.md',
    title: 'Test Source',
    trustClass: 'internal',
    updatedAt: '2026-04-28T00:00:00.000Z',
    ...overrides
  };
}

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    id: 'chunk-1',
    sourceId: 'source-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'retrieval augmented generation pipeline',
    searchable: true,
    updatedAt: '2026-04-28T00:00:00.000Z',
    ...overrides
  };
}

describe('VectorKnowledgeSearchService', () => {
  it('maps provider hits to RetrievalHit with full metadata', async () => {
    const source = makeSource();
    const chunk = makeChunk();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval pipeline', limit: 5 });

    expect(result.hits).toHaveLength(1);
    const hit = result.hits[0]!;
    expect(hit.chunkId).toBe('chunk-1');
    expect(hit.sourceId).toBe('source-1');
    expect(hit.title).toBe('Test Source');
    expect(hit.uri).toBe('/test.md');
    expect(hit.content).toBe(chunk.content);
    expect(hit.score).toBeGreaterThan(0);
    expect(hit.citation.sourceId).toBe('source-1');
    expect(hit.citation.chunkId).toBe('chunk-1');
  });

  it('skips hits where chunk is not found in repository', async () => {
    const source = makeSource();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    // chunkRepo 里没有对应的 chunk
    const chunkRepo = new InMemoryKnowledgeChunkRepository([]);
    const provider: VectorSearchProvider = {
      searchSimilar: async () => [{ chunkId: 'missing-chunk', score: 0.9 }]
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'anything', limit: 5 });
    expect(result.hits).toHaveLength(0);
  });

  it('skips hits where source is not found for chunk', async () => {
    const chunk = makeChunk({ sourceId: 'orphan-source' });
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    // sourceRepo 没有 orphan-source
    const sourceRepo = new InMemoryKnowledgeSourceRepository([]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval', limit: 5 });
    expect(result.hits).toHaveLength(0);
  });

  it('propagates provider failures so hybrid orchestration can record fallback diagnostics', async () => {
    const source = makeSource();
    const chunk = makeChunk();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider: VectorSearchProvider = {
      searchSimilar: async () => {
        throw new Error('vector backend unavailable');
      }
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    await expect(service.search({ query: 'retrieval', limit: 5 })).rejects.toThrow('vector backend unavailable');
  });

  it('filters by allowedSourceTypes', async () => {
    const repoSource = makeSource({ id: 'src-repo', sourceType: 'repo-docs' });
    const uploadSource = makeSource({ id: 'src-upload', sourceType: 'user-upload', uri: '/upload.md' });
    const repoChunk = makeChunk({ id: 'c1', sourceId: 'src-repo', content: 'retrieval knowledge base search' });
    const uploadChunk = makeChunk({ id: 'c2', sourceId: 'src-upload', content: 'retrieval knowledge user file' });

    const sourceRepo = new InMemoryKnowledgeSourceRepository([repoSource, uploadSource]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([repoChunk, uploadChunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register('c1', repoChunk.content);
    provider.register('c2', uploadChunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({
      query: 'retrieval knowledge',
      limit: 5,
      allowedSourceTypes: ['repo-docs']
    });

    expect(result.hits.every(h => h.sourceType === 'repo-docs')).toBe(true);
  });

  it('passes resolved filters to provider as vector search options', async () => {
    const source = makeSource({ trustClass: 'official' });
    const chunk = makeChunk({
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['engineering']
      }
    });
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider = {
      calls: [] as Array<{ query: string; topK: number; options?: unknown }>,
      async searchSimilar(query: string, topK: number, options?: unknown) {
        this.calls.push({ query, topK, options });
        return [{ chunkId: chunk.id, score: 0.9 }];
      }
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    await service.search({
      query: 'retrieval',
      limit: 5,
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['source-1'],
        documentIds: ['doc-1'],
        minTrustClass: 'curated',
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['engineering']
      }
    });

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      query: 'retrieval',
      topK: 15,
      options: {
        filters: {
          sourceTypes: ['repo-docs'],
          sourceIds: ['source-1'],
          documentIds: ['doc-1'],
          minTrustClass: 'curated',
          searchableOnly: true,
          docTypes: ['policy'],
          statuses: ['active'],
          allowedRoles: ['engineering']
        }
      }
    });
  });

  it('defensively filters provider hits by source and chunk metadata', async () => {
    const allowedSource = makeSource({ id: 'src-allowed', sourceType: 'repo-docs' });
    const blockedSource = makeSource({ id: 'src-blocked', sourceType: 'user-upload' });
    const chunks = [
      makeChunk({
        id: 'allowed',
        sourceId: 'src-allowed',
        documentId: 'doc-allowed',
        metadata: { status: 'active' }
      }),
      makeChunk({
        id: 'blocked-by-status',
        sourceId: 'src-allowed',
        documentId: 'doc-blocked-status',
        metadata: { status: 'draft' }
      }),
      makeChunk({
        id: 'blocked-by-source',
        sourceId: 'src-blocked',
        documentId: 'doc-blocked-source',
        metadata: { status: 'active' }
      })
    ];
    const sourceRepo = new InMemoryKnowledgeSourceRepository([allowedSource, blockedSource]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository(chunks);
    const provider: VectorSearchProvider = {
      searchSimilar: async () => [
        { chunkId: 'allowed', score: 0.9 },
        { chunkId: 'blocked-by-status', score: 0.8 },
        { chunkId: 'blocked-by-source', score: 0.7 }
      ]
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({
      query: 'retrieval',
      limit: 5,
      filters: {
        sourceTypes: ['repo-docs'],
        statuses: ['active']
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
    expect(result.hits[0]?.metadata).toEqual({ status: 'active' });
  });

  it('filters direct vector search by metadata knowledgeBaseId and projects it to hits', async () => {
    const source = makeSource();
    const chunks = [
      makeChunk({
        id: 'chunk-rag',
        documentId: 'doc-rag',
        metadata: { knowledgeBaseId: 'kb_rag' }
      }),
      makeChunk({
        id: 'chunk-other',
        documentId: 'doc-other',
        metadata: { knowledgeBaseId: 'kb_other' }
      })
    ];
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository(chunks);
    const provider: VectorSearchProvider = {
      searchSimilar: async () => [
        { chunkId: 'chunk-rag', score: 0.9 },
        { chunkId: 'chunk-other', score: 0.8 }
      ]
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({
      query: 'retrieval',
      limit: 5,
      filters: {
        knowledgeBaseIds: ['kb_rag']
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk-rag']);
    expect(result.hits[0]?.knowledgeBaseId).toBe('kb_rag');
  });

  it('expands provider topK and slices filtered hits back to request limit', async () => {
    const source = makeSource();
    const chunks = [
      makeChunk({ id: 'first', content: 'first retrieval result' }),
      makeChunk({ id: 'second', content: 'second retrieval result' })
    ];
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository(chunks);
    const provider = {
      calls: [] as Array<{ query: string; topK: number; options?: unknown }>,
      async searchSimilar(query: string, topK: number, options?: unknown) {
        this.calls.push({ query, topK, options });
        return [
          { chunkId: 'first', score: 0.9 },
          { chunkId: 'second', score: 0.8 }
        ];
      }
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval', limit: 1 });

    expect(provider.calls[0]?.topK).toBe(3);
    expect(result.hits.map(hit => hit.chunkId)).toEqual(['first']);
    expect(result.total).toBe(1);
  });

  it('keeps legacy allowedSourceTypes working through resolved filters', async () => {
    const repoSource = makeSource({ id: 'src-repo', sourceType: 'repo-docs' });
    const uploadSource = makeSource({ id: 'src-upload', sourceType: 'user-upload' });
    const repoChunk = makeChunk({ id: 'allowed', sourceId: 'src-repo' });
    const uploadChunk = makeChunk({ id: 'blocked', sourceId: 'src-upload' });
    const sourceRepo = new InMemoryKnowledgeSourceRepository([repoSource, uploadSource]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([repoChunk, uploadChunk]);
    const provider: VectorSearchProvider = {
      searchSimilar: async () => [
        { chunkId: 'allowed', score: 0.9 },
        { chunkId: 'blocked', score: 0.8 }
      ]
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({
      query: 'retrieval',
      limit: 5,
      allowedSourceTypes: ['repo-docs']
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
  });

  it('returns hits sorted by provider score descending', async () => {
    const source = makeSource();
    const chunks = [
      makeChunk({ id: 'c1', content: 'retrieval augmented generation knowledge pipeline' }),
      makeChunk({ id: 'c2', content: 'retrieval search result ranking system' }),
      makeChunk({ id: 'c3', content: 'retrieval query preprocessing steps' })
    ];
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository(chunks);
    const provider = new InMemoryVectorSearchProvider();
    for (const c of chunks) {
      provider.register(c.id, c.content);
    }

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval knowledge generation', limit: 5 });

    for (let i = 1; i < result.hits.length; i++) {
      expect(result.hits[i - 1]!.score).toBeGreaterThanOrEqual(result.hits[i]!.score);
    }
  });

  it('total reflects actual number of hits returned', async () => {
    const source = makeSource();
    const chunk = makeChunk();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval', limit: 5 });
    expect(result.total).toBe(result.hits.length);
  });
});
