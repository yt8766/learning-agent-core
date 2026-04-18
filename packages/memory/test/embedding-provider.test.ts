import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOpenAIEmbeddingModelMock = vi.fn();
const createRuntimeEmbeddingProviderMock = vi.fn();

vi.mock('@agent/adapters', () => ({
  createOpenAIEmbeddingModel: (...args: unknown[]) => createOpenAIEmbeddingModelMock(...args),
  createRuntimeEmbeddingProvider: (...args: unknown[]) => createRuntimeEmbeddingProviderMock(...args)
}));

import { createHttpEmbeddingProvider, HttpEmbeddingProvider } from '@agent/memory';

describe('HttpEmbeddingProvider', () => {
  beforeEach(() => {
    createOpenAIEmbeddingModelMock.mockReset();
    createRuntimeEmbeddingProviderMock.mockReset();
  });

  it('delegates embedding model creation to @agent/adapters', async () => {
    const delegated = {
      embedQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
      embedDocuments: vi.fn(async () => [[0.1, 0.2, 0.3]])
    };
    createOpenAIEmbeddingModelMock.mockReturnValue(delegated);

    const provider = new HttpEmbeddingProvider({
      endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
      model: 'Embedding-3',
      dimensions: 1024,
      apiKey: 'test-key',
      batchSize: 8
    });

    await expect(provider.embedQuery('multi agent')).resolves.toEqual([0.1, 0.2, 0.3]);
    await expect(provider.embedDocuments(['multi agent'])).resolves.toEqual([[0.1, 0.2, 0.3]]);
    expect(createOpenAIEmbeddingModelMock).toHaveBeenCalledWith({
      model: 'Embedding-3',
      apiKey: 'test-key',
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
      dimensions: 1024,
      batchSize: 8
    });
  });

  it('creates providers from runtime-like settings through @agent/adapters', () => {
    const delegated = {
      embedQuery: vi.fn(),
      embedDocuments: vi.fn()
    };
    createRuntimeEmbeddingProviderMock.mockReturnValue(delegated);

    const provider = createHttpEmbeddingProvider({
      embeddings: {
        endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
        model: 'Embedding-3',
        dimensions: 1024,
        apiKey: 'embedding-key'
      },
      zhipuApiKey: 'zhipu-key',
      mcp: {
        bigmodelApiKey: 'mcp-key'
      }
    });

    expect(provider).toBe(delegated);
    expect(createRuntimeEmbeddingProviderMock).toHaveBeenCalledWith({
      embeddings: {
        endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
        model: 'Embedding-3',
        dimensions: 1024,
        apiKey: 'embedding-key'
      },
      zhipuApiKey: 'zhipu-key',
      mcp: {
        bigmodelApiKey: 'mcp-key'
      }
    });
  });
});
