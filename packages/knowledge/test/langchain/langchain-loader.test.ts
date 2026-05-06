import { describe, it, expect, vi } from 'vitest';
import type { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { Document as LangChainDocument } from '@langchain/core/documents';

import { LangChainLoaderAdapter } from '../../src/adapters/langchain/loaders/langchain-loader.adapter';
import { mapLangChainDocumentToCoreDocument } from '../../src/adapters/langchain/shared/langchain-document.mapper';

function makeLcDoc(
  overrides: Partial<{ pageContent: string; metadata: Record<string, unknown> }> = {}
): LangChainDocument {
  return {
    pageContent: overrides.pageContent ?? 'hello world',
    metadata: overrides.metadata ?? {}
  } as LangChainDocument;
}

describe('mapLangChainDocumentToCoreDocument', () => {
  it('should use metadata.id when available', () => {
    const lc = makeLcDoc({ metadata: { id: 'my-id', source: '/file.md' } });
    const doc = mapLangChainDocumentToCoreDocument(lc);
    expect(doc.id).toBe('my-id');
  });

  it('should fall back to metadata.source when no id', () => {
    const lc = makeLcDoc({ metadata: { source: '/docs/readme.md' } });
    const doc = mapLangChainDocumentToCoreDocument(lc);
    expect(doc.id).toBe('/docs/readme.md');
  });

  it('should generate stable fallback id when no id or source', () => {
    const lc = makeLcDoc({ pageContent: 'some content', metadata: {} });
    const doc1 = mapLangChainDocumentToCoreDocument(lc, 0);
    const doc2 = mapLangChainDocumentToCoreDocument(lc, 0);
    expect(doc1.id).toBe(doc2.id);
  });

  it('should normalize metadata (remove undefined)', () => {
    const lc = makeLcDoc({ metadata: { a: undefined, b: 'keep' } });
    const doc = mapLangChainDocumentToCoreDocument(lc);
    expect(doc.metadata).not.toHaveProperty('a');
    expect(doc.metadata['b']).toBe('keep');
  });

  it('should map pageContent to content', () => {
    const lc = makeLcDoc({ pageContent: 'the text' });
    const doc = mapLangChainDocumentToCoreDocument(lc);
    expect(doc.content).toBe('the text');
  });
});

describe('LangChainLoaderAdapter', () => {
  it('should return empty array for empty loader', async () => {
    const mockLoader: BaseDocumentLoader = { load: vi.fn().mockResolvedValue([]) } as unknown as BaseDocumentLoader;
    const adapter = new LangChainLoaderAdapter(mockLoader);
    expect(await adapter.load()).toEqual([]);
  });

  it('should map all documents', async () => {
    const docs = [
      makeLcDoc({ pageContent: 'doc1', metadata: { id: 'id1' } }),
      makeLcDoc({ pageContent: 'doc2', metadata: { id: 'id2' } })
    ];
    const mockLoader: BaseDocumentLoader = { load: vi.fn().mockResolvedValue(docs) } as unknown as BaseDocumentLoader;
    const adapter = new LangChainLoaderAdapter(mockLoader);
    const result = await adapter.load();
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('id1');
    expect(result[1]?.content).toBe('doc2');
  });
});
