import { describe, expect, it } from 'vitest';

import { createProviderAdapterRegistry } from '../src/providers/provider-adapter-registry.js';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';

describe('provider adapter registry', () => {
  it('creates adapters from registered provider factories', async () => {
    const registry = createProviderAdapterRegistry({
      mock: () => createMockProviderAdapter({ content: 'ok' })
    });

    const adapter = registry.create('mock', {
      providerId: 'mock',
      baseUrl: 'https://mock.local',
      apiKey: 'secret',
      timeoutMs: 1000
    });

    expect(adapter.id).toBe('mock');
    await expect(
      adapter.complete({
        id: 'req_1',
        model: 'gpt-main',
        providerModel: 'mock-model',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).resolves.toMatchObject({
      model: 'gpt-main'
    });
  });

  it('fails closed for unknown providers', () => {
    const registry = createProviderAdapterRegistry({});

    expect(() =>
      registry.create('unknown', {
        providerId: 'unknown',
        baseUrl: 'https://unknown.local',
        apiKey: 'secret',
        timeoutMs: 1000
      })
    ).toThrow(/not configured/i);
  });
});
