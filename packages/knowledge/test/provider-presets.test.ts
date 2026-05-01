import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createdChatModels, createdEmbeddings } = vi.hoisted(() => ({
  createdChatModels: [] as unknown[],
  createdEmbeddings: [] as unknown[]
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(options: unknown) {
      createdChatModels.push(options);
    }

    async invoke() {
      return { content: 'ok' };
    }
  },
  OpenAIEmbeddings: class {
    constructor(options: unknown) {
      createdEmbeddings.push(options);
    }

    async embedQuery() {
      return [1, 2, 3];
    }

    async embedDocuments(texts: string[]) {
      return texts.map(() => [1, 2, 3]);
    }
  }
}));

describe('knowledge provider presets', () => {
  beforeEach(() => {
    createdChatModels.length = 0;
    createdEmbeddings.length = 0;
  });

  it('creates MiniMax chat and embedding providers with ChatOpenAI-compatible settings', async () => {
    const { createMiniMaxChatProvider, createMiniMaxEmbeddingProvider } = await import('../src/adapters/minimax');

    const chat = createMiniMaxChatProvider({ apiKey: 'key', model: 'MiniMax-M2.7' });
    const embedding = createMiniMaxEmbeddingProvider({
      apiKey: 'key',
      model: 'minimax-embedding',
      dimensions: 3
    });

    expect(chat).toMatchObject({ providerId: 'minimax', defaultModel: 'MiniMax-M2.7' });
    expect(embedding).toMatchObject({ providerId: 'minimax', defaultModel: 'minimax-embedding', dimensions: 3 });
    expect(createdChatModels[0]).toMatchObject({
      model: 'MiniMax-M2.7',
      apiKey: 'key',
      configuration: { baseURL: 'https://api.minimaxi.com/v1' }
    });
    expect(createdEmbeddings[0]).toMatchObject({
      model: 'minimax-embedding',
      apiKey: 'key',
      dimensions: 3,
      configuration: { baseURL: 'https://api.minimaxi.com/v1' }
    });
  });

  it('creates GLM, DeepSeek, and OpenAI-compatible presets', async () => {
    const { createGlmChatProvider, createGlmEmbeddingProvider } = await import('../src/adapters/glm');
    const { createDeepSeekChatProvider } = await import('../src/adapters/deepseek');
    const { createOpenAICompatibleChatProvider } = await import('../src/adapters/openai-compatible');

    createGlmChatProvider({ apiKey: 'glm-key', model: 'glm-4.6' });
    createGlmEmbeddingProvider({ apiKey: 'glm-key', model: 'embedding-3', dimensions: 3 });
    createDeepSeekChatProvider({ apiKey: 'deepseek-key', model: 'deepseek-chat' });
    createOpenAICompatibleChatProvider({
      providerId: 'custom',
      apiKey: 'custom-key',
      baseUrl: 'https://example.com/v1',
      model: 'custom-chat'
    });

    expect(createdChatModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: 'glm-4.6' }),
        expect.objectContaining({ model: 'deepseek-chat' }),
        expect.objectContaining({ model: 'custom-chat', configuration: { baseURL: 'https://example.com/v1' } })
      ])
    );
    expect(createdEmbeddings).toEqual(expect.arrayContaining([expect.objectContaining({ model: 'embedding-3' })]));
  });
});
