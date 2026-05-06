import type { KnowledgeChatGenerateInput, KnowledgeChatGenerateResult, KnowledgeChatProvider } from '../../../core';
import {
  extractLangChainText,
  extractLangChainUsage,
  toKnowledgeProviderError,
  toLangChainMessages
} from '../../shared';

export interface LangChainChatModelLike {
  invoke(input: unknown, options?: Record<string, unknown>): Promise<unknown>;
}

export interface LangChainChatProviderOptions {
  providerId: string;
  defaultModel: string;
  model: LangChainChatModelLike;
}

export class LangChainChatProvider implements KnowledgeChatProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  private readonly model: LangChainChatModelLike;

  constructor(options: LangChainChatProviderOptions) {
    this.providerId = options.providerId;
    this.defaultModel = options.defaultModel;
    this.model = options.model;
  }

  async generate(input: KnowledgeChatGenerateInput): Promise<KnowledgeChatGenerateResult> {
    const model = input.model ?? this.defaultModel;

    try {
      const result = await this.model.invoke(toLangChainMessages(input.messages), {
        temperature: input.temperature,
        maxTokens: input.maxOutputTokens
      });
      const usage = extractLangChainUsage(result);

      return {
        text: extractLangChainText(result),
        providerId: this.providerId,
        model,
        ...(usage === undefined ? {} : { usage })
      };
    } catch (error) {
      throw toKnowledgeProviderError({
        providerId: this.providerId,
        message: `Knowledge chat provider ${this.providerId} failed`,
        cause: error
      });
    }
  }
}
