import { createUnavailableProviderAdapter } from './provider-adapter';

export function createOpenAiProviderAdapter() {
  return createUnavailableProviderAdapter('openai');
}
