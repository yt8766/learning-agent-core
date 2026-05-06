import { createChatOpenAIProvider } from '../langchain/chat';

export interface DeepSeekChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createDeepSeekChatProvider(options: DeepSeekChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'deepseek',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.deepseek.com/v1',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
