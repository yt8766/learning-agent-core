import type { RuntimeSettings } from '@agent/config';
import type { ILLMProvider } from '@agent/core';

import { LlmProviderFactoryRegistry, registerDefaultLlmProviderFactories, type LlmProviderFactory } from '../llm';
import { ModelRouter, ProviderRegistry, RoutedLlmProvider, type SemanticCacheRepository } from '../../routing/llm';
import { ZhipuLlmProvider } from '../../zhipu/provider';

export interface DefaultRuntimeLlmProviderOptions {
  settings: RuntimeSettings;
  semanticCacheRepository?: SemanticCacheRepository;
  customFactories?: LlmProviderFactory[];
}

export function createDefaultRuntimeLlmProvider(options: DefaultRuntimeLlmProviderOptions): ILLMProvider {
  const providerRegistry = new ProviderRegistry();
  const factoryRegistry = new LlmProviderFactoryRegistry();

  registerDefaultLlmProviderFactories(factoryRegistry);
  for (const factory of options.customFactories ?? []) {
    factoryRegistry.register(factory);
  }

  for (const providerConfig of options.settings.providers) {
    providerRegistry.register(factoryRegistry.create(providerConfig));
  }

  if (!providerRegistry.get('zhipu') && options.settings.zhipuApiKey) {
    providerRegistry.register(new ZhipuLlmProvider(options.settings));
  }

  const modelRouter = new ModelRouter(providerRegistry, options.settings.routing);
  return new RoutedLlmProvider(providerRegistry, modelRouter, options.semanticCacheRepository);
}
