import { describe, expect, it } from 'vitest';

import {
  FixedWindowKnowledgeChunker,
  InMemoryKnowledgeIndexWriter,
  MockKnowledgeEmbedder,
  runKnowledgeIndexing,
  StaticKnowledgeDocumentLoader
} from '../src';

describe('runKnowledgeIndexing', () => {
  it('orchestrates load, transform, chunk, embed and write for knowledge documents', async () => {
    const loader = new StaticKnowledgeDocumentLoader([
      {
        id: 'doc-1',
        sourceId: 'source-1',
        title: 'Indexing Guide',
        uri: '/docs/indexing.md',
        content: 'chunking retrieval citation pipeline for knowledge indexing',
        sourceType: 'repo-docs',
        trustClass: 'internal',
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);
    const writer = new InMemoryKnowledgeIndexWriter();

    const result = await runKnowledgeIndexing({
      loader,
      chunker: new FixedWindowKnowledgeChunker(),
      embedder: new MockKnowledgeEmbedder(),
      writer,
      chunkSize: 18,
      chunkOverlap: 4,
      metadataBuilder: ({ chunk }) => ({ preview: chunk.content.slice(0, 10) })
    });

    expect(result.loadedDocumentCount).toBe(1);
    expect(result.indexedDocumentCount).toBe(1);
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.embeddedChunkCount).toBe(result.chunkCount);
    expect(writer.sources[0]?.id).toBe('source-1');
    expect(writer.chunks[0]?.metadata.preview).toBeTypeOf('string');
    expect(writer.embeddings).toHaveLength(result.chunkCount);
  });

  it('reports skipped documents through the default warning path', async () => {
    const loader = new StaticKnowledgeDocumentLoader([
      {
        id: 'doc-1',
        sourceId: 'source-1',
        title: 'Empty Guide',
        uri: '/docs/empty.md',
        content: '   ',
        sourceType: 'repo-docs',
        trustClass: 'internal',
        updatedAt: '2026-04-18T00:00:00.000Z'
      }
    ]);
    const writer = new InMemoryKnowledgeIndexWriter();

    const result = await runKnowledgeIndexing({
      loader,
      embedder: new MockKnowledgeEmbedder(),
      writer
    });

    expect(result.indexedDocumentCount).toBe(0);
    expect(result.skippedDocumentCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(writer.embeddings).toHaveLength(0);
  });
});
