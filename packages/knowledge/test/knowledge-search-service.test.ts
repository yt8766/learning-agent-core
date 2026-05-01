import { describe, expect, it } from 'vitest';

import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import { DefaultKnowledgeSearchService } from '../src/retrieval/knowledge-search-service';

describe('DefaultKnowledgeSearchService', () => {
  it('returns ranked hits with citations from searchable chunks', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      {
        id: 'source-1',
        sourceType: 'repo-docs',
        uri: '/docs/rag.md',
        title: 'RAG Guide',
        trustClass: 'internal',
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);
    const chunkRepository = new InMemoryKnowledgeChunkRepository([
      {
        id: 'chunk-1',
        sourceId: 'source-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'RAG retrieval pipeline combines chunking, recall and citation assembly.',
        searchable: true,
        updatedAt: '2026-04-18T00:00:00.000Z'
      },
      {
        id: 'chunk-2',
        sourceId: 'source-1',
        documentId: 'doc-1',
        chunkIndex: 1,
        content: 'Unrelated glossary entry.',
        searchable: false,
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);

    const service = new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
    const result = await service.search({
      query: 'retrieval citation pipeline',
      allowedSourceTypes: ['repo-docs']
    });

    expect(result.total).toBe(1);
    expect(result.hits[0]?.chunkId).toBe('chunk-1');
    expect(result.hits[0]?.citation.title).toBe('RAG Guide');
    expect(result.hits[0]?.score).toBeGreaterThan(0);
  });

  it('filters out chunks whose source type is not allowed', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      {
        id: 'source-1',
        sourceType: 'repo-docs',
        uri: '/docs/rag.md',
        title: 'RAG Guide',
        trustClass: 'internal',
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);
    const chunkRepository = new InMemoryKnowledgeChunkRepository([
      {
        id: 'chunk-1',
        sourceId: 'source-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'retrieval pipeline',
        searchable: true,
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);

    const service = new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
    const result = await service.search({
      query: 'retrieval pipeline',
      allowedSourceTypes: ['workspace-docs']
    });

    expect(result).toEqual({ hits: [], total: 0 });
  });

  it('filters candidates by metadata before keyword scoring', async () => {
    const sourceRepository = new InMemoryKnowledgeSourceRepository([
      {
        id: 'source-1',
        sourceType: 'repo-docs',
        uri: '/docs/sales-policy.md',
        title: 'Sales Policy',
        trustClass: 'internal',
        updatedAt: '2026-04-30T00:00:00.000Z'
      }
    ]);
    const chunkRepository = new InMemoryKnowledgeChunkRepository([
      {
        id: 'chunk-active',
        sourceId: 'source-1',
        documentId: 'doc-sales-policy',
        chunkIndex: 0,
        content: 'sales discount policy',
        searchable: true,
        updatedAt: '2026-04-30T00:00:00.000Z',
        metadata: {
          docType: 'policy',
          status: 'active',
          allowedRoles: ['sales']
        }
      },
      {
        id: 'chunk-inactive',
        sourceId: 'source-1',
        documentId: 'doc-sales-policy',
        chunkIndex: 1,
        content:
          'sales discount approval policy sales discount approval policy sales discount approval policy requires manager review',
        searchable: true,
        updatedAt: '2026-04-30T00:00:00.000Z',
        metadata: {
          docType: 'policy',
          status: 'inactive',
          allowedRoles: ['sales']
        }
      }
    ]);

    const service = new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
    const result = await service.search({
      query: 'sales discount approval policy',
      limit: 1,
      filters: {
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });

    expect(result.total).toBe(1);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.chunkId).toBe('chunk-active');
    expect(result.hits[0]?.metadata).toEqual({
      docType: 'policy',
      status: 'active',
      allowedRoles: ['sales']
    });
  });
});
