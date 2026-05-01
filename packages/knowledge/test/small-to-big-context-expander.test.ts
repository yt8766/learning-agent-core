import type { KnowledgeChunk, KnowledgeSource, RetrievalHit } from '@agent/knowledge';
import { describe, expect, it } from 'vitest';

import type { KnowledgeChunkRepository, KnowledgeSourceRepository } from '../src/contracts/knowledge-facade';
import { resolveKnowledgeRetrievalFilters } from '../src/retrieval/knowledge-retrieval-filters';
import { SmallToBigContextExpander } from '../src/retrieval/small-to-big-context-expander';
import type { ContextExpander } from '../src/runtime/stages/context-expander';
import type { NormalizedRetrievalRequest } from '../src/runtime/types/retrieval-runtime.types';

interface TestChunkRepository extends KnowledgeChunkRepository {
  getByIds(ids: string[]): Promise<KnowledgeChunk[]>;
}

const UPDATED_AT = '2026-04-30T00:00:00.000Z';

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id: 'source-1',
    sourceType: 'repo-docs',
    uri: '/docs/policy.md',
    title: 'Policy',
    trustClass: 'official',
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    id: 'chunk-1',
    sourceId: 'source-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Chunk content',
    searchable: true,
    updatedAt: UPDATED_AT,
    metadata: {
      status: 'active'
    },
    ...overrides
  };
}

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  const chunkId = overrides.chunkId ?? 'seed';
  const sourceId = overrides.sourceId ?? 'source-1';

  return {
    chunkId,
    documentId: 'doc-1',
    sourceId,
    title: 'Policy',
    uri: '/docs/policy.md',
    sourceType: 'repo-docs',
    trustClass: 'official',
    content: 'Seed content',
    score: 0.8,
    metadata: {
      status: 'active'
    },
    citation: {
      sourceId,
      chunkId,
      title: 'Policy',
      uri: '/docs/policy.md',
      sourceType: 'repo-docs',
      trustClass: 'official'
    },
    ...overrides
  };
}

function makeRequest(): NormalizedRetrievalRequest {
  return {
    query: 'policy',
    normalizedQuery: 'policy',
    topK: 5
  };
}

function makeChunkRepository(chunks: KnowledgeChunk[]): TestChunkRepository {
  const byId = new Map(chunks.map(chunk => [chunk.id, chunk]));

  return {
    async list(): Promise<KnowledgeChunk[]> {
      return [...byId.values()];
    },
    async listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
      return [...byId.values()].filter(chunk => chunk.sourceId === sourceId);
    },
    async getByIds(ids: string[]): Promise<KnowledgeChunk[]> {
      return ids.map(id => byId.get(id)).filter((chunk): chunk is KnowledgeChunk => Boolean(chunk));
    },
    async upsert(chunk: KnowledgeChunk): Promise<void> {
      byId.set(chunk.id, chunk);
    }
  };
}

function makeUnorderedChunkRepository(chunks: KnowledgeChunk[]): TestChunkRepository {
  const repository = makeChunkRepository(chunks);

  return {
    ...repository,
    async getByIds(ids: string[]): Promise<KnowledgeChunk[]> {
      const found = await repository.getByIds(ids);
      return [...found].reverse();
    }
  };
}

function makeSourceRepository(sources: KnowledgeSource[]): KnowledgeSourceRepository {
  const byId = new Map(sources.map(source => [source.id, source]));

  return {
    async list(): Promise<KnowledgeSource[]> {
      return sources;
    },
    async getById(id: string): Promise<KnowledgeSource | null> {
      return byId.get(id) ?? null;
    },
    async upsert(): Promise<void> {
      throw new Error('not used');
    }
  };
}

describe('SmallToBigContextExpander', () => {
  it('implements the shared context expander contract', () => {
    const expander: ContextExpander = new SmallToBigContextExpander(makeChunkRepository([]), makeSourceRepository([]));

    expect(expander).toBeInstanceOf(SmallToBigContextExpander);
  });

  it('appends parent, previous, and next chunks from seed metadata', async () => {
    const source = makeSource();
    const seed = makeHit({
      chunkId: 'seed',
      score: 0.73,
      metadata: {
        status: 'active',
        parentId: 'parent',
        prevChunkId: 'previous',
        nextChunkId: 'next'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([
        makeChunk({ id: 'parent', content: 'Parent content', metadata: { status: 'active', section: 'overview' } }),
        makeChunk({ id: 'previous', content: 'Previous content', metadata: { status: 'active' } }),
        makeChunk({ id: 'next', content: 'Next content', metadata: { status: 'active' } })
      ]),
      makeSourceRepository([source])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' })
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'parent', 'previous', 'next']);
    expect(result.hits[1]).toMatchObject({
      chunkId: 'parent',
      content: 'Parent content',
      score: 0.73,
      metadata: {
        status: 'active',
        section: 'overview'
      },
      citation: {
        sourceId: source.id,
        chunkId: 'parent',
        title: source.title,
        uri: source.uri
      }
    });
    expect(result.diagnostics).toMatchObject({
      enabled: true,
      seedCount: 1,
      candidateCount: 3,
      addedCount: 3,
      dedupedCount: 0,
      droppedByFilterCount: 0,
      maxExpandedHits: 10
    });
  });

  it('does not collect parent candidates when includeParents is false', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'parent',
        prevChunkId: 'previous',
        nextChunkId: 'next'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'parent' }), makeChunk({ id: 'previous' }), makeChunk({ id: 'next' })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' }),
      policy: {
        includeParents: false
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'previous', 'next']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 2,
      addedCount: 2,
      dedupedCount: 0
    });
  });

  it('does not collect neighbor candidates when includeNeighbors is false', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'parent',
        prevChunkId: 'previous',
        nextChunkId: 'next'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'parent' }), makeChunk({ id: 'previous' }), makeChunk({ id: 'next' })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' }),
      policy: {
        includeNeighbors: false
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'parent']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 1,
      addedCount: 1,
      dedupedCount: 0
    });
  });

  it('appends expanded hits in candidate order when the repository returns chunks unordered', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'parent',
        prevChunkId: 'previous',
        nextChunkId: 'next'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeUnorderedChunkRepository([
        makeChunk({ id: 'parent' }),
        makeChunk({ id: 'previous' }),
        makeChunk({ id: 'next' })
      ]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' })
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'parent', 'previous', 'next']);
  });

  it('drops expanded chunks that fail resolved metadata filters', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'draft-parent'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'draft-parent', metadata: { status: 'draft' } })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy', filters: { statuses: ['active'] } })
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 1,
      addedCount: 0,
      droppedByFilterCount: 1
    });
  });

  it('dedupes seed chunks and repeated candidates by chunk id', async () => {
    const seed = makeHit({
      chunkId: 'seed',
      metadata: {
        status: 'active',
        parentId: 'seed',
        prevChunkId: 'shared',
        nextChunkId: 'shared'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'seed' }), makeChunk({ id: 'shared' })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' })
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'shared']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 3,
      addedCount: 1,
      dedupedCount: 2,
      droppedByFilterCount: 0
    });
  });

  it('reports missing candidates separately from deduped candidates', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'missing',
        prevChunkId: 'shared',
        nextChunkId: 'shared'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'shared' })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' })
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'shared']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 3,
      addedCount: 1,
      dedupedCount: 1,
      missingCount: 1,
      droppedByFilterCount: 0
    });
  });

  it('limits the number of added expanded hits by policy maxExpandedHits', async () => {
    const seed = makeHit({
      metadata: {
        status: 'active',
        parentId: 'parent',
        prevChunkId: 'previous',
        nextChunkId: 'next'
      }
    });
    const expander = new SmallToBigContextExpander(
      makeChunkRepository([makeChunk({ id: 'parent' }), makeChunk({ id: 'previous' }), makeChunk({ id: 'next' })]),
      makeSourceRepository([makeSource()])
    );

    const result = await expander.expand([seed], makeRequest(), {
      filters: resolveKnowledgeRetrievalFilters({ query: 'policy' }),
      policy: {
        maxExpandedHits: 2
      }
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed', 'parent', 'previous']);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 3,
      addedCount: 2,
      maxExpandedHits: 2
    });
  });
});
