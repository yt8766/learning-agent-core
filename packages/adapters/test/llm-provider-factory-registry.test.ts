import { describe, expect, it } from 'vitest';

import {
  LlmProviderFactoryRegistry,
  createLlmProviderFactory,
  type LlmProviderFactory,
  type LlmProvider
} from '@agent/adapters';

describe('@agent/adapters llm provider factory registry', () => {
  it('creates providers through the registered factory for the matching type', () => {
    const registry = new LlmProviderFactoryRegistry();
    const provider = {
      providerId: 'custom',
      displayName: 'Custom',
      supportedModels: () => [],
      isConfigured: () => true,
      generateText: async () => 'ok',
      streamText: async () => 'ok',
      generateObject: async () => ({ ok: true })
    } satisfies LlmProvider;

    registry.register({
      type: 'custom',
      create: () => provider
    } satisfies LlmProviderFactory);

    expect(
      registry.create({
        id: 'custom',
        type: 'custom',
        models: ['custom-model']
      })
    ).toBe(provider);
  });

  it('replaces a previously registered factory for the same type', () => {
    const registry = new LlmProviderFactoryRegistry();
    const firstProvider = {
      providerId: 'custom-first',
      displayName: 'Custom First',
      supportedModels: () => [],
      isConfigured: () => true,
      generateText: async () => 'first',
      streamText: async () => 'first',
      generateObject: async () => ({ from: 'first' })
    } satisfies LlmProvider;
    const secondProvider = {
      providerId: 'custom-second',
      displayName: 'Custom Second',
      supportedModels: () => [],
      isConfigured: () => true,
      generateText: async () => 'second',
      streamText: async () => 'second',
      generateObject: async () => ({ from: 'second' })
    } satisfies LlmProvider;

    registry.register({
      type: 'custom',
      create: () => firstProvider
    } satisfies LlmProviderFactory);
    registry.register({
      type: 'custom',
      create: () => secondProvider
    } satisfies LlmProviderFactory);

    expect(
      registry.create({
        id: 'custom',
        type: 'custom',
        models: ['custom-model']
      })
    ).toBe(secondProvider);
  });

  it('throws a clear error when no factory is registered for the provider type', () => {
    const registry = new LlmProviderFactoryRegistry();

    expect(() =>
      registry.create({
        id: 'anthropic',
        type: 'anthropic',
        models: ['claude-sonnet']
      })
    ).toThrow('No LLM provider factory registered for type anthropic');
  });

  it('provides a public helper for creating provider factories without relying on object literal typing', () => {
    const provider = {
      providerId: 'custom',
      displayName: 'Custom',
      supportedModels: () => [],
      isConfigured: () => true,
      generateText: async () => 'ok',
      streamText: async () => 'ok',
      generateObject: async () => ({ ok: true })
    } satisfies LlmProvider;

    const factory = createLlmProviderFactory({
      type: 'custom',
      create: () => provider
    });

    expect(factory).toEqual({
      type: 'custom',
      create: expect.any(Function)
    });
    expect(
      factory.create({
        id: 'custom',
        type: 'custom',
        models: ['custom-model']
      })
    ).toBe(provider);
  });
});
