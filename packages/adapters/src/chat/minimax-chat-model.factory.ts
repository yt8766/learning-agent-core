import { createChatOpenAIModel, type ChatOpenAIModelOptions } from './chat-openai-model.factory';

export type MiniMaxChatModelOptions = ChatOpenAIModelOptions;

export function createMiniMaxChatModel(options: MiniMaxChatModelOptions) {
  return createChatOpenAIModel({
    ...options,
    baseUrl: options.baseUrl ?? 'https://api.minimaxi.com/v1'
  });
}
