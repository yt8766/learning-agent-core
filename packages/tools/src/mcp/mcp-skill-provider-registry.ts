import type { McpSkillProviderAdapter } from './mcp-skill-provider-types';

export class McpSkillProviderRegistry {
  private readonly providers = new Map<string, McpSkillProviderAdapter>();

  register(provider: McpSkillProviderAdapter): void {
    this.providers.set(provider.descriptor.id, provider);
  }

  get(providerId: string): McpSkillProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  list(): McpSkillProviderAdapter[] {
    return Array.from(this.providers.values());
  }
}
