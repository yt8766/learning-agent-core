import { createUnavailableProviderAdapter } from './provider-adapter';

export function createMiMoProviderAdapter() {
  return createUnavailableProviderAdapter('mimo');
}
