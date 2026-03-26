import { describe, expect, it } from 'vitest';

import { LlmProvider, ModelInfo } from './llm-provider';
import { ModelRouter } from './model-router';
import { ProviderRegistry } from './provider-registry';

class StubProvider implements LlmProvider {
  constructor(
    readonly providerId: string,
    readonly displayName: string,
    private readonly models: string[],
    private readonly configured = true
  ) {}

  supportedModels(): ModelInfo[] {
    return this.models.map(model => ({
      id: model,
      displayName: model,
      providerId: this.providerId,
      contextWindow: 128_000,
      maxOutput: 8_192,
      capabilities: ['text']
    }));
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async generateText(): Promise<string> {
    return '';
  }

  async streamText(): Promise<string> {
    return '';
  }

  async generateObject<T>(): Promise<T> {
    throw new Error('not implemented');
  }
}

describe('ModelRouter', () => {
  it('prefers explicit primary route when provider is configured', () => {
    const registry = new ProviderRegistry();
    registry.register(new StubProvider('zhipu', 'ZhiPu', ['glm-5']));
    registry.register(new StubProvider('openai', 'OpenAI', ['gpt-4o']));
    const router = new ModelRouter(registry, {
      manager: {
        primary: 'openai/gpt-4o',
        fallback: ['zhipu/glm-5']
      }
    });

    const resolved = router.resolve({ role: 'manager' });

    expect(resolved.provider.providerId).toBe('openai');
    expect(resolved.modelId).toBe('gpt-4o');
  });

  it('falls back when primary provider is unavailable', () => {
    const registry = new ProviderRegistry();
    registry.register(new StubProvider('openai', 'OpenAI', ['gpt-4o'], false));
    registry.register(new StubProvider('zhipu', 'ZhiPu', ['glm-5']));
    const router = new ModelRouter(registry, {
      reviewer: {
        primary: 'openai/gpt-4o',
        fallback: ['zhipu/glm-5']
      }
    });

    const resolved = router.resolve({ role: 'reviewer' });

    expect(resolved.provider.providerId).toBe('zhipu');
    expect(resolved.modelId).toBe('glm-5');
  });

  it('resolves bare preferred model ids against configured providers', () => {
    const registry = new ProviderRegistry();
    registry.register(new StubProvider('zhipu', 'ZhiPu', ['glm-4.6', 'glm-5']));
    registry.register(new StubProvider('openai', 'OpenAI', ['gpt-4o']));
    const router = new ModelRouter(registry, {});

    const resolved = router.resolve({ role: 'executor', preferredModelId: 'glm-4.6' });

    expect(resolved.provider.providerId).toBe('zhipu');
    expect(resolved.modelId).toBe('glm-4.6');
  });

  it('uses fallback model when task is over budget', () => {
    const registry = new ProviderRegistry();
    registry.register(new StubProvider('zhipu', 'ZhiPu', ['glm-5', 'glm-4.7-flash']));
    const router = new ModelRouter(registry, {
      manager: {
        primary: 'zhipu/glm-5'
      }
    });

    const resolved = router.resolve({
      role: 'manager',
      fallbackModelId: 'glm-4.7-flash',
      overBudget: true
    });

    expect(resolved.provider.providerId).toBe('zhipu');
    expect(resolved.modelId).toBe('glm-4.7-flash');
    expect(resolved.reason).toContain('超预算');
  });
});
