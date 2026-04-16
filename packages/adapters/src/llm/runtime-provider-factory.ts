import type { RuntimeSettings } from '@agent/config';
import type { ILLMProvider } from '@agent/core';
import type { SemanticCacheRepository } from '@agent/memory';

import { ModelRouter } from './model-router';
import { MiniMaxProvider } from './minimax-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { ProviderRegistry } from './provider-registry';
import { RoutedLlmProvider } from './routed-llm-provider';
import { ZhipuLlmProvider } from './zhipu-provider';

export interface DefaultRuntimeLlmProviderOptions {
  settings: RuntimeSettings;
  semanticCacheRepository?: SemanticCacheRepository;
}

export function createDefaultRuntimeLlmProvider(options: DefaultRuntimeLlmProviderOptions): ILLMProvider {
  const providerRegistry = new ProviderRegistry();

  for (const providerConfig of options.settings.providers) {
    if (providerConfig.type === 'anthropic') {
      continue;
    }
    providerRegistry.register(
      providerConfig.type === 'minimax'
        ? MiniMaxProvider.fromConfig(providerConfig)
        : OpenAICompatibleProvider.fromConfig(providerConfig)
    );
  }

  if (!providerRegistry.get('zhipu') && options.settings.zhipuApiKey) {
    providerRegistry.register(new ZhipuLlmProvider(options.settings));
  }

  const modelRouter = new ModelRouter(providerRegistry, options.settings.routing);
  return new RoutedLlmProvider(providerRegistry, modelRouter, options.semanticCacheRepository);
}
