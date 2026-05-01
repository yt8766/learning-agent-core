import { createChatOpenAIProvider, type ChatOpenAIKnowledgeProviderOptions } from '../langchain/chat';

export type OpenAICompatibleChatProviderOptions = ChatOpenAIKnowledgeProviderOptions;

export function createOpenAICompatibleChatProvider(options: OpenAICompatibleChatProviderOptions) {
  return createChatOpenAIProvider(options);
}
