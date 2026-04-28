import { describe, expect, it } from 'vitest';

import type { Document, Loader } from '@agent/knowledge';
import type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter } from '@agent/memory';

import { runKnowledgeIndexing } from '../src';

describe('runKnowledgeIndexing', () => {
  it('hands chunked knowledge documents to the @agent/memory vector boundary', async () => {
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
});
