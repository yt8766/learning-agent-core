import type { RuntimeSettings } from '@agent/config';
import type { ILLMProvider } from '@agent/core';

import { MiniMaxProvider } from '../llm/minimax-provider';
import { ModelRouter } from '../llm/model-router';
import { OpenAICompatibleProvider } from '../llm/openai-compatible-provider';
import { ProviderRegistry } from '../llm/provider-registry';
import { RoutedLlmProvider } from '../llm/routed-llm-provider';
import type { SemanticCacheRepository } from '../llm/semantic-cache';
import { ZhipuLlmProvider } from '../llm/zhipu-provider';

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
