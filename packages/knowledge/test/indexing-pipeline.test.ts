import { describe, expect, it } from 'vitest';

import type {
  Document,
  KnowledgeRagTrace,
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeVectorDocumentRecord,
  KnowledgeVectorIndexWriter,
  Loader
} from '@agent/knowledge';

import { createInMemoryKnowledgeRagObserver, exportKnowledgeRagTrace } from '../src/observability';
import { runKnowledgeIndexing } from '../src';

describe('runKnowledgeIndexing', () => {
  it('hands chunked knowledge documents to the knowledge vector boundary', async () => {
    const capturedRecords: KnowledgeVectorDocumentRecord[] = [];

    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [
          {
            id: 'doc-1',
            content: 'chunking retrieval citation pipeline for knowledge indexing',
            metadata: { title: 'Indexing Guide', uri: '/docs/indexing.md' }
          }
        ];
      }
    };

    const vectorIndex: KnowledgeVectorIndexWriter = {
      async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
        capturedRecords.push(record);
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      vectorIndex,
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 18,
      chunkOverlap: 4
    });

    expect(result.loadedDocumentCount).toBe(1);
    expect(result.indexedDocumentCount).toBe(1);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.embeddedChunkCount).toBe(result.chunkCount);
    expect(capturedRecords).toHaveLength(result.chunkCount);
    expect(capturedRecords[0]).toEqual(
      expect.objectContaining({
        namespace: 'knowledge',
        sourceId: 'source-1',
        documentId: 'doc-1',
        chunkId: capturedRecords[0]?.id,
        title: 'Indexing Guide',
        uri: '/docs/indexing.md',
        sourceType: 'repo-docs',
        searchable: true,
        content: expect.any(String)
      })
    );
  });

  it('reports skipped documents when content is empty', async () => {
    const capturedRecords: KnowledgeVectorDocumentRecord[] = [];

    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [{ id: 'doc-1', content: '   ', metadata: {} }];
      }
    };

    const vectorIndex: KnowledgeVectorIndexWriter = {
      async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
        capturedRecords.push(record);
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      vectorIndex,
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' }
    });

    expect(result.indexedDocumentCount).toBe(0);
    expect(result.skippedDocumentCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(capturedRecords).toHaveLength(0);
  });

  it('fans out indexed chunks to vector and fulltext writer boundaries', async () => {
    const vectorRecords: KnowledgeVectorDocumentRecord[] = [];
    const fulltextChunks: KnowledgeChunk[] = [];

    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [
          {
            id: 'doc-1',
            content: 'governance approval evidence runtime learning skill reuse',
            metadata: {
              sourceId: 'source-from-doc',
              title: 'Runtime Ops',
              uri: '/docs/runtime-ops.md',
              docType: 'runbook',
              status: 'active',
              allowedRoles: ['admin']
            }
          }
        ];
      }
    };

    const vectorIndex: KnowledgeVectorIndexWriter = {
      async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
        vectorRecords.push(record);
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      vectorIndex,
      fulltextIndex: {
        async upsertKnowledgeChunk(chunk: KnowledgeChunk): Promise<void> {
          fulltextChunks.push(chunk);
        }
      },
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 18,
      chunkOverlap: 4
    });

    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.embeddedChunkCount).toBe(result.chunkCount);
    expect(result.fulltextChunkCount).toBe(result.chunkCount);
    expect(vectorRecords).toHaveLength(result.chunkCount);
    expect(fulltextChunks).toHaveLength(result.chunkCount);
    expect(fulltextChunks[0]).toEqual(
      expect.objectContaining({
        id: vectorRecords[0]?.chunkId,
        sourceId: 'source-from-doc',
        documentId: 'doc-1',
        chunkIndex: 0,
        searchable: true,
        content: expect.any(String),
        updatedAt: expect.any(String),
        metadata: expect.objectContaining({
          docType: 'runbook',
          status: 'active',
          allowedRoles: ['admin'],
          title: 'Runtime Ops',
          uri: '/docs/runtime-ops.md'
        })
      })
    );
  });

  it('writes production source records alongside chunks for all externally ingested source types', async () => {
    const sources: KnowledgeSource[] = [];
    const fulltextChunks: KnowledgeChunk[] = [];
    const vectorRecords: KnowledgeVectorDocumentRecord[] = [];

    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [
          {
            id: 'upload-doc',
            content: 'uploaded policy evidence for runtime approval',
            metadata: {
              sourceId: 'src-upload',
              title: 'Uploaded Policy',
              uri: '/uploads/policy.md',
              sourceType: 'user-upload',
              trustClass: 'internal',
              docType: 'uploaded-policy',
              status: 'active',
              allowedRoles: ['admin']
            }
          },
          {
            id: 'catalog-doc',
            content: 'catalog sync entry for runtime connector governance',
            metadata: {
              sourceId: 'src-catalog',
              title: 'Catalog Entry',
              uri: 'catalog://entry/runtime',
              sourceType: 'catalog-sync',
              trustClass: 'official',
              docType: 'catalog-entry',
              status: 'active'
            }
          },
          {
            id: 'web-doc',
            content: 'curated web reference for provider deployment',
            metadata: {
              sourceId: 'src-web',
              title: 'Curated Web Reference',
              uri: 'https://example.com/provider',
              sourceType: 'web-curated',
              trustClass: 'curated',
              docType: 'curated-reference',
              status: 'active'
            }
          }
        ];
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      vectorIndex: {
        async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
          vectorRecords.push(record);
        }
      },
      fulltextIndex: {
        async upsertKnowledgeChunk(chunk: KnowledgeChunk): Promise<void> {
          fulltextChunks.push(chunk);
        }
      },
      sourceIndex: {
        async upsertKnowledgeSource(source: KnowledgeSource): Promise<void> {
          sources.push(source);
        }
      },
      sourceConfig: { sourceId: 'fallback-source', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 1200,
      chunkOverlap: 0
    });

    expect(result.sourceCount).toBe(3);
    expect(sources).toEqual([
      expect.objectContaining({
        id: 'src-upload',
        sourceType: 'user-upload',
        uri: '/uploads/policy.md',
        title: 'Uploaded Policy',
        trustClass: 'internal'
      }),
      expect.objectContaining({
        id: 'src-catalog',
        sourceType: 'catalog-sync',
        uri: 'catalog://entry/runtime',
        title: 'Catalog Entry',
        trustClass: 'official'
      }),
      expect.objectContaining({
        id: 'src-web',
        sourceType: 'web-curated',
        uri: 'https://example.com/provider',
        title: 'Curated Web Reference',
        trustClass: 'curated'
      })
    ]);
    expect(fulltextChunks.map(chunk => chunk.sourceId)).toEqual(['src-upload', 'src-catalog', 'src-web']);
    expect(vectorRecords.map(record => record.sourceType)).toEqual(['user-upload', 'catalog-sync', 'web-curated']);
    expect(fulltextChunks[0]?.metadata).toEqual(
      expect.objectContaining({
        docType: 'uploaded-policy',
        status: 'active',
        allowedRoles: ['admin'],
        sourceType: 'user-upload',
        trustClass: 'internal'
      })
    );
  });

  it('returns pipeline stage diagnostics and writer quality gates for SDK ingestion hosts', async () => {
    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [
          {
            id: 'doc-1',
            content: 'quality gates should describe chunk embed and store stages',
            metadata: { sourceId: 'source-1', title: 'Pipeline Diagnostics', uri: '/docs/pipeline.md' }
          }
        ];
      }
    };

    const vectorRecords: KnowledgeVectorDocumentRecord[] = [];
    const fulltextChunks: KnowledgeChunk[] = [];
    const sources: KnowledgeSource[] = [];

    const result = await runKnowledgeIndexing({
      loader,
      vectorIndex: {
        async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
          vectorRecords.push(record);
        }
      },
      fulltextIndex: {
        async upsertKnowledgeChunk(chunk: KnowledgeChunk): Promise<void> {
          fulltextChunks.push(chunk);
        }
      },
      sourceIndex: {
        async upsertKnowledgeSource(source: KnowledgeSource): Promise<void> {
          sources.push(source);
        }
      },
      sourceConfig: { sourceId: 'fallback-source', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 18,
      chunkOverlap: 4
    });

    expect(result.diagnostics?.stages).toEqual([
      expect.objectContaining({ stage: 'load', status: 'succeeded', outputCount: 1 }),
      expect.objectContaining({ stage: 'filter', status: 'succeeded', inputCount: 1, outputCount: 1 }),
      expect.objectContaining({ stage: 'chunk', status: 'succeeded', inputCount: 1, outputCount: result.chunkCount }),
      expect.objectContaining({
        stage: 'embed',
        status: 'succeeded',
        inputCount: result.chunkCount,
        outputCount: result.embeddedChunkCount
      }),
      expect.objectContaining({
        stage: 'store-vector',
        status: 'succeeded',
        inputCount: result.embeddedChunkCount,
        outputCount: vectorRecords.length
      }),
      expect.objectContaining({ stage: 'store-fulltext', status: 'succeeded', outputCount: fulltextChunks.length }),
      expect.objectContaining({ stage: 'store-source', status: 'succeeded', outputCount: sources.length })
    ]);
    expect(result.diagnostics?.qualityGates).toEqual([
      expect.objectContaining({
        name: 'vector-records-match-chunks',
        stage: 'embed',
        status: 'passed',
        expectedCount: result.chunkCount,
        actualCount: result.embeddedChunkCount
      }),
      expect.objectContaining({
        name: 'vector-writes-match-records',
        stage: 'store-vector',
        status: 'passed',
        expectedCount: result.embeddedChunkCount,
        actualCount: vectorRecords.length
      }),
      expect.objectContaining({
        name: 'fulltext-writes-match-chunks',
        stage: 'store-fulltext',
        status: 'passed',
        expectedCount: result.chunkCount,
        actualCount: fulltextChunks.length
      })
    ]);
  });

  it('records indexing stage events and count metrics when an observer is provided', async () => {
    const observer = createInMemoryKnowledgeRagObserver();
    const vectorRecords: KnowledgeVectorDocumentRecord[] = [];

    const result = await runKnowledgeIndexing({
      loader: {
        async load(): Promise<Document[]> {
          return [
            {
              id: 'doc-1',
              content: 'indexing observability records load chunk embed and store stages',
              metadata: { sourceId: 'source-1', title: 'Observed Indexing', uri: '/docs/observed-indexing.md' }
            }
          ];
        }
      },
      vectorIndex: {
        async upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void> {
          vectorRecords.push(record);
        }
      },
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 18,
      chunkOverlap: 4,
      observer,
      traceId: 'trace-indexing-runtime'
    });

    const trace = exportKnowledgeRagTrace(observer, 'trace-indexing-runtime');

    expect(trace).toMatchObject<Partial<KnowledgeRagTrace>>({
      traceId: 'trace-indexing-runtime',
      operation: 'indexing.run',
      status: 'succeeded',
      indexing: {
        sourceId: 'source-1',
        loadedDocumentCount: 1,
        chunkCount: result.chunkCount,
        embeddedChunkCount: result.embeddedChunkCount,
        storedChunkCount: vectorRecords.length
      }
    });
    expect(trace.events.map(event => event.name)).toEqual([
      'indexing.run.start',
      'indexing.load.complete',
      'indexing.chunk.complete',
      'indexing.embed.complete',
      'indexing.store.complete'
    ]);
    expect(trace.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'indexing.loaded_document_count', value: 1, unit: 'count' }),
        expect.objectContaining({ name: 'indexing.chunk_count', value: result.chunkCount, unit: 'count' }),
        expect.objectContaining({
          name: 'indexing.embedded_chunk_count',
          value: result.embeddedChunkCount,
          unit: 'count'
        }),
        expect.objectContaining({ name: 'indexing.stored_chunk_count', value: vectorRecords.length, unit: 'count' })
      ])
    );
  });
});
