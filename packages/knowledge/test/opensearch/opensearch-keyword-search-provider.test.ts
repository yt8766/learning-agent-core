import { describe, expect, it, vi } from 'vitest';
import { HybridRetrievalEngine } from '@agent/knowledge';

import { AdapterError } from '../../src/adapters/shared/errors/adapter-error';
import {
  OpenSearchKeywordSearchProvider,
  buildOpenSearchKnowledgeFilter,
  createOpenSearchKeywordSearchProvider
} from '../../src/adapters/opensearch';

describe('OpenSearchKeywordSearchProvider', () => {
  it('creates a keyword provider from explicit production configuration', async () => {
    const search = vi.fn().mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: 'factory-chunk',
            _score: 9,
            _source: {
              documentId: 'doc-1',
              sourceId: 'repo-docs',
              title: 'Factory Wiring',
              uri: 'file://docs/factory.md',
              sourceType: 'repo-docs',
              trustClass: 'official',
              content: 'Factory-created OpenSearch keyword provider.'
            }
          }
        ]
      }
    });

    const provider = createOpenSearchKeywordSearchProvider({
      client: { search },
      indexName: 'knowledge-production',
      fields: ['title^3', 'content']
    });

    const result = await provider.search({
      query: 'factory wiring',
      limit: 1
    });

    expect(provider).toBeInstanceOf(OpenSearchKeywordSearchProvider);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'knowledge-production',
        query: expect.objectContaining({
          bool: expect.objectContaining({
            must: [
              {
                multi_match: {
                  query: 'factory wiring',
                  fields: ['title^3', 'content'],
                  type: 'best_fields'
                }
              }
            ]
          })
        })
      })
    );
    expect(result.hits[0]?.chunkId).toBe('factory-chunk');
  });

  it('rejects invalid explicit OpenSearch keyword provider configuration before querying', () => {
    expect(() =>
      createOpenSearchKeywordSearchProvider({
        client: { search: vi.fn() },
        indexName: ' '
      })
    ).toThrow('OpenSearch keyword provider config requires a non-empty indexName');

    expect(() =>
      createOpenSearchKeywordSearchProvider({
        client: {} as never,
        indexName: 'knowledge-production'
      })
    ).toThrow('OpenSearch keyword provider config requires client.search');
  });

  it('pushes safe knowledge filters to OpenSearch and maps search hits to RetrievalResult', async () => {
    const search = vi.fn().mockResolvedValue({
      hits: {
        total: { value: 2 },
        hits: [
          {
            _id: 'chunk-1',
            _score: 12.5,
            _source: {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              sourceId: 'repo-docs',
              title: 'Hybrid Search Design',
              uri: 'file://docs/hybrid.md',
              sourceType: 'repo-docs',
              trustClass: 'official',
              content: 'Hybrid search combines keyword and vector retrieval.',
              metadata: {
                docType: 'design',
                status: 'active',
                allowedRoles: ['admin']
              }
            }
          },
          {
            _id: 'chunk-2',
            _score: 7,
            _source: {
              documentId: 'doc-2',
              sourceId: 'workspace-docs',
              title: 'Search Runtime',
              uri: 'file://docs/runtime.md',
              sourceType: 'workspace-docs',
              trustClass: 'curated',
              content: 'Runtime retrieval supports metadata prefilters.',
              metadata: {
                docType: 'runtime',
                status: 'active',
                allowedRoles: ['admin']
              }
            }
          }
        ]
      }
    });
    const provider = new OpenSearchKeywordSearchProvider({
      client: { search },
      indexName: 'knowledge-chunks'
    });

    const result = await provider.search({
      query: 'hybrid metadata retrieval',
      limit: 2,
      filters: {
        sourceIds: ['repo-docs', 'workspace-docs'],
        sourceTypes: ['repo-docs', 'workspace-docs'],
        documentIds: ['doc-1', 'doc-2'],
        docTypes: ['design', 'runtime'],
        statuses: ['active'],
        minTrustClass: 'curated',
        allowedRoles: ['admin'],
        searchableOnly: true
      }
    });

    expect(search).toHaveBeenCalledWith({
      index: 'knowledge-chunks',
      size: 2,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'hybrid metadata retrieval',
                fields: ['title^2', 'content', 'metadata.sectionTitle^1.5'],
                type: 'best_fields'
              }
            }
          ],
          filter: [
            { terms: { sourceId: ['repo-docs', 'workspace-docs'] } },
            { terms: { sourceType: ['repo-docs', 'workspace-docs'] } },
            { terms: { documentId: ['doc-1', 'doc-2'] } },
            { terms: { 'metadata.docType': ['design', 'runtime'] } },
            { terms: { 'metadata.status': ['active'] } },
            { terms: { trustClass: ['curated', 'official', 'internal'] } },
            { term: { searchable: true } }
          ]
        }
      }
    });
    expect(result).toEqual({
      hits: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          sourceId: 'repo-docs',
          title: 'Hybrid Search Design',
          uri: 'file://docs/hybrid.md',
          sourceType: 'repo-docs',
          trustClass: 'official',
          content: 'Hybrid search combines keyword and vector retrieval.',
          score: 12.5,
          metadata: {
            docType: 'design',
            status: 'active',
            allowedRoles: ['admin']
          },
          citation: {
            sourceId: 'repo-docs',
            chunkId: 'chunk-1',
            title: 'Hybrid Search Design',
            uri: 'file://docs/hybrid.md',
            quote: 'Hybrid search combines keyword and vector retrieval.',
            sourceType: 'repo-docs',
            trustClass: 'official'
          }
        },
        {
          chunkId: 'chunk-2',
          documentId: 'doc-2',
          sourceId: 'workspace-docs',
          title: 'Search Runtime',
          uri: 'file://docs/runtime.md',
          sourceType: 'workspace-docs',
          trustClass: 'curated',
          content: 'Runtime retrieval supports metadata prefilters.',
          score: 7,
          metadata: {
            docType: 'runtime',
            status: 'active',
            allowedRoles: ['admin']
          },
          citation: {
            sourceId: 'workspace-docs',
            chunkId: 'chunk-2',
            title: 'Search Runtime',
            uri: 'file://docs/runtime.md',
            quote: 'Runtime retrieval supports metadata prefilters.',
            sourceType: 'workspace-docs',
            trustClass: 'curated'
          }
        }
      ],
      total: 2
    });
  });

  it('does not push down allowedRoles because OpenSearch role semantics are authorization-specific', () => {
    expect(
      buildOpenSearchKnowledgeFilter({
        sourceIds: ['repo-docs'],
        allowedRoles: ['maintainer'],
        searchableOnly: false
      })
    ).toEqual([{ terms: { sourceId: ['repo-docs'] } }]);
  });

  it('defensively filters allowedRoles after OpenSearch returns hits', async () => {
    const provider = new OpenSearchKeywordSearchProvider({
      client: {
        search: vi.fn().mockResolvedValue({
          hits: {
            total: { value: 2 },
            hits: [
              {
                _id: 'allowed',
                _score: 5,
                _source: {
                  documentId: 'doc-1',
                  sourceId: 'source-1',
                  title: 'Allowed',
                  uri: 'file://allowed.md',
                  sourceType: 'repo-docs',
                  trustClass: 'official',
                  content: 'Allowed content',
                  metadata: { allowedRoles: ['maintainer'] }
                }
              },
              {
                _id: 'blocked',
                _score: 4,
                _source: {
                  documentId: 'doc-2',
                  sourceId: 'source-1',
                  title: 'Blocked',
                  uri: 'file://blocked.md',
                  sourceType: 'repo-docs',
                  trustClass: 'official',
                  content: 'Blocked content',
                  metadata: { allowedRoles: ['finance'] }
                }
              }
            ]
          }
        })
      },
      indexName: 'knowledge-chunks'
    });

    const result = await provider.search({
      query: 'policy',
      filters: { allowedRoles: ['maintainer'] },
      limit: 5
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
    expect(result.total).toBe(1);
  });

  it('checks OpenSearch index reachability with a lightweight size-zero query', async () => {
    const search = vi.fn().mockResolvedValue({
      hits: {
        total: { value: 0 },
        hits: []
      }
    });
    const provider = new OpenSearchKeywordSearchProvider({
      client: { search },
      indexName: 'knowledge-chunks'
    });

    const result = await provider.healthCheck();

    expect(search).toHaveBeenCalledWith({
      index: 'knowledge-chunks',
      size: 0,
      query: {
        match_all: {}
      }
    });
    expect(result).toEqual({
      status: 'healthy',
      checkedAt: expect.any(String),
      latencyMs: expect.any(Number),
      message: 'OpenSearch index "knowledge-chunks" is reachable.'
    });
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
  });

  it('throws AdapterError when OpenSearch index health check fails', async () => {
    const provider = new OpenSearchKeywordSearchProvider({
      client: {
        search: vi.fn().mockRejectedValue(new Error('cluster unavailable'))
      },
      indexName: 'knowledge-chunks'
    });

    await expect(provider.healthCheck()).rejects.toThrow(
      'Failed to check OpenSearch index health: Error: cluster unavailable'
    );
    await expect(provider.healthCheck()).rejects.toBeInstanceOf(AdapterError);
  });

  it('can be injected into HybridRetrievalEngine as the keyword retriever', async () => {
    const keyword = new OpenSearchKeywordSearchProvider({
      client: {
        search: vi.fn().mockResolvedValue({
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: 'keyword-chunk',
                _score: 4,
                _source: {
                  documentId: 'doc-1',
                  sourceId: 'repo-docs',
                  title: 'Hybrid Search',
                  uri: 'file://docs/hybrid.md',
                  sourceType: 'repo-docs',
                  trustClass: 'official',
                  content: 'OpenSearch keyword hit.',
                  metadata: { status: 'active' }
                }
              }
            ]
          }
        })
      },
      indexName: 'knowledge-chunks'
    });
    const vector = {
      search: vi.fn().mockResolvedValue({
        hits: [],
        total: 0
      })
    };
    const engine = new HybridRetrievalEngine(keyword, vector);

    const result = await engine.retrieve({
      query: 'hybrid search',
      limit: 3,
      filters: { statuses: ['active'] }
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.chunkId).toBe('keyword-chunk');
    expect(result.diagnostics.enabledRetrievers).toEqual(['keyword', 'vector']);
  });
});
