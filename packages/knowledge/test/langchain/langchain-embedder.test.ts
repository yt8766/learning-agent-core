import { describe, it, expect, vi } from 'vitest';
import type { Embeddings } from '@langchain/core/embeddings';

import { LangChainEmbedderAdapter } from '../../src/adapters/langchain/embedders/langchain-embedder.adapter';
import { AdapterError } from '../../src/adapters/shared/errors/adapter-error';

function makeEmbeddings(vectors: number[][]): Embeddings {
  return {
    embedDocuments: vi.fn().mockResolvedValue(vectors),
    embedQuery: vi.fn()
  } as unknown as Embeddings;
}

const baseChunks = [
  { id: 'c1', content: 'chunk 1', sourceDocumentId: 'doc1', chunkIndex: 0, metadata: { source: 'file.md' } },
  { id: 'c2', content: 'chunk 2', sourceDocumentId: 'doc1', chunkIndex: 1, metadata: { source: 'file.md' } }
];

describe('LangChainEmbedderAdapter', () => {
  it('should return empty array for empty input', async () => {
    const adapter = new LangChainEmbedderAdapter(makeEmbeddings([]));
    expect(await adapter.embed([])).toEqual([]);
  });

  it('should return vectors with correct ids', async () => {
    const adapter = new LangChainEmbedderAdapter(
      makeEmbeddings([
        [0.1, 0.2],
        [0.3, 0.4]
      ])
    );
    const vectors = await adapter.embed(baseChunks);
    expect(vectors[0]?.id).toBe('c1');
    expect(vectors[1]?.id).toBe('c2');
  });

  it('should set sourceChunkId', async () => {
    const adapter = new LangChainEmbedderAdapter(
      makeEmbeddings([
        [0.1, 0.2],
        [0.3, 0.4]
      ])
    );
    const vectors = await adapter.embed(baseChunks);
    expect(vectors[0]?.sourceChunkId).toBe('c1');
  });

  it('should preserve chunk metadata', async () => {
    const adapter = new LangChainEmbedderAdapter(
      makeEmbeddings([
        [0.1, 0.2],
        [0.3, 0.4]
      ])
    );
    const vectors = await adapter.embed(baseChunks);
    expect(vectors[0]?.metadata['source']).toBe('file.md');
  });

  it('should throw AdapterError when count mismatches', async () => {
    const adapter = new LangChainEmbedderAdapter(makeEmbeddings([[0.1, 0.2]]));
    await expect(adapter.embed(baseChunks)).rejects.toThrow(AdapterError);
  });

  it('should throw AdapterError when dimensions are inconsistent', async () => {
    const adapter = new LangChainEmbedderAdapter(makeEmbeddings([[0.1, 0.2], [0.3]]));
    await expect(adapter.embed(baseChunks)).rejects.toThrow(AdapterError);
  });
});
