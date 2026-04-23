import type { LlmProviderFactory } from './llm-provider-factory.types';

export function createLlmProviderFactory(factory: LlmProviderFactory): LlmProviderFactory {
  return factory;
}
