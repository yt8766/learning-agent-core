import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';
import { createOpenAiProviderAdapter } from '../src/providers/openai-provider-adapter.js';

describe('provider adapters', () => {
  it('returns a normalized completion response', async () => {
    const adapter = createMockProviderAdapter({ content: 'hello from mock' });

    const response = await adapter.complete({
      id: 'req_1',
      model: 'gpt-main',
      providerModel: 'mock-model',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false
    });

    expect(response.id).toMatch(/^chatcmpl-/);
    expect(response.model).toBe('gpt-main');
    expect(response.choices[0]?.message.content).toBe('hello from mock');
    expect(response.usage.total_tokens).toBeGreaterThan(0);
  });

  it('streams normalized chunks', async () => {
    const adapter = createMockProviderAdapter({ content: 'hello' });
    const chunks: string[] = [];

    for await (const chunk of adapter.stream({
      id: 'req_2',
      model: 'gpt-main',
      providerModel: 'mock-model',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true
    })) {
      chunks.push(chunk.choices[0]?.delta.content ?? '');
    }

    expect(chunks.join('')).toBe('hello');
  });

  it('fails closed for unimplemented upstream adapters', async () => {
    const adapter = createOpenAiProviderAdapter();

    await expect(
      adapter.complete({
        id: 'req_3',
        model: 'gpt-main',
        providerModel: 'gpt-5',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });
});
