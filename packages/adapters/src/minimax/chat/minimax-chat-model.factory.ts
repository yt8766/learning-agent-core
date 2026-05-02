import {
  createChatOpenAIModel,
  type ChatOpenAIModelOptions
} from '../../openai-compatible/chat/chat-openai-model.factory';

export type MiniMaxChatModelOptions = ChatOpenAIModelOptions;

export function createMiniMaxChatModel(options: MiniMaxChatModelOptions) {
  const maxCompletionTokens = normalizeMiniMaxMaxCompletionTokens(options.maxTokens);
  return createChatOpenAIModel({
    ...options,
    temperature: undefined,
    disableDefaultTemperature: true,
    maxTokens: undefined,
    modelKwargs: {
      ...(maxCompletionTokens === undefined ? {} : { max_completion_tokens: maxCompletionTokens }),
      ...(options.modelKwargs ?? {})
    },
    baseUrl: options.baseUrl ?? 'https://api.minimax.io/v1'
  });
}

function normalizeMiniMaxMaxCompletionTokens(maxTokens: number | undefined): number | undefined {
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    return undefined;
  }

  return Math.min(2048, Math.floor(maxTokens));
}
