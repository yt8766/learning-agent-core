import { describe, expect, it } from 'vitest';

import {
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeProviderError,
  type KnowledgeChatProvider,
  type KnowledgeEmbeddingProvider
} from '../src/core';

describe('knowledge provider contracts', () => {
  it('parses workspace and knowledge base model profile bindings', () => {
    expect(
      KnowledgeModelProfileSchema.parse({
        embedding: {
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'minimax-embedding',
          baseUrl: 'https://api.minimaxi.com/v1',
          dimensions: 1536
        },
        chat: {
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'MiniMax-M2.7',
          baseUrl: 'https://api.minimaxi.com/v1'
        },
        rerank: {
          enabled: false,
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'MiniMax-M2.7'
        }
      })
    ).toMatchObject({
      embedding: { providerId: 'minimax', dimensions: 1536 },
      rerank: { enabled: false }
    });
  });

  it('rejects secret fields and invalid dimensions in model bindings', () => {
    expect(() =>
      KnowledgeModelBindingSchema.parse({
        providerId: 'minimax',
        adapter: 'langchain-chat-openai',
        model: 'MiniMax-M2.7',
        apiKey: 'secret'
      })
    ).toThrow();

    expect(() =>
      KnowledgeModelBindingSchema.parse({
        providerId: 'minimax',
        adapter: 'langchain-chat-openai',
        model: 'MiniMax-M2.7',
        secret: 'secret'
      })
    ).toThrow();

    expect(() =>
      KnowledgeModelBindingSchema.parse({
        providerId: 'minimax',
        adapter: 'langchain-chat-openai',
        model: 'embedding',
        dimensions: 0
      })
    ).toThrow();
  });

  it('allows chat and embedding providers to be implemented without LangChain types', async () => {
    const chat: KnowledgeChatProvider = {
      providerId: 'fake',
      defaultModel: 'fake-chat',
      async generate(input) {
        return {
          text: input.messages.map(message => message.content).join('\n'),
          model: input.model ?? 'fake-chat',
          providerId: 'fake',
          usage: { totalTokens: 3 }
        };
      }
    };

    const embedding: KnowledgeEmbeddingProvider = {
      providerId: 'fake',
      defaultModel: 'fake-embedding',
      dimensions: 3,
      async embedText() {
        return { embedding: [0.1, 0.2, 0.3], model: 'fake-embedding', dimensions: 3 };
      },
      async embedBatch(input) {
        return {
          embeddings: input.texts.map(() => [0.1, 0.2, 0.3]),
          model: 'fake-embedding',
          dimensions: 3
        };
      }
    };

    await expect(chat.generate({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toMatchObject({
      text: 'hello'
    });
    await expect(embedding.embedText({ text: 'hello' })).resolves.toMatchObject({ dimensions: 3 });
  });

  it('projects provider errors through a stable SDK error', () => {
    const error = new KnowledgeProviderError('Provider timeout', {
      providerId: 'minimax',
      code: 'knowledge_provider_timeout',
      retryable: true,
      details: { model: 'MiniMax-M2.7' },
      cause: new Error('socket timeout')
    });

    expect(error).toMatchObject({
      name: 'KnowledgeProviderError',
      category: 'provider',
      code: 'knowledge_provider_timeout',
      retryable: true,
      providerId: 'minimax'
    });
  });
});
