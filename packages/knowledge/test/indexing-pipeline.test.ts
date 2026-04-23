import { describe, expect, it } from 'vitest';

import type { Chunk, Document, Embedder, Loader, Vector, VectorStore } from '@agent/core';

import { runKnowledgeIndexing } from '../src';

describe('runKnowledgeIndexing', () => {
  it('orchestrates load, chunk, embed and upsert using @agent/core contracts', async () => {
    const capturedVectors: Vector[] = [];

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

    const embedder: Embedder = {
      async embed(chunks: Chunk[]): Promise<Vector[]> {
        return chunks.map(chunk => ({
          id: chunk.id,
          values: [1, 2, 3, 4],
          metadata: chunk.metadata,
          sourceChunkId: chunk.id
        }));
      }
    };

    const vectorStore: VectorStore = {
      async upsert(vectors: Vector[]): Promise<void> {
        capturedVectors.push(...vectors);
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      embedder,
      vectorStore,
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' },
      chunkSize: 18,
      chunkOverlap: 4
    });

    expect(result.loadedDocumentCount).toBe(1);
    expect(result.indexedDocumentCount).toBe(1);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.embeddedChunkCount).toBe(result.chunkCount);
    expect(capturedVectors).toHaveLength(result.chunkCount);
    expect(capturedVectors[0]?.metadata['sourceId']).toBe('source-1');
    expect(capturedVectors[0]?.metadata['content']).toBeTypeOf('string');
    expect(capturedVectors[0]?.metadata['title']).toBe('Indexing Guide');
  });

  it('reports skipped documents when content is empty', async () => {
    const capturedVectors: Vector[] = [];

    const loader: Loader = {
      async load(): Promise<Document[]> {
        return [{ id: 'doc-1', content: '   ', metadata: {} }];
      }
    };

    const embedder: Embedder = {
      async embed(_chunks: Chunk[]): Promise<Vector[]> {
        return [];
      }
    };

    const vectorStore: VectorStore = {
      async upsert(vectors: Vector[]): Promise<void> {
        capturedVectors.push(...vectors);
      }
    };

    const result = await runKnowledgeIndexing({
      loader,
      embedder,
      vectorStore,
      sourceConfig: { sourceId: 'source-1', sourceType: 'repo-docs', trustClass: 'internal' }
    });

    expect(result.indexedDocumentCount).toBe(0);
    expect(result.skippedDocumentCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(capturedVectors).toHaveLength(0);
  });
});
