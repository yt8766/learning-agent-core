import { describe, expect, it, vi } from 'vitest';

import {
  ChromaVectorSearchProvider,
  buildChromaKnowledgeFilterWhere,
  type ChromaSearchCollectionLike
} from '../../src/adapters/chroma';

function makeCollection(query = vi.fn()): ChromaSearchCollectionLike {
  return { query };
}

describe('ChromaVectorSearchProvider', () => {
  it('embeds the query, pushes supported filters to Chroma, and maps hits to VectorSearchProvider results', async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    const query = vi.fn().mockResolvedValue({
      ids: [['chunk-1', 'chunk-2']],
      distances: [[0.12, 0.37]],
      metadatas: [[{ knowledgeBaseId: 'kb_rag' }, { knowledgeBaseId: 'kb_rag' }]]
    });

    const provider = new ChromaVectorSearchProvider({
      collectionName: 'knowledge',
      embeddingProvider: { embedQuery },
      client: {
        getOrCreateCollection: vi.fn().mockResolvedValue(makeCollection(query))
      }
    });

    const hits = await provider.searchSimilar('hybrid search', 2, {
      filters: {
        sourceIds: ['repo-docs'],
        knowledgeBaseIds: ['kb_rag'],
        sourceTypes: ['repo-docs'],
        documentIds: ['doc-1'],
        docTypes: ['design'],
        statuses: ['active'],
        minTrustClass: 'curated',
        allowedRoles: ['admin'],
        searchableOnly: true
      }
    });

    expect(embedQuery).toHaveBeenCalledWith('hybrid search');
    expect(query).toHaveBeenCalledWith({
      queryEmbeddings: [[0.1, 0.2, 0.3]],
      nResults: 2,
      where: {
        $and: [
          { sourceId: { $in: ['repo-docs'] } },
          { knowledgeBaseId: { $in: ['kb_rag'] } },
          { sourceType: { $in: ['repo-docs'] } },
          { documentId: { $in: ['doc-1'] } },
          { docType: { $in: ['design'] } },
          { status: { $in: ['active'] } },
          { trustClass: { $in: ['curated', 'official', 'internal'] } },
          { searchable: true }
        ]
      }
    });
    expect(hits).toEqual([
      { chunkId: 'chunk-1', knowledgeBaseId: 'kb_rag', score: 0.88 },
      { chunkId: 'chunk-2', knowledgeBaseId: 'kb_rag', score: 0.63 }
    ]);
  });

  it('supports only pushdown-safe metadata filters', () => {
    expect(
      buildChromaKnowledgeFilterWhere({
        sourceIds: ['source-a'],
        allowedRoles: ['maintainer'],
        searchableOnly: false
      })
    ).toEqual({ sourceId: { $in: ['source-a'] } });
  });

  it('checks Chroma collection reachability without issuing a vector query', async () => {
    const query = vi.fn();
    const getOrCreateCollection = vi.fn().mockResolvedValue(makeCollection(query));
    const provider = new ChromaVectorSearchProvider({
      collectionName: 'knowledge',
      embeddingProvider: { embedQuery: vi.fn() },
      client: {
        getOrCreateCollection
      }
    });

    await expect(provider.healthCheck()).resolves.toEqual({
      status: 'healthy',
      message: 'Chroma collection "knowledge" is reachable.'
    });
    expect(getOrCreateCollection).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });
});
