import { describe, it, expect, vi } from 'vitest';
import type { BaseDocumentTransformer, Document as LangChainDocument } from '@langchain/core/documents';

import { LangChainChunkerAdapter } from '../../src/langchain/chunkers/langchain-chunker.adapter';

function makeTransformer(splits: string[]): BaseDocumentTransformer {
  return {
    transformDocuments: vi
      .fn()
      .mockResolvedValue(splits.map(text => ({ pageContent: text, metadata: {} }) as LangChainDocument))
  } as unknown as BaseDocumentTransformer;
}

const baseDoc = { id: 'doc1', content: 'long document text', metadata: {} };

describe('LangChainChunkerAdapter', () => {
  it('should chunk a document into multiple chunks', async () => {
    const adapter = new LangChainChunkerAdapter(makeTransformer(['chunk a', 'chunk b', 'chunk c']));
    const chunks = await adapter.chunk(baseDoc);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.sourceDocumentId).toBe('doc1');
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[2]?.chunkIndex).toBe(2);
  });

  it('should skip blank chunks', async () => {
    const adapter = new LangChainChunkerAdapter(makeTransformer(['chunk a', '   ', 'chunk b']));
    const chunks = await adapter.chunk(baseDoc);
    expect(chunks).toHaveLength(2);
  });

  it('should assign stable chunkIds', async () => {
    const adapter = new LangChainChunkerAdapter(makeTransformer(['x', 'y']));
    const chunks = await adapter.chunk(baseDoc);
    expect(chunks[0]?.id).toBeTruthy();
    expect(chunks[0]?.id).not.toBe(chunks[1]?.id);
  });

  it('should include sourceDocumentId in metadata', async () => {
    const adapter = new LangChainChunkerAdapter(makeTransformer(['content']));
    const chunks = await adapter.chunk(baseDoc);
    expect(chunks[0]?.metadata['sourceDocumentId']).toBe('doc1');
  });
});
