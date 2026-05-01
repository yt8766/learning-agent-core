import { describe, expect, it } from 'vitest';

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

    expect(minimax).toHaveProperty('createMiniMaxEmbeddingProvider');
    expect(glm).toHaveProperty('createGlmChatProvider');
    expect(deepseek).toHaveProperty('createDeepSeekChatProvider');
    expect(compatible).toHaveProperty('createOpenAICompatibleChatProvider');
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
