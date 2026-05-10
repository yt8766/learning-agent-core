import { describe, expect, it } from 'vitest';

import type { KnowledgeChunk, KnowledgeSource, KnowledgeVectorDocumentRecord } from '@agent/knowledge';

import { createKnowledgeSourceIngestionLoader, runKnowledgeIndexing } from '../src';

describe('createKnowledgeSourceIngestionLoader', () => {
  it('normalizes production source payloads into indexing documents for source/chunk/vector fanout', async () => {
    const sources: KnowledgeSource[] = [];
    const chunks: KnowledgeChunk[] = [];
    const vectors: KnowledgeVectorDocumentRecord[] = [];
    const loader = createKnowledgeSourceIngestionLoader([
      {
        sourceId: 'upload-1',
        documentId: 'upload-doc-1',
        sourceType: 'user-upload',
        uri: '/uploads/security.md',
        title: 'Uploaded Security Policy',
        trustClass: 'internal',
        content: 'uploaded security policy for approvals',
        metadata: {
          docType: 'uploaded-policy',
          status: 'active',
          allowedRoles: ['admin']
        }
      },
      {
        sourceId: 'catalog-1',
        sourceType: 'catalog-sync',
        uri: 'catalog://service/runtime',
        title: 'Runtime Catalog Service',
        trustClass: 'official',
        content: 'catalog sync runtime service owner and SLA',
        metadata: {
          docType: 'catalog-entry',
          status: 'active'
        }
      },
      {
        sourceId: 'web-1',
        sourceType: 'web-curated',
        uri: 'https://example.com/runtime-provider',
        title: 'Runtime Provider Reference',
        trustClass: 'curated',
        content: 'curated provider reference for opensearch chroma deployment',
        version: '2026-05-01',
        metadata: {
          docType: 'curated-reference',
          status: 'active'
        }
      }
    ]);

    const result = await runKnowledgeIndexing({
      loader,
      sourceIndex: {
        async upsertKnowledgeSource(source) {
          sources.push(source);
        }
      },
      fulltextIndex: {
        async upsertKnowledgeChunk(chunk) {
          chunks.push(chunk);
        }
      },
      vectorIndex: {
        async upsertKnowledge(record) {
          vectors.push(record);
        }
      },
      sourceConfig: {
        sourceId: 'fallback',
        sourceType: 'repo-docs',
        trustClass: 'internal'
      },
      chunkSize: 1200,
      chunkOverlap: 0
    });

    expect(result).toMatchObject({
      loadedDocumentCount: 3,
      sourceCount: 3,
      indexedDocumentCount: 3,
      chunkCount: 3,
      embeddedChunkCount: 3,
      fulltextChunkCount: 3
    });
    expect(sources.map(source => source.sourceType)).toEqual(['user-upload', 'catalog-sync', 'web-curated']);
    expect(chunks.map(chunk => chunk.sourceId)).toEqual(['upload-1', 'catalog-1', 'web-1']);
    expect(vectors.map(vector => vector.sourceType)).toEqual(['user-upload', 'catalog-sync', 'web-curated']);
    expect(chunks[0]?.metadata).toEqual(
      expect.objectContaining({
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        trustClass: 'internal',
        docType: 'uploaded-policy',
        allowedRoles: ['admin']
      })
    );
  });

  it('rejects unsupported source types before indexing side effects run', async () => {
    const loader = createKnowledgeSourceIngestionLoader([
      {
        sourceId: 'skill-1',
        sourceType: 'agent-skill',
        uri: '.agents/skills/example/SKILL.md',
        title: 'Example Skill',
        trustClass: 'internal',
        content: 'skill docs'
      }
    ]);

    await expect(loader.load()).rejects.toThrow();
  });
});
