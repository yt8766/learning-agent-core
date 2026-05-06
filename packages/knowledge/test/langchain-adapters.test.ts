import { describe, expect, it } from 'vitest';

import { LangChainChatProvider, LangChainEmbeddingProvider } from '../src/adapters/langchain';
import { KnowledgeProviderError } from '../src/core';

describe('LangChain knowledge adapters', () => {
  it('maps LangChain chat invoke results into KnowledgeChatGenerateResult', async () => {
    const provider = new LangChainChatProvider({
      providerId: 'minimax',
      defaultModel: 'MiniMax-M2.7',
      model: {
        async invoke(messages: unknown[]) {
          return {
            content: `answer:${messages.length}`,
            response_metadata: {
              tokenUsage: {
                promptTokens: 10,
                completionTokens: 4,
                totalTokens: 14
              }
            }
          };
        }
      }
    });

    await expect(
      provider.generate({
        messages: [
          { role: 'system', content: 'answer with citations' },
          { role: 'user', content: 'hello' }
        ],
        model: 'MiniMax-M2.7'
      })
    ).resolves.toEqual({
      text: 'answer:2',
      providerId: 'minimax',
      model: 'MiniMax-M2.7',
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14
      }
    });
  });

  it('converts LangChain chat errors to KnowledgeProviderError', async () => {
    const provider = new LangChainChatProvider({
      providerId: 'minimax',
      defaultModel: 'MiniMax-M2.7',
      model: {
        async invoke() {
          throw new Error('upstream timeout');
        }
      }
    });

    await expect(provider.generate({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toMatchObject({
      name: 'KnowledgeProviderError',
      providerId: 'minimax',
      code: 'knowledge_provider_call_failed'
    });
  });

  it('maps LangChain embeddings into KnowledgeEmbeddingProvider results', async () => {
    const provider = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery(text: string) {
          return [text.length, 0, 1];
        },
        async embedDocuments(texts: string[]) {
          return texts.map(text => [text.length, 0, 1]);
        }
      }
    });

    await expect(provider.embedText({ text: 'abcd' })).resolves.toEqual({
      embedding: [4, 0, 1],
      model: 'embedding',
      dimensions: 3
    });
    await expect(provider.embedBatch({ texts: ['a', 'ab'] })).resolves.toEqual({
      embeddings: [
        [1, 0, 1],
        [2, 0, 1]
      ],
      model: 'embedding',
      dimensions: 3
    });
  });

  it('rejects embedding count and dimension mismatches', async () => {
    const countMismatch = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery() {
          return [1, 2, 3];
        },
        async embedDocuments() {
          return [[1, 2, 3]];
        }
      }
    });

    await expect(countMismatch.embedBatch({ texts: ['a', 'b'] })).rejects.toMatchObject({
      name: 'KnowledgeProviderError',
      code: 'knowledge_embedding_count_mismatch'
    });

    const dimensionMismatch = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery() {
          return [1, 2];
        },
        async embedDocuments(texts: string[]) {
          return texts.map(() => [1, 2]);
        }
      }
    });

    await expect(dimensionMismatch.embedText({ text: 'a' })).rejects.toMatchObject({
      code: 'knowledge_embedding_dimensions_mismatch'
    });
  });

  it('does not expose a placeholder dimension when embedding dimensions are unknown', async () => {
    const provider = new LangChainEmbeddingProvider({
      providerId: 'custom',
      defaultModel: 'embedding',
      embeddings: {
        async embedQuery() {
          return [1, 2];
        },
        async embedDocuments(texts: string[]) {
          return texts.map(() => [1, 2]);
        }
      }
    });

    expect(provider.dimensions).toBeUndefined();
    await expect(provider.embedText({ text: 'a' })).resolves.toEqual({
      embedding: [1, 2],
      model: 'embedding'
    });
  });
});
