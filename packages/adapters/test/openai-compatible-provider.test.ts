import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAICompatibleProvider } from '@agent/adapters';

const createChatOpenAIModelMock = vi.fn();

vi.mock('../src/openai-compatible/chat/chat-openai-model.factory', () => ({
  createChatOpenAIModel: (options: unknown) => createChatOpenAIModelMock(options)
}));

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    createChatOpenAIModelMock.mockReset();
  });

  it('maps explicit Zhipu thinking false to the provider disable setting', async () => {
    createChatOpenAIModelMock.mockReturnValue({
      stream: vi.fn(async function* () {
        yield {
          content: '联调成功',
          response_metadata: { model_name: 'glm-4.6' }
        };
      })
    });

    const provider = OpenAICompatibleProvider.fromConfig({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: 'zhipu-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      models: ['glm-4.6'],
      roleModels: {
        manager: 'glm-4.6'
      }
    });

    await expect(
      provider.streamText([{ role: 'user', content: '你好' }], { role: 'manager', thinking: false }, () => undefined)
    ).resolves.toBe('联调成功');

    expect(createChatOpenAIModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'glm-4.6',
        thinking: undefined,
        modelKwargs: {
          thinking: {
            type: 'disabled'
          }
        }
      })
    );
  });
});
