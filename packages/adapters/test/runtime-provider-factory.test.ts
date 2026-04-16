import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultRuntimeLlmProvider, MiniMaxProvider, OpenAICompatibleProvider } from '@agent/adapters';

type RuntimeProviderSettings = Parameters<typeof createDefaultRuntimeLlmProvider>[0]['settings'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('@agent/adapters runtime provider factory', () => {
  it('registers MiniMax through the dedicated provider adapter', () => {
    const minimaxSpy = vi.spyOn(MiniMaxProvider, 'fromConfig');
    const openAiCompatibleSpy = vi.spyOn(OpenAICompatibleProvider, 'fromConfig');

    createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'minimax',
            type: 'minimax',
            displayName: 'MiniMax',
            apiKey: 'minimax-key',
            baseUrl: 'https://api.minimaxi.com/v1',
            models: ['MiniMax-M2.7', 'MiniMax-M2.5'],
            roleModels: {
              manager: 'MiniMax-M2.7',
              research: 'MiniMax-M2.5',
              executor: 'MiniMax-M2.5',
              reviewer: 'MiniMax-M2.7'
            }
          }
        ],
        routing: {
          manager: { primary: 'minimax/MiniMax-M2.7' }
        },
        zhipuApiKey: '',
        zhipuApiBaseUrl: '',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-5.1',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        zhipuThinking: {
          manager: true,
          research: false,
          executor: false,
          reviewer: true
        }
      } as unknown as RuntimeProviderSettings
    });

    expect(minimaxSpy).toHaveBeenCalledTimes(1);
    expect(minimaxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'minimax',
        type: 'minimax'
      })
    );
    expect(openAiCompatibleSpy).not.toHaveBeenCalled();
  });

  it('registers MiniMax as a dedicated provider and preserves role routing', () => {
    const provider = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'minimax',
            type: 'minimax',
            displayName: 'MiniMax',
            apiKey: 'minimax-key',
            baseUrl: 'https://api.minimaxi.com/v1',
            models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'M2-her'],
            roleModels: {
              manager: 'MiniMax-M2.7',
              research: 'MiniMax-M2.5',
              executor: 'MiniMax-M2.5-highspeed',
              reviewer: 'MiniMax-M2.7-highspeed'
            }
          }
        ],
        routing: {
          manager: { primary: 'minimax/MiniMax-M2.7' },
          research: { primary: 'minimax/MiniMax-M2.5' },
          executor: { primary: 'minimax/MiniMax-M2.5-highspeed' },
          reviewer: { primary: 'minimax/MiniMax-M2.7-highspeed' }
        },
        zhipuApiKey: '',
        zhipuApiBaseUrl: '',
        zhipuModels: {
          manager: 'glm-5',
          research: 'glm-5.1',
          executor: 'glm-4.6',
          reviewer: 'glm-4.7'
        },
        zhipuThinking: {
          manager: true,
          research: false,
          executor: false,
          reviewer: true
        }
      } as unknown as RuntimeProviderSettings
    });

    expect(provider.isConfigured()).toBe(true);
    expect(
      provider
        .supportedModels()
        .filter(model => model.providerId === 'minimax')
        .map(model => model.id)
    ).toEqual(['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'M2-her']);
  });
});
