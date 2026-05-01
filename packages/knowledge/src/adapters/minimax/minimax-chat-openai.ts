import { createChatOpenAIProvider } from '../langchain/chat';

export interface MiniMaxChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createMiniMaxChatProvider(options: MiniMaxChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'minimax',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.minimaxi.com/v1',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
