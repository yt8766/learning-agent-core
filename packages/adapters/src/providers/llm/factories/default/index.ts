import type { LlmProviderFactoryRegistry } from '../llm-provider-factory-registry';

import { AnthropicProvider } from '../../anthropic';
import { MiniMaxProvider } from '../../minimax';
import { OpenAICompatibleProvider } from '../../openai-compatible';

export function registerDefaultLlmProviderFactories(registry: LlmProviderFactoryRegistry): void {
  registry.register({
    type: 'openai',
    create: config => OpenAICompatibleProvider.fromConfig(config)
  });
  registry.register({
    type: 'openai-compatible',
    create: config => OpenAICompatibleProvider.fromConfig(config)
  });
  registry.register({
    type: 'ollama',
    create: config => OpenAICompatibleProvider.fromConfig(config)
  });
  registry.register({
    type: 'zhipu',
    create: config => OpenAICompatibleProvider.fromConfig(config)
  });
  registry.register({
    type: 'anthropic',
    create: config => AnthropicProvider.fromConfig(config)
  });
  registry.register({
    type: 'minimax',
    create: config => MiniMaxProvider.fromConfig(config)
  });
}
