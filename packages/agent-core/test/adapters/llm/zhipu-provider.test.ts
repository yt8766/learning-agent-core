import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

const loadSettingsMock = vi.fn();
const fromConfigMock = vi.fn();
const supportedModelsMock = vi.fn(() => [
  {
    id: 'glm-4.5',
    displayName: 'glm-4.5',
    providerId: 'zhipu',
    contextWindow: 128_000,
    maxOutput: 8192,
    capabilities: ['text', 'tool-call']
  }
]);
const isConfiguredMock = vi.fn(() => true);
const generateTextMock = vi.fn(async () => 'generated');
const streamTextMock = vi.fn(async () => 'streamed');
const generateObjectMock = vi.fn(async () => ({ ok: true }));

vi.mock('@agent/config', () => ({
  loadSettings: () => loadSettingsMock()
}));

vi.mock('../../../src/adapters/llm/openai-compatible-provider', () => ({
  OpenAICompatibleProvider: {
    fromConfig: (...args: unknown[]) => fromConfigMock(...args)
  }
}));

import { ZhipuLlmProvider } from '../../../src/adapters/llm/zhipu-provider';

describe('ZhipuLlmProvider', () => {
  beforeEach(() => {
    loadSettingsMock.mockReset();
    fromConfigMock.mockReset();
    supportedModelsMock.mockClear();
    isConfiguredMock.mockClear();
    generateTextMock.mockClear();
    streamTextMock.mockClear();
    generateObjectMock.mockClear();

    loadSettingsMock.mockReturnValue({
      zhipuApiKey: 'zhipu-key',
      zhipuApiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      zhipuModels: {
        manager: 'glm-4.5',
        research: 'glm-4.5-air',
        executor: 'glm-4.5',
        reviewer: 'glm-4.5-flash'
      }
    });

    fromConfigMock.mockReturnValue({
      supportedModels: supportedModelsMock,
      isConfigured: isConfiguredMock,
      generateText: generateTextMock,
      streamText: streamTextMock,
      generateObject: generateObjectMock
    });
  });

  it('builds the openai-compatible delegate from zhipu settings', () => {
    const provider = new ZhipuLlmProvider();

    expect(provider.providerId).toBe('zhipu');
    expect(provider.displayName).toBe('ZhiPu');
    expect(fromConfigMock).toHaveBeenCalledWith({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: 'zhipu-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4.5', 'glm-4.5-air', 'glm-4.5-flash'],
      roleModels: {
        manager: 'glm-4.5',
        research: 'glm-4.5-air',
        executor: 'glm-4.5',
        reviewer: 'glm-4.5-flash'
      }
    });
  });

  it('delegates model discovery and configuration checks', () => {
    const provider = new ZhipuLlmProvider();

    expect(provider.supportedModels()).toEqual(supportedModelsMock.mock.results[0]?.value);
    expect(provider.isConfigured()).toBe(true);
    expect(supportedModelsMock).toHaveBeenCalledTimes(1);
    expect(isConfiguredMock).toHaveBeenCalledTimes(1);
  });

  it('delegates text, stream, and object generation to the underlying provider', async () => {
    const provider = new ZhipuLlmProvider();
    const messages = [{ role: 'user' as const, content: 'hello' }];
    const options = { role: 'manager' as const, modelId: 'glm-4.5' };
    const onToken = vi.fn();
    const schema = z.object({ ok: z.boolean() });

    await expect(provider.generateText(messages, options)).resolves.toBe('generated');
    await expect(provider.streamText(messages, options, onToken)).resolves.toBe('streamed');
    await expect(provider.generateObject(messages, schema, options)).resolves.toEqual({ ok: true });

    expect(generateTextMock).toHaveBeenCalledWith(messages, options);
    expect(streamTextMock).toHaveBeenCalledWith(messages, options, onToken);
    expect(generateObjectMock).toHaveBeenCalledWith(messages, schema, options);
  });
});
