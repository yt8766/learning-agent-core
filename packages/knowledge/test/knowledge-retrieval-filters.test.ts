import { describe, expect, it } from 'vitest';

import {
  KnowledgeChunkSchema,
  RetrievalHitSchema,
  RetrievalRequestSchema,
  matchesKnowledgeChunkFilters,
  matchesKnowledgeHitFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from '../src';

describe('knowledge retrieval filters', () => {
  it('parses filters on RetrievalRequest and chunk metadata', () => {
    const request = RetrievalRequestSchema.parse({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['src-sales'],
        documentIds: ['doc-sales-policy'],
        minTrustClass: 'curated',
        trustClasses: ['official', 'internal'],
        searchableOnly: true,
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });

    const chunk = KnowledgeChunkSchema.parse({
      id: 'chunk-1',
      sourceId: 'src-sales',
      documentId: 'doc-sales-policy',
      chunkIndex: 0,
      content: '销售部报销流程',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['sales', 'finance']
      }
    });

    expect(request.filters?.docTypes).toEqual(['policy']);
    expect(chunk.metadata?.allowedRoles).toEqual(['sales', 'finance']);
  });

  it('parses JSON-safe chunk and hit metadata while rejecting non-JSON metadata values', () => {
    const metadata = {
      docType: 'policy',
      status: 'active',
      allowedRoles: ['hr'],
      category: 'hr',
      priority: 1,
      nested: { active: true }
    };

    expect(
      KnowledgeChunkSchema.parse({
        id: 'chunk-1',
        sourceId: 'src-hr',
        documentId: 'doc-hr-policy',
        chunkIndex: 0,
        content: '人事政策',
        searchable: true,
        updatedAt: '2026-04-30T00:00:00.000Z',
        metadata
      }).metadata
    ).toMatchObject(metadata);

    expect(
      RetrievalHitSchema.parse({
        chunkId: 'chunk-1',
        documentId: 'doc-hr-policy',
        sourceId: 'src-hr',
        title: '人事政策',
        uri: '/docs/hr.md',
        sourceType: 'repo-docs',
        trustClass: 'official',
        content: '人事政策',
        score: 0.9,
        metadata,
        citation: {
          sourceId: 'src-hr',
          chunkId: 'chunk-1',
          title: '人事政策',
          uri: '/docs/hr.md',
          sourceType: 'repo-docs',
          trustClass: 'official'
        }
      }).metadata
    ).toMatchObject(metadata);

    expect(() =>
      KnowledgeChunkSchema.parse({
        id: 'chunk-2',
        sourceId: 'src-hr',
        documentId: 'doc-hr-policy',
        chunkIndex: 1,
        content: '人事政策',
        searchable: true,
        updatedAt: '2026-04-30T00:00:00.000Z',
        metadata: {
          loader: () => 'not json safe'
        }
      })
    ).toThrow();
  });

  it('resolves legacy filters with explicit filters taking precedence', () => {
    expect(
      resolveKnowledgeRetrievalFilters({
        query: 'retrieval',
        allowedSourceTypes: ['workspace-docs'],
        minTrustClass: 'community'
      })
    ).toMatchObject({
      sourceTypes: ['workspace-docs'],
      minTrustClass: 'community',
      searchableOnly: true
    });

    const filters = resolveKnowledgeRetrievalFilters({
      query: 'retrieval',
      allowedSourceTypes: ['workspace-docs'],
      minTrustClass: 'community',
      filters: {
        sourceTypes: ['repo-docs'],
        minTrustClass: 'curated'
      }
    });

    expect(filters).toMatchObject({
      sourceTypes: ['repo-docs'],
      minTrustClass: 'curated',
      searchableOnly: true
    });
  });

  it('matches source filters with stable trust ranking', () => {
    const combinedFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['src-sales'],
        minTrustClass: 'curated',
        trustClasses: ['curated', 'official']
      }
    });

    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official'
        },
        combinedFilters
      )
    ).toBe(true);
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'community'
        },
        combinedFilters
      )
    ).toBe(false);
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-procurement',
          sourceType: 'repo-docs',
          trustClass: 'official'
        },
        combinedFilters
      )
    ).toBe(false);

    const sourceTypeFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs']
      }
    });
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'workspace-docs',
          trustClass: 'official'
        },
        sourceTypeFilters
      )
    ).toBe(false);

    const sourceIdFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceIds: ['src-sales']
      }
    });
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-procurement',
          sourceType: 'repo-docs',
          trustClass: 'official'
        },
        sourceIdFilters
      )
    ).toBe(false);

    const trustClassFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        trustClasses: ['official']
      }
    });
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'internal'
        },
        trustClassFilters
      )
    ).toBe(false);

    const minOfficialFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        minTrustClass: 'official'
      }
    });
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'internal'
        },
        minOfficialFilters
      )
    ).toBe(true);
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'curated'
        },
        minOfficialFilters
      )
    ).toBe(false);

    const minInternalFilters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        minTrustClass: 'internal'
      }
    });
    expect(
      matchesKnowledgeSourceFilters(
        {
          id: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official'
        },
        minInternalFilters
      )
    ).toBe(false);
  });

  it('treats empty filter arrays as disabled filters', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceTypes: [],
        sourceIds: [],
        trustClasses: [],
        documentIds: [],
        docTypes: [],
        statuses: [],
        allowedRoles: []
      }
    });
    const source = {
      id: 'src-sales',
      sourceType: 'repo-docs' as const,
      trustClass: 'official' as const
    };
    const chunk = {
      documentId: 'doc-sales-policy',
      searchable: true,
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['sales']
      }
    };
    const hit = {
      documentId: 'doc-sales-policy',
      sourceId: 'src-sales',
      sourceType: 'repo-docs' as const,
      trustClass: 'official' as const,
      metadata: chunk.metadata
    };

    expect(matchesKnowledgeSourceFilters(source, filters)).toBe(true);
    expect(matchesKnowledgeChunkFilters(chunk, filters)).toBe(true);
    expect(matchesKnowledgeHitFilters(hit, filters)).toBe(true);
  });

  it('matches chunk filters by document and metadata', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        documentIds: ['doc-sales-policy'],
        searchableOnly: true,
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });
    const chunk = {
      documentId: 'doc-sales-policy',
      searchable: true,
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['sales', 'finance']
      }
    };

    expect(matchesKnowledgeChunkFilters(chunk, filters)).toBe(true);
    expect(matchesKnowledgeChunkFilters({ ...chunk, searchable: false }, filters)).toBe(false);
    expect(matchesKnowledgeChunkFilters({ ...chunk, documentId: 'doc-other' }, filters)).toBe(false);
    expect(
      matchesKnowledgeChunkFilters({ ...chunk, metadata: { ...chunk.metadata, docType: 'workflow' } }, filters)
    ).toBe(false);
    expect(
      matchesKnowledgeChunkFilters({ ...chunk, metadata: { ...chunk.metadata, status: 'inactive' } }, filters)
    ).toBe(false);
    expect(
      matchesKnowledgeChunkFilters({ ...chunk, metadata: { ...chunk.metadata, allowedRoles: ['finance'] } }, filters)
    ).toBe(false);
    expect(matchesKnowledgeChunkFilters({ ...chunk, metadata: undefined }, filters)).toBe(false);
  });

  it('matches hit filters across source and chunk dimensions', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['src-sales'],
        documentIds: ['doc-sales-policy'],
        minTrustClass: 'curated',
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });

    expect(
      matchesKnowledgeHitFilters(
        {
          documentId: 'doc-sales-policy',
          sourceId: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official',
          metadata: {
            docType: 'policy',
            status: 'active',
            allowedRoles: ['sales']
          }
        },
        filters
      )
    ).toBe(true);
    expect(
      matchesKnowledgeHitFilters(
        {
          documentId: 'doc-sales-policy',
          sourceId: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'community',
          metadata: {
            docType: 'policy',
            status: 'active',
            allowedRoles: ['sales']
          }
        },
        filters
      )
    ).toBe(false);
    expect(
      matchesKnowledgeHitFilters(
        {
          documentId: 'doc-sales-policy',
          sourceId: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official',
          metadata: {
            docType: 'policy',
            status: 'inactive',
            allowedRoles: ['sales']
          }
        },
        filters
      )
    ).toBe(false);
    expect(
      matchesKnowledgeHitFilters(
        {
          documentId: 'doc-sales-policy',
          sourceId: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official',
          metadata: {
            docType: 'workflow',
            status: 'active',
            allowedRoles: ['sales']
          }
        },
        filters
      )
    ).toBe(false);
    expect(
      matchesKnowledgeHitFilters(
        {
          documentId: 'doc-sales-policy',
          sourceId: 'src-sales',
          sourceType: 'repo-docs',
          trustClass: 'official',
          metadata: {
            docType: 'policy',
            status: 'active',
            allowedRoles: ['finance']
          }
        },
        filters
      )
    ).toBe(false);
  });
});
