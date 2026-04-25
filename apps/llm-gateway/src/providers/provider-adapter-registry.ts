import { GatewayError } from '../gateway/errors';
import type { ProviderAdapter } from './provider-adapter';

export interface ProviderRuntimeConfig {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export type ProviderAdapterFactory = (config: ProviderRuntimeConfig) => ProviderAdapter;

export interface ProviderAdapterRegistry {
  create(providerId: string, config: ProviderRuntimeConfig): ProviderAdapter;
}

export function createProviderAdapterRegistry(
  factories: Record<string, ProviderAdapterFactory>
): ProviderAdapterRegistry {
  return {
    create(providerId, config) {
      const factory = factories[providerId];
      if (!factory) {
        throw new GatewayError('UPSTREAM_UNAVAILABLE', `Provider ${providerId} is not configured`, 503);
      }

      return factory(config);
    }
  };
}
