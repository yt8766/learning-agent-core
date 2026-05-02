import { describe, expect, it } from 'vitest';

import { createDefaultKnowledgeSdkRuntime, KnowledgeSdkRuntimeConfigError } from '../src/node';

function supabaseClient() {
  return {
    rpc: async () => ({ data: { upserted_count: 1 }, error: null })
  };
}

describe('createDefaultKnowledgeSdkRuntime', () => {
  it('creates default chat, embedding, and vector store providers from explicit config', () => {
    const runtime = createDefaultKnowledgeSdkRuntime({
      chat: { provider: 'openai-compatible', apiKey: 'chat-key', model: 'chat-model', baseURL: 'https://llm.local/v1' },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'embed-key',
        model: 'embed-model',
        baseURL: 'https://embed.local/v1',
        dimensions: 1536
      },
      vectorStore: { client: supabaseClient(), knowledgeBaseId: 'kb_default' }
    });

    expect(runtime.chatProvider.providerId).toBe('openai-compatible');
    expect(runtime.embeddingProvider.providerId).toBe('openai-compatible');
    expect(runtime.vectorStore).toBeTruthy();
  });

  it('fails fast when vector store client is missing', () => {
    expect(() =>
      createDefaultKnowledgeSdkRuntime({
        chat: {
          provider: 'openai-compatible',
          apiKey: 'chat-key',
          model: 'chat-model',
          baseURL: 'https://llm.local/v1'
        },
        embedding: {
          provider: 'openai-compatible',
          apiKey: 'embed-key',
          model: 'embed-model',
          baseURL: 'https://embed.local/v1',
          dimensions: 1536
        }
      })
    ).toThrow(KnowledgeSdkRuntimeConfigError);
  });
});
