import { describe, expect, it } from 'vitest';

import { SemanticCacheRecord, SemanticCacheRepository } from '@agent/memory';

import { ChatMessage, LlmProvider, ModelInfo } from './llm-provider';
import { ModelRouter } from './model-router';
import { ProviderRegistry } from './provider-registry';
import { RoutedLlmProvider } from './routed-llm-provider';

class StubProvider implements LlmProvider {
  callCount = 0;

  constructor(
    readonly providerId: string,
    readonly displayName: string,
    private readonly models: string[],
    private readonly responseText = 'ok'
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
    return true;
  }

  async generateText(): Promise<string> {
    this.callCount += 1;
    return this.responseText;
  }

  async streamText(_messages: ChatMessage[], _options: never, onToken: (token: string) => void): Promise<string> {
    this.callCount += 1;
    onToken(this.responseText);
    return this.responseText;
  }

  async generateObject<T>(): Promise<T> {
    throw new Error('not implemented');
  }
}

class InMemorySemanticCacheRepository implements SemanticCacheRepository {
  private readonly records = new Map<string, SemanticCacheRecord>();

  async get(key: string): Promise<SemanticCacheRecord | undefined> {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }
    record.hitCount += 1;
    return record;
  }

  async set(record: SemanticCacheRecord): Promise<void> {
    this.records.set(record.key, record);
  }
}

describe('RoutedLlmProvider', () => {
  it('returns cached text for identical prompts', async () => {
    const registry = new ProviderRegistry();
    const provider = new StubProvider('zhipu', 'ZhiPu', ['glm-5'], 'cached-answer');
    registry.register(provider);
    const router = new ModelRouter(registry, {
      manager: {
        primary: 'zhipu/glm-5'
      }
    });
    const cache = new InMemorySemanticCacheRepository();
    const llm = new RoutedLlmProvider(registry, router, cache);

    const messages = [{ role: 'user' as const, content: 'hello' }];
    const first = await llm.generateText(messages, { role: 'manager' });
    const second = await llm.generateText(messages, { role: 'manager' });

    expect(first).toBe('cached-answer');
    expect(second).toBe('cached-answer');
    expect(provider.callCount).toBe(1);
  });
});
