import { createChatOpenAIProvider } from '../langchain/chat';

export interface GlmChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createGlmChatProvider(options: GlmChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'glm',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
