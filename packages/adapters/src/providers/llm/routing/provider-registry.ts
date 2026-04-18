import { LlmProvider, ModelCapability } from '../base/llm-provider.types';

export class ProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();

  register(provider: LlmProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  get(providerId: string): LlmProvider | undefined {
    return this.providers.get(providerId);
  }

  getAll(): LlmProvider[] {
    return Array.from(this.providers.values());
  }

  findByModel(modelId: string): LlmProvider | undefined {
    return this.getAll().find(provider => provider.supportedModels().some(model => model.id === modelId));
  }

  findByCapability(capability: ModelCapability): LlmProvider[] {
    return this.getAll().filter(provider =>
      provider.supportedModels().some(model => model.capabilities.includes(capability))
    );
  }

  getConfiguredProviders(): LlmProvider[] {
    return this.getAll().filter(provider => provider.isConfigured());
  }
}
