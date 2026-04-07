import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatOpenAIInstances: any[] = [];
const openAIEmbeddingsInstances: any[] = [];
const loadSettingsMock = vi.fn();

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(public readonly config: Record<string, unknown>) {
      chatOpenAIInstances.push(this);
    }
  },
  OpenAIEmbeddings: class {
    constructor(public readonly config: Record<string, unknown>) {
      openAIEmbeddingsInstances.push(this);
    }

    async embedQuery() {
      return [0.1, 0.2, 0.3];
    }

    async embedDocuments(texts: string[]) {
      return texts.map(() => [0.1, 0.2, 0.3]);
    }
  }
}));

vi.mock('@agent/config', () => ({
  loadSettings: () => loadSettingsMock()
}));

import {
  createChatOpenAIModel,
  createOpenAIEmbeddingModel,
  createRuntimeEmbeddingProvider,
  resolveRuntimeEmbeddingApiKey,
  createZhipuChatModel,
  normalizeEmbeddingBaseUrl,
  normalizeModelBaseUrl
} from '../src';

describe('model package', () => {
  beforeEach(() => {
    chatOpenAIInstances.length = 0;
    openAIEmbeddingsInstances.length = 0;
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({
      zhipuApiKey: 'zhipu-key',
      zhipuApiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      zhipuModels: {
        manager: 'glm-4.5',
        research: 'glm-4.5-air',
        executor: 'glm-4.5',
        reviewer: 'glm-4.5-air'
      },
      zhipuThinking: {
        manager: true,
        research: false,
        executor: true,
        reviewer: false
      }
    });
  });

  it('normalizes model base urls', () => {
    expect(normalizeModelBaseUrl('https://open.bigmodel.cn/api/paas/v4/chat/completions')).toBe(
      'https://open.bigmodel.cn/api/paas/v4'
    );
    expect(normalizeEmbeddingBaseUrl('https://open.bigmodel.cn/api/coding/paas/v4/embeddings')).toBe(
      'https://open.bigmodel.cn/api/coding/paas/v4'
    );
  });

  it('creates chat models through ChatOpenAI', () => {
    const model = createChatOpenAIModel({
      model: 'glm-4.5-air',
      apiKey: 'custom-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      thinking: true,
      temperature: 0.1,
      maxTokens: 512
    });

    expect(model).toBe(chatOpenAIInstances[0]);
    expect(chatOpenAIInstances[0]?.config).toEqual({
      model: 'glm-4.5-air',
      temperature: 0.1,
      maxTokens: 512,
      apiKey: 'custom-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: {
        thinking: {
          type: 'enabled'
        }
      }
    });
  });

  it('creates zhipu chat models from runtime settings', () => {
    const model = createZhipuChatModel('manager');

    expect(model).toBe(chatOpenAIInstances[0]);
    expect(chatOpenAIInstances[0]?.config).toEqual({
      model: 'glm-4.5',
      temperature: 0.2,
      maxTokens: undefined,
      apiKey: 'zhipu-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: {
        thinking: {
          type: 'enabled'
        }
      }
    });
  });

  it('creates embedding models through OpenAIEmbeddings instead of manual fetch', async () => {
    const model = createOpenAIEmbeddingModel({
      model: 'Embedding-3',
      apiKey: 'embed-key',
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
      dimensions: 1024,
      batchSize: 8
    });

    await expect(model.embedDocuments(['multi agent'])).resolves.toEqual([[0.1, 0.2, 0.3]]);
    expect(openAIEmbeddingsInstances[0]?.config).toEqual({
      model: 'Embedding-3',
      dimensions: undefined,
      apiKey: 'embed-key',
      batchSize: 8,
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4'
      }
    });
  });

  it('creates runtime embedding providers from runtime settings', async () => {
    const provider = createRuntimeEmbeddingProvider({
      embeddings: {
        endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
        model: 'Embedding-3',
        dimensions: 1024,
        apiKey: 'embedding-key'
      },
      zhipuApiKey: 'zhipu-key'
    });

    await expect(provider.embedQuery('hello')).resolves.toEqual([0.1, 0.2, 0.3]);
    expect(openAIEmbeddingsInstances[0]?.config).toEqual({
      model: 'Embedding-3',
      dimensions: undefined,
      apiKey: 'embedding-key',
      batchSize: 16,
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4'
      }
    });
  });

  it('prefers dedicated embedding api keys over generic zhipu keys', () => {
    expect(
      resolveRuntimeEmbeddingApiKey({
        embeddings: {
          endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
          model: 'Embedding-3',
          apiKey: 'embedding-key'
        },
        zhipuApiKey: 'zhipu-key',
        mcp: {
          bigmodelApiKey: 'mcp-key'
        }
      })
    ).toBe('embedding-key');

    expect(
      resolveRuntimeEmbeddingApiKey({
        embeddings: {
          endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/embeddings',
          model: 'Embedding-3'
        },
        zhipuApiKey: 'zhipu-key',
        mcp: {
          bigmodelApiKey: 'mcp-key'
        }
      })
    ).toBe('mcp-key');
  });
});
