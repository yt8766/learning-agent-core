import { ChatOpenAI } from '@langchain/openai';

import { LangChainChatProvider } from './langchain-chat-provider';

export interface ChatOpenAIKnowledgeProviderOptions {
  providerId: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export function createChatOpenAIProvider(options: ChatOpenAIKnowledgeProviderOptions): LangChainChatProvider {
  return new LangChainChatProvider({
    providerId: options.providerId,
    defaultModel: options.model,
    model: new ChatOpenAI({
      model: options.model,
      ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
      temperature: options.temperature ?? 0.2,
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.baseUrl === undefined ? {} : { configuration: { baseURL: options.baseUrl } })
    })
  });
}
