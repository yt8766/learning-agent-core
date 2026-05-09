import type { GatewayProviderCredentialSet } from '@agent/core';

export function selectGatewayProvider(
  providers: GatewayProviderCredentialSet[],
  model: string,
  preferredProviderId?: string
): GatewayProviderCredentialSet | null {
  const candidates = providers.filter(provider => {
    const providerMatches = preferredProviderId ? provider.id === preferredProviderId : true;
    return providerMatches && provider.status === 'healthy' && provider.modelFamilies.includes(model);
  });

  return candidates.sort((a, b) => a.priority - b.priority)[0] ?? null;
}
