import { createUnavailableProviderAdapter } from './provider-adapter';

export function createMiniMaxProviderAdapter() {
  return createUnavailableProviderAdapter('minimax');
}
