import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatOpenAIInstances: any[] = [];
const loadSettingsMock = vi.fn();

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(public readonly config: Record<string, unknown>) {
      chatOpenAIInstances.push(this);
    }
  }
}));

vi.mock('@agent/config', () => ({
  loadSettings: () => loadSettingsMock()
}));

import { ZhipuChatModelFactory } from '../../../src/adapters/llm/chat-model-factory';

describe('ZhipuChatModelFactory', () => {
  beforeEach(() => {
    chatOpenAIInstances.length = 0;
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({
      zhipuApiKey: 'zhipu-key',
      zhipuApiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      zhipuModels: {
        manager: 'glm-4.5',
        research: 'glm-4.5-air',
        executor: 'glm-4.5',
        reviewer: 'glm-4.5-air'
      },
      zhipuThinking: {
        manager: true,
        research: false,
        executor: true,
        reviewer: false
      }
    });
  });

  it('reports whether zhipu api key is configured', () => {
    const configuredFactory = new ZhipuChatModelFactory();
    expect(configuredFactory.isConfigured()).toBe(true);

    loadSettingsMock.mockReturnValueOnce({
      ...loadSettingsMock.mock.results[0]?.value,
      zhipuApiKey: ''
    });
    const unconfiguredFactory = new ZhipuChatModelFactory();
    expect(unconfiguredFactory.isConfigured()).toBe(false);
  });

  it('creates chat models with normalized base url and optional thinking override', () => {
    const factory = new ZhipuChatModelFactory();

    const managerModel = factory.create('manager');
    const reviewerModel = factory.create('reviewer', {
      temperature: 0.4,
      maxTokens: 800,
      thinking: true
    });

    expect(managerModel).toBe(chatOpenAIInstances[0]);
    expect(chatOpenAIInstances[0]?.config).toEqual({
      model: 'glm-4.5',
      temperature: 0.2,
      maxTokens: undefined,
      apiKey: 'zhipu-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: {
        thinking: {
          type: 'enabled'
        }
      }
    });

    expect(reviewerModel).toBe(chatOpenAIInstances[1]);
    expect(chatOpenAIInstances[1]?.config).toEqual({
      model: 'glm-4.5-air',
      temperature: 0.4,
      maxTokens: 800,
      apiKey: 'zhipu-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: {
        thinking: {
          type: 'enabled'
        }
      }
    });
  });

  it('keeps plain base urls intact and allows thinking to be explicitly disabled', () => {
    loadSettingsMock.mockReturnValueOnce({
      zhipuApiKey: 'zhipu-key',
      zhipuApiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      zhipuModels: {
        manager: 'glm-4.5',
        research: 'glm-4.5-air',
        executor: 'glm-4.5',
        reviewer: 'glm-4.5-air'
      },
      zhipuThinking: {
        manager: true,
        research: true,
        executor: false,
        reviewer: false
      }
    });

    const factory = new ZhipuChatModelFactory();
    const model = factory.create('research', {
      thinking: false
    });

    expect(model).toBe(chatOpenAIInstances[0]);
    expect(chatOpenAIInstances[0]?.config).toEqual({
      model: 'glm-4.5-air',
      temperature: 0.2,
      maxTokens: undefined,
      apiKey: 'zhipu-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: undefined
    });
  });
});
