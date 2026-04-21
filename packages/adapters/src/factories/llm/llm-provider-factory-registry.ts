import type { ProviderSettingsRecord } from '@agent/config';

import type { LlmProvider } from '../../contracts/llm/llm-provider.types';
import type { LlmProviderFactory } from './llm-provider-factory.types';

export class LlmProviderFactoryRegistry {
  private readonly factories = new Map<string, LlmProviderFactory>();

  register(factory: LlmProviderFactory): void {
    this.factories.set(factory.type, factory);
  }

  get(type: string): LlmProviderFactory | undefined {
    return this.factories.get(type);
  }

  create(config: ProviderSettingsRecord): LlmProvider {
    const factory = this.get(config.type);
    if (!factory) {
      throw new Error(`No LLM provider factory registered for type ${config.type}`);
    }
    return factory.create(config);
  }
}
