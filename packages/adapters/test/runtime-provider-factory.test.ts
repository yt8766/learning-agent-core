import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnthropicProvider,
  MODEL_CAPABILITIES,
  createLlmProviderFactory,
  createModelCapabilities,
  createDefaultRuntimeLlmProvider,
  MiniMaxProvider,
  OpenAICompatibleProvider,
  type LlmProviderFactory
} from '@agent/adapters';

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

  it('registers Anthropic through the dedicated provider adapter', () => {
    const anthropicSpy = vi.spyOn(AnthropicProvider, 'fromConfig');
    const openAiCompatibleSpy = vi.spyOn(OpenAICompatibleProvider, 'fromConfig');

    createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'anthropic',
            type: 'anthropic',
            displayName: 'Anthropic',
            apiKey: 'anthropic-key',
            models: ['claude-3-7-sonnet'],
            roleModels: {
              manager: 'claude-3-7-sonnet'
            }
          }
        ],
        routing: {
          manager: { primary: 'anthropic/claude-3-7-sonnet' }
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

    expect(anthropicSpy).toHaveBeenCalledTimes(1);
    expect(anthropicSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anthropic',
        type: 'anthropic'
      })
    );
    expect(openAiCompatibleSpy).not.toHaveBeenCalled();
  });

  it('accepts custom factories so SDK consumers can register provider implementations without patching runtime internals', () => {
    const create = vi.fn(config => ({
      providerId: config.id,
      displayName: 'Anthropic',
      supportedModels: () => [
        {
          id: 'claude-3-7-sonnet',
          displayName: 'claude-3-7-sonnet',
          providerId: config.id,
          contextWindow: 200_000,
          maxOutput: 8_192,
          capabilities: createModelCapabilities('text', 'tool-call')
        }
      ],
      isConfigured: () => true,
      generateText: vi.fn(async () => 'anthropic'),
      streamText: vi.fn(async () => 'anthropic'),
      generateObject: vi.fn(async () => ({ ok: true }))
    }));

    const provider = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'anthropic',
            type: 'anthropic',
            displayName: 'Anthropic',
            apiKey: 'anthropic-key',
            models: ['claude-3-7-sonnet'],
            roleModels: {
              manager: 'claude-3-7-sonnet'
            }
          }
        ],
        routing: {
          manager: { primary: 'anthropic/claude-3-7-sonnet' }
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
      } as unknown as RuntimeProviderSettings,
      customFactories: [
        {
          type: 'anthropic',
          create
        } satisfies LlmProviderFactory
      ]
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anthropic',
        type: 'anthropic'
      })
    );
    expect(
      provider
        .supportedModels()
        .filter(model => model.providerId === 'anthropic')
        .map(model => model.id)
    ).toEqual(['claude-3-7-sonnet']);
  });

  it('routes around models that do not satisfy required capabilities', async () => {
    const llm = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'text-only',
            type: 'text-only',
            displayName: 'Text Only',
            models: ['text-basic'],
            roleModels: {
              manager: 'text-basic'
            }
          },
          {
            id: 'tool-ready',
            type: 'tool-ready',
            displayName: 'Tool Ready',
            models: ['tool-pro'],
            roleModels: {
              manager: 'tool-pro'
            }
          }
        ],
        routing: {
          manager: {
            primary: 'text-only/text-basic',
            fallback: ['tool-ready/tool-pro']
          }
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
      } as unknown as RuntimeProviderSettings,
      customFactories: [
        createLlmProviderFactory({
          type: 'text-only',
          create: config => ({
            providerId: config.id,
            displayName: config.displayName ?? config.id,
            supportedModels: () => [
              {
                id: 'text-basic',
                displayName: 'text-basic',
                providerId: config.id,
                contextWindow: 32_000,
                maxOutput: 4_096,
                capabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT)
              }
            ],
            isConfigured: () => true,
            generateText: async (_messages, options) => `provider=${config.id};model=${options.modelId}`,
            streamText: async (_messages, options, onToken) => {
              const text = `provider=${config.id};model=${options.modelId}`;
              onToken(text, { model: options.modelId });
              return text;
            },
            generateObject: async () => ({ ok: true })
          })
        }),
        createLlmProviderFactory({
          type: 'tool-ready',
          create: config => ({
            providerId: config.id,
            displayName: config.displayName ?? config.id,
            supportedModels: () => [
              {
                id: 'tool-pro',
                displayName: 'tool-pro',
                providerId: config.id,
                contextWindow: 32_000,
                maxOutput: 4_096,
                capabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT, MODEL_CAPABILITIES.TOOL_CALL)
              }
            ],
            isConfigured: () => true,
            generateText: async (_messages, options) => `provider=${config.id};model=${options.modelId}`,
            streamText: async (_messages, options, onToken) => {
              const text = `provider=${config.id};model=${options.modelId}`;
              onToken(text, { model: options.modelId });
              return text;
            },
            generateObject: async () => ({ ok: true })
          })
        })
      ]
    });

    await expect(
      llm.generateText([{ role: 'user', content: 'use tools' }], {
        role: 'manager',
        requiredCapabilities: createModelCapabilities(MODEL_CAPABILITIES.TOOL_CALL)
      })
    ).resolves.toBe('provider=tool-ready;model=tool-pro');
  });

  it('enforces baseline text capability even when callers do not pass requiredCapabilities explicitly', async () => {
    const llm = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'non-text',
            type: 'non-text',
            displayName: 'Non Text',
            models: ['embed-only'],
            roleModels: {
              manager: 'embed-only'
            }
          },
          {
            id: 'text-ready',
            type: 'text-ready',
            displayName: 'Text Ready',
            models: ['text-chat'],
            roleModels: {
              manager: 'text-chat'
            }
          }
        ],
        routing: {
          manager: {
            primary: 'non-text/embed-only',
            fallback: ['text-ready/text-chat']
          }
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
      } as unknown as RuntimeProviderSettings,
      customFactories: [
        createLlmProviderFactory({
          type: 'non-text',
          create: config => ({
            providerId: config.id,
            displayName: config.displayName ?? config.id,
            supportedModels: () => [
              {
                id: 'embed-only',
                displayName: 'embed-only',
                providerId: config.id,
                contextWindow: 8_000,
                maxOutput: 0,
                capabilities: createModelCapabilities(MODEL_CAPABILITIES.EMBEDDING)
              }
            ],
            isConfigured: () => true,
            generateText: async () => 'should-not-be-used',
            streamText: async () => 'should-not-be-used',
            generateObject: async () => ({ ok: true })
          })
        }),
        createLlmProviderFactory({
          type: 'text-ready',
          create: config => ({
            providerId: config.id,
            displayName: config.displayName ?? config.id,
            supportedModels: () => [
              {
                id: 'text-chat',
                displayName: 'text-chat',
                providerId: config.id,
                contextWindow: 8_000,
                maxOutput: 2_048,
                capabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT)
              }
            ],
            isConfigured: () => true,
            generateText: async (_messages, options) => `provider=${config.id};model=${options.modelId}`,
            streamText: async (_messages, options, onToken) => {
              const text = `provider=${config.id};model=${options.modelId}`;
              onToken(text, { model: options.modelId });
              return text;
            },
            generateObject: async () => ({ ok: true })
          })
        })
      ]
    });

    await expect(
      llm.generateText([{ role: 'user', content: 'plain text request' }], {
        role: 'manager'
      })
    ).resolves.toBe('provider=text-ready;model=text-chat');
  });

  it('ignores empty semantic cache entries and does not persist empty provider output', async () => {
    const cacheSet = vi.fn();
    const providerStreamText = vi.fn(async (_messages, _options, onToken) => {
      onToken('fresh output');
      return 'fresh output';
    });
    const llm = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'text-ready',
            type: 'text-ready',
            displayName: 'Text Ready',
            models: ['text-chat'],
            roleModels: {
              manager: 'text-chat'
            }
          }
        ],
        routing: {
          manager: { primary: 'text-ready/text-chat' }
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
      } as unknown as RuntimeProviderSettings,
      semanticCacheRepository: {
        get: vi.fn(async () => ({
          id: 'cache-empty',
          key: 'cache-key',
          role: 'manager',
          modelId: 'text-ready/text-chat',
          responseText: '',
          promptFingerprint: 'cache-key',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          hitCount: 1
        })),
        set: cacheSet
      },
      customFactories: [
        createLlmProviderFactory({
          type: 'text-ready',
          create: config => ({
            providerId: config.id,
            displayName: config.displayName ?? config.id,
            supportedModels: () => [
              {
                id: 'text-chat',
                displayName: 'text-chat',
                providerId: config.id,
                contextWindow: 8_000,
                maxOutput: 2_048,
                capabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT)
              }
            ],
            isConfigured: () => true,
            generateText: async () => '',
            streamText: providerStreamText,
            generateObject: async () => ({ ok: true })
          })
        })
      ]
    });

    const onToken = vi.fn();

    await expect(llm.streamText([{ role: 'user', content: 'hello' }], { role: 'manager' }, onToken)).resolves.toBe(
      'fresh output'
    );

    expect(providerStreamText).toHaveBeenCalledTimes(1);
    expect(onToken.mock.calls).toEqual([['fresh output']]);
    expect(cacheSet).toHaveBeenCalledWith(expect.objectContaining({ responseText: 'fresh output' }));
  });
});
