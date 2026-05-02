import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultKnowledgeSdkRuntime, KnowledgeSdkRuntimeConfigError } from '../src/node';
import { SupabasePgVectorStoreAdapter } from '../src/adapters/supabase';

function supabaseClient() {
  const rpc = vi.fn(async () => ({ data: { upserted_count: 1 }, error: null }));

  return {
    client: { rpc },
    rpc
  };
}

describe('createDefaultKnowledgeSdkRuntime', () => {
  afterEach(() => {
    vi.doUnmock('../src/adapters');
    vi.resetModules();
  });

  it('creates default chat, embedding, and vector store providers from explicit config', () => {
    const supabase = supabaseClient();
    const runtime = createDefaultKnowledgeSdkRuntime({
      chat: { provider: 'openai-compatible', apiKey: 'chat-key', model: 'chat-model', baseURL: 'https://llm.local/v1' },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'embed-key',
        model: 'embed-model',
        baseURL: 'https://embed.local/v1',
        dimensions: 1536
      },
      vectorStore: { client: supabase.client, knowledgeBaseId: 'kb_default' }
    });

    expect(runtime.chatProvider.providerId).toBe('openai-compatible');
    expect(runtime.chatProvider.defaultModel).toBe('chat-model');
    expect(runtime.embeddingProvider.providerId).toBe('openai-compatible');
    expect(runtime.embeddingProvider.defaultModel).toBe('embed-model');
    expect(runtime.embeddingProvider.dimensions).toBe(1536);
    expect(runtime.vectorStore).toBeInstanceOf(SupabasePgVectorStoreAdapter);
    expect(supabase.rpc).not.toHaveBeenCalled();
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

  it('wraps unsupported provider ids in a config error', () => {
    expect(() =>
      createDefaultKnowledgeSdkRuntime({
        chat: {
          provider: 'unsupported' as never,
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
        },
        vectorStore: { client: supabaseClient().client, knowledgeBaseId: 'kb_default' }
      })
    ).toThrow(KnowledgeSdkRuntimeConfigError);
  });

  it('wraps provider construction failures in a config error', async () => {
    vi.resetModules();
    vi.doMock('../src/adapters', async importOriginal => {
      const actual = await importOriginal<typeof import('../src/adapters')>();

      return {
        ...actual,
        createOpenAICompatibleChatProvider: () => {
          throw new Error('vendor constructor failed');
        }
      };
    });

    const { createDefaultKnowledgeSdkRuntime: createRuntime, KnowledgeSdkRuntimeConfigError: ConfigError } =
      await import('../src/node/knowledge-sdk-runtime');

    expect(() =>
      createRuntime({
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
        },
        vectorStore: { client: supabaseClient().client, knowledgeBaseId: 'kb_default' }
      })
    ).toThrow(ConfigError);
  });

  it('wraps vector store construction failures in a config error', async () => {
    vi.resetModules();
    vi.doMock('../src/adapters', async importOriginal => {
      const actual = await importOriginal<typeof import('../src/adapters')>();

      return {
        ...actual,
        SupabasePgVectorStoreAdapter: class {
          constructor() {
            throw new Error('vector store constructor failed');
          }
        }
      };
    });

    const { createDefaultKnowledgeSdkRuntime: createRuntime, KnowledgeSdkRuntimeConfigError: ConfigError } =
      await import('../src/node/knowledge-sdk-runtime');

    expect(() =>
      createRuntime({
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
        },
        vectorStore: { client: supabaseClient().client, knowledgeBaseId: 'kb_default' }
      })
    ).toThrow(ConfigError);
  });

  it('does not expose the default SDK runtime from the package root', async () => {
    const rootExports = await import('../src/index');

    expect('createDefaultKnowledgeSdkRuntime' in rootExports).toBe(false);
    expect('KnowledgeSdkRuntimeConfigError' in rootExports).toBe(false);
  });
});
