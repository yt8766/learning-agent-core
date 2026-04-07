import { describe, expect, it } from 'vitest';

import { LlmProvider, ModelInfo } from '../../../src/adapters/llm/llm-provider';
import { ProviderRegistry } from '../../../src/adapters/llm/provider-registry';

class StubProvider implements LlmProvider {
  constructor(
    readonly providerId: string,
    readonly displayName: string,
    private readonly models: Array<{ id: string; capabilities: Array<'text' | 'vision' | 'tool-call'> }>,
    private readonly configured = true
  ) {}

  supportedModels(): ModelInfo[] {
    return this.models.map(model => ({
      id: model.id,
      displayName: model.id,
      providerId: this.providerId,
      contextWindow: 128_000,
      maxOutput: 8_192,
      capabilities: model.capabilities
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

describe('ProviderRegistry', () => {
  it('registers providers and resolves them by id, model, capability, and configured state', () => {
    const registry = new ProviderRegistry();
    const openai = new StubProvider(
      'openai',
      'OpenAI',
      [
        { id: 'gpt-5.4', capabilities: ['text', 'tool-call'] },
        { id: 'gpt-4.1-vision', capabilities: ['text', 'vision'] }
      ],
      true
    );
    const zhipu = new StubProvider('zhipu', 'ZhiPu', [{ id: 'glm-4.5', capabilities: ['text'] }], false);

    registry.register(openai);
    registry.register(zhipu);

    expect(registry.get('openai')).toBe(openai);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.getAll()).toEqual([openai, zhipu]);
    expect(registry.findByModel('gpt-4.1-vision')).toBe(openai);
    expect(registry.findByModel('missing-model')).toBeUndefined();
    expect(registry.findByCapability('vision')).toEqual([openai]);
    expect(registry.findByCapability('tool-call')).toEqual([openai]);
    expect(registry.findByCapability('audio')).toEqual([]);
    expect(registry.getConfiguredProviders()).toEqual([openai]);
  });
});
