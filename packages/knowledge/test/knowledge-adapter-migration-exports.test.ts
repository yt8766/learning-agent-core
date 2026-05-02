import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';
import * as knowledgeAdapters from '../src/adapters';
import * as chromaAdapters from '../src/adapters/chroma';
import * as langchainAdapters from '../src/adapters/langchain';
import * as opensearchAdapters from '../src/adapters/opensearch';
import * as supabaseAdapters from '../src/adapters/supabase';
import * as rootExports from '../src/index';

describe('@agent/knowledge migrated adapter exports', () => {
  it('hosts indexing and retrieval adapters under the knowledge adapter surface', () => {
    expect(langchainAdapters).toHaveProperty('LangChainLoaderAdapter');
    expect(langchainAdapters).toHaveProperty('LangChainChunkerAdapter');
    expect(langchainAdapters).toHaveProperty('LangChainEmbedderAdapter');
    expect(chromaAdapters).toHaveProperty('ChromaVectorStoreAdapter');
    expect(chromaAdapters).toHaveProperty('ChromaVectorSearchProvider');
    expect(opensearchAdapters).toHaveProperty('OpenSearchKeywordSearchProvider');
    expect(supabaseAdapters).toHaveProperty('SupabasePgVectorStoreAdapter');
  });

  it('re-exports migrated knowledge adapters from root and aggregate adapter entrypoints', () => {
    expect(rootExports.ChromaVectorSearchProvider).toBe(chromaAdapters.ChromaVectorSearchProvider);
    expect(rootExports.LangChainLoaderAdapter).toBe(langchainAdapters.LangChainLoaderAdapter);
    expect(rootExports.OpenSearchKeywordSearchProvider).toBe(opensearchAdapters.OpenSearchKeywordSearchProvider);
    expect(rootExports.SupabasePgVectorStoreAdapter).toBe(supabaseAdapters.SupabasePgVectorStoreAdapter);
    expect(knowledgeAdapters.ChromaVectorStoreAdapter).toBe(chromaAdapters.ChromaVectorStoreAdapter);
    expect(knowledgeAdapters.LangChainChunkerAdapter).toBe(langchainAdapters.LangChainChunkerAdapter);
  });

  it('declares publishable subpath exports for migrated adapter families', () => {
    expect(packageJson.exports).toHaveProperty('./adapters/chroma');
    expect(packageJson.exports).toHaveProperty('./adapters/langchain');
    expect(packageJson.exports).toHaveProperty('./adapters/opensearch');
    expect(packageJson.exports).toHaveProperty('./adapters/supabase');
  });
});
