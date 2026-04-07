import { describe, expect, it, vi } from 'vitest';

import { SemanticCacheRecord, SemanticCacheRepository } from '@agent/memory';

import { ChatMessage, LlmProvider, ModelInfo } from '../../../src/adapters/llm/llm-provider';
import { ModelRouter } from '../../../src/adapters/llm/model-router';
import { ProviderRegistry } from '../../../src/adapters/llm/provider-registry';
import { RoutedLlmProvider } from '../../../src/adapters/llm/routed-llm-provider';

class StubProvider implements LlmProvider {
  callCount = 0;
  objectCallCount = 0;
  objectFailures: Error[] = [];
  objectMessages: ChatMessage[][] = [];

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

  async generateObject<T>(messages: ChatMessage[]): Promise<T> {
    this.objectCallCount += 1;
    this.objectMessages.push(messages);
    const nextFailure = this.objectFailures.shift();
    if (nextFailure) {
      throw nextFailure;
    }
    return { ok: true } as T;
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
  it('aggregates supported models and reports whether any provider is configured', () => {
    const registry = new ProviderRegistry();
    const configured = new StubProvider('zhipu', 'ZhiPu', ['glm-5']);
    const unconfigured = new StubProvider('openai', 'OpenAI', ['gpt-4o']);
    vi.spyOn(unconfigured, 'isConfigured').mockReturnValue(false);
    registry.register(configured);
    registry.register(unconfigured);
    const router = new ModelRouter(registry, {
      manager: {
        primary: 'zhipu/glm-5'
      }
    });
    const llm = new RoutedLlmProvider(registry, router);

    expect(llm.isConfigured()).toBe(true);
    expect(llm.supportedModels().map(model => model.id)).toEqual(['glm-5', 'gpt-4o']);
  });

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

  it('streams from semantic cache and writes fresh streaming results back to cache', async () => {
    const registry = new ProviderRegistry();
    const provider = new StubProvider('zhipu', 'ZhiPu', ['glm-5'], 'stream-answer');
    registry.register(provider);
    const router = new ModelRouter(registry, {
      manager: {
        primary: 'zhipu/glm-5'
      }
    });
    const cache = new InMemorySemanticCacheRepository();
    const llm = new RoutedLlmProvider(registry, router, cache);
    const messages = [{ role: 'user' as const, content: 'stream please' }];
    const onToken = vi.fn();

    const first = await llm.streamText(
      messages,
      {
        role: 'manager',
        budgetState: {
          costConsumedUsd: 10,
          costBudgetUsd: 10,
          fallbackModelId: 'glm-5'
        }
      },
      onToken
    );
    const second = await llm.streamText(messages, { role: 'manager' }, onToken);

    expect(first).toBe('stream-answer');
    expect(second).toBe('stream-answer');
    expect(onToken).toHaveBeenCalledWith('stream-answer');
    expect(provider.callCount).toBe(1);
  });

  it('routes generateObject through the resolved provider model', async () => {
    const registry = new ProviderRegistry();
    const provider = new StubProvider('zhipu', 'ZhiPu', ['glm-5'], 'object-answer');
    registry.register(provider);
    const router = new ModelRouter(registry, {
      reviewer: {
        primary: 'zhipu/glm-5'
      }
    });
    const llm = new RoutedLlmProvider(registry, router);

    await expect(
      llm.generateObject([{ role: 'user', content: 'hello' }], {} as any, { role: 'reviewer' })
    ).resolves.toEqual({ ok: true });
    expect(provider.objectCallCount).toBe(1);
  });

  it('retries generateObject with error feedback when structured output is invalid', async () => {
    const registry = new ProviderRegistry();
    const provider = new StubProvider('zhipu', 'ZhiPu', ['glm-5'], 'object-answer');
    provider.objectFailures.push(new Error('JSON parse failed: invalid enum value'));
    registry.register(provider);
    const router = new ModelRouter(registry, {
      reviewer: {
        primary: 'zhipu/glm-5'
      }
    });
    const llm = new RoutedLlmProvider(registry, router);

    await expect(
      llm.generateObject([{ role: 'user', content: 'hello' }], {} as any, { role: 'reviewer' })
    ).resolves.toEqual({ ok: true });

    expect(provider.objectCallCount).toBe(2);
    expect(provider.objectMessages[1]?.at(-1)?.role).toBe('user');
    expect(provider.objectMessages[1]?.at(-1)?.content).toContain('上一次生成失败');
    expect(provider.objectMessages[1]?.at(-1)?.content).toContain('JSON parse failed');
  });
});
