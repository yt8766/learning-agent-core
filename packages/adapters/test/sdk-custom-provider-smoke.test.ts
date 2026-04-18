import { describe, expect, it } from 'vitest';

import { createDefaultRuntimeLlmProvider, createLlmProviderFactory } from '@agent/adapters';
import { CustomHttpProviderFixture } from './fixtures/custom-http-provider.fixture';

type RuntimeProviderSettings = Parameters<typeof createDefaultRuntimeLlmProvider>[0]['settings'];

describe('@agent/adapters sdk custom provider smoke', () => {
  it('supports a custom provider end-to-end through createLlmProviderFactory and runtime routing', async () => {
    const llm = createDefaultRuntimeLlmProvider({
      settings: {
        providers: [
          {
            id: 'custom-http',
            type: 'custom-http',
            displayName: 'Custom HTTP',
            models: ['custom-http-chat'],
            roleModels: {
              manager: 'custom-http-chat'
            }
          }
        ],
        routing: {
          manager: { primary: 'custom-http/custom-http-chat' }
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
          type: 'custom-http',
          create(config) {
            return new CustomHttpProviderFixture(config);
          }
        })
      ]
    });

    await expect(
      llm.generateText([{ role: 'user', content: 'hello custom provider' }], {
        role: 'manager'
      })
    ).resolves.toBe('[custom-http model=custom-http-chat] user:hello custom provider');

    expect(
      llm
        .supportedModels()
        .filter(model => model.providerId === 'custom-http')
        .map(model => model.id)
    ).toEqual(['custom-http-chat']);
  });
});
