import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('@agent/knowledge SDK entrypoints', () => {
  it('exports stable browser and node entrypoints without vendor objects', async () => {
    const root = await import('../src');
    const browser = await import('../src/browser');
    const client = await import('../src/client');
    const node = await import('../src/node');

    expect(root.KnowledgeVectorSearchRequestSchema).toBeDefined();
    expect(root.createKnowledgeRuntime).toBeDefined();
    expect(browser.KnowledgeApiClient).toBeDefined();
    expect(browser.createKnowledgeBrowserClient).toBeDefined();
    expect(client.KnowledgeApiClient).toBeDefined();
    expect(node.createKnowledgeRuntime).toBeDefined();
  });

  it('lets SDK consumers compose runtime providers instead of hard-wiring defaults', async () => {
    const { createKnowledgeRuntime } = await import('../src/node');
    const vectorStore = {
      delete: async () => ({ deletedCount: 0 }),
      search: async () => ({ hits: [] }),
      upsert: async () => ({ upsertedCount: 0 })
    };

    const runtime = createKnowledgeRuntime({ vectorStore });

    expect(runtime.vectorStore).toBe(vectorStore);
    expect(runtime.embeddingProvider).toBeUndefined();
    expect(runtime.providers.vectorStore).toBe(vectorStore);
  });

  it('keeps the package root detached from the node barrel runtime bundle', () => {
    const rootEntry = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf8');

    expect(rootEntry).toContain("from './node/knowledge-runtime'");
    expect(rootEntry).not.toContain("from './node';");
  });
});

describe('knowledge adapter entrypoints', () => {
  it('exports the adapter root entrypoint', async () => {
    const adapters = await import('../src/adapters');

    expect(adapters).toHaveProperty('LangChainChatProvider');
    expect(adapters).toHaveProperty('createMiniMaxChatProvider');
    expect(adapters).toHaveProperty('createOpenAICompatibleEmbeddingProvider');
  });

  it('exports vendor adapter entrypoints', async () => {
    const minimax = await import('../src/adapters/minimax');
    const glm = await import('../src/adapters/glm');
    const deepseek = await import('../src/adapters/deepseek');
    const compatible = await import('../src/adapters/openai-compatible');
    const langchain = await import('../src/adapters/langchain');
    const chroma = await import('../src/adapters/chroma');
    const opensearch = await import('../src/adapters/opensearch');
    const supabase = await import('../src/adapters/supabase');

    expect(minimax).toHaveProperty('createMiniMaxEmbeddingProvider');
    expect(glm).toHaveProperty('createGlmChatProvider');
    expect(deepseek).toHaveProperty('createDeepSeekChatProvider');
    expect(compatible).toHaveProperty('createOpenAICompatibleChatProvider');
    expect(langchain).toHaveProperty('LangChainLoaderAdapter');
    expect(chroma).toHaveProperty('ChromaVectorSearchProvider');
    expect(opensearch).toHaveProperty('OpenSearchKeywordSearchProvider');
    expect(supabase).toHaveProperty('SupabasePgVectorStoreAdapter');
  });
});

describe('knowledge root adapter exports', () => {
  it('exports adapter factories from the root entrypoint for SDK discoverability', async () => {
    const root = await import('../src');

    expect(root).toHaveProperty('createMiniMaxChatProvider');
    expect(root).toHaveProperty('createGlmEmbeddingProvider');
    expect(root).toHaveProperty('createDeepSeekChatProvider');
    expect(root).toHaveProperty('LangChainEmbeddingProvider');
  });
});
