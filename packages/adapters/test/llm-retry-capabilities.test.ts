import { z } from 'zod/v4';
import { describe, expect, it, vi } from 'vitest';

import {
  MODEL_CAPABILITIES,
  generateObjectWithRetry,
  generateTextWithRetry,
  streamTextWithRetry,
  type GenerateTextOptions,
  type LlmProvider
} from '@agent/adapters';

function createLlmProviderMock(): LlmProvider {
  return {
    providerId: 'mock',
    displayName: 'Mock Provider',
    supportedModels: () => [],
    isConfigured: () => true,
    generateText: vi.fn(async () => 'ok'),
    streamText: vi.fn(async () => 'ok'),
    generateObject: vi.fn(async () => ({ ok: true }))
  };
}

function createOptions(overrides: Partial<GenerateTextOptions> = {}): GenerateTextOptions {
  return {
    role: 'manager',
    thinking: false,
    ...overrides
  };
}

describe('llm retry capability normalization', () => {
  it('adds the baseline text capability when generating text', async () => {
    const llm = createLlmProviderMock();

    await generateTextWithRetry({
      llm,
      messages: [{ role: 'user', content: 'hello' }],
      options: createOptions()
    });

    expect(llm.generateText).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT]
      })
    );
  });

  it('adds thinking capability when thinking mode is enabled', async () => {
    const llm = createLlmProviderMock();

    await streamTextWithRetry({
      llm,
      messages: [{ role: 'user', content: 'think deeply' }],
      options: createOptions({ thinking: true }),
      onToken: vi.fn()
    });

    expect(llm.streamText).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT, MODEL_CAPABILITIES.THINKING]
      }),
      expect.any(Function)
    );
  });

  it('preserves explicit capability requirements without duplicating them', async () => {
    const llm = createLlmProviderMock();

    await generateObjectWithRetry({
      llm,
      messages: [{ role: 'user', content: 'return json' }],
      schema: z.object({ ok: z.boolean() }),
      contractName: 'test-contract',
      contractVersion: '1.0.0',
      options: createOptions({
        thinking: true,
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT, MODEL_CAPABILITIES.TOOL_CALL]
      })
    });

    expect(llm.generateObject).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      expect.objectContaining({
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT, MODEL_CAPABILITIES.THINKING, MODEL_CAPABILITIES.TOOL_CALL]
      })
    );
  });
});
