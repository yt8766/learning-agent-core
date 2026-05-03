import { ProviderSettingsRecord } from '@agent/config';
import type { ZodType } from 'zod/v4';

import { createMiniMaxChatModel } from '../chat/minimax-chat-model.factory';
import { normalizeModelBaseUrl } from '../../shared/urls';
import {
  ChatMessage,
  createModelCapabilities,
  extractJsonObject,
  GenerateTextOptions,
  jsonObjectInstruction,
  LlmProvider,
  ModelInfo
} from '../../contracts/llm/llm-provider.types';
import {
  describeProviderError,
  readContent,
  readUsage,
  resolveStreamDelta,
  toLangChainMessage
} from '../../openai-compatible/provider/openai-compatible-provider.shared';

export class MiniMaxProvider implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;

  constructor(private readonly config: ProviderSettingsRecord) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? 'MiniMax';
  }

  static fromConfig(config: ProviderSettingsRecord): MiniMaxProvider {
    return new MiniMaxProvider(config);
  }

  supportedModels(): ModelInfo[] {
    return this.config.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId: this.providerId,
      contextWindow: 128_000,
      maxOutput: 8_192,
      capabilities: createModelCapabilities('text', 'tool-call')
    }));
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    try {
      const response = await this.createModel(options).invoke(messages.map(toLangChainMessage));
      const usage = readUsage(response);
      if (usage) {
        options.onUsage?.(usage);
      }
      return readContent(response.content);
    } catch (error) {
      throw this.buildProviderError('generateText', options, error);
    }
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    try {
      const stream = await this.createModel(options).stream(messages.map(toLangChainMessage));
      let finalText = '';
      let lastUsage: ReturnType<typeof readUsage>;

      for await (const chunk of stream) {
        const usage = readUsage(chunk);
        if (usage) {
          lastUsage = usage;
        }
        const chunkText = readContent(chunk.content);
        const token = resolveStreamDelta(chunkText, finalText);
        if (!token) {
          if (chunkText.startsWith(finalText)) {
            finalText = chunkText;
          }
          continue;
        }
        finalText = chunkText.startsWith(finalText) ? chunkText : `${finalText}${token}`;
        const metadata = chunk.response_metadata as { model_name?: unknown } | undefined;
        onToken(token, {
          model: typeof metadata?.model_name === 'string' ? metadata.model_name : options.modelId
        });
      }

      if (lastUsage) {
        options.onUsage?.(lastUsage);
      }

      return finalText;
    } catch (error) {
      throw this.buildProviderError('streamText', options, error);
    }
  }

  async generateObject<T>(messages: ChatMessage[], schema: ZodType<T>, options: GenerateTextOptions): Promise<T> {
    try {
      const response = await this.createModel(options).invoke(
        [
          ...messages,
          {
            role: 'system',
            content: jsonObjectInstruction(schema)
          } satisfies ChatMessage
        ].map(toLangChainMessage)
      );
      const usage = readUsage(response);
      if (usage) {
        options.onUsage?.(usage);
      }
      return schema.parse(extractJsonObject(readContent(response.content)));
    } catch (error) {
      throw this.buildProviderError('generateObject', options, error);
    }
  }

  private createModel(options: GenerateTextOptions) {
    const model = this.resolveModelId(options);
    if (!model) {
      throw new Error(`Provider ${this.providerId} has no configured model.`);
    }

    return createMiniMaxChatModel({
      model,
      maxTokens: options.maxTokens,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      streamUsage: false,
      thinking: false
    });
  }

  private resolveModelId(options: GenerateTextOptions): string | undefined {
    const roleModel = this.config.roleModels?.[options.role];
    return options.modelId ?? roleModel ?? this.config.models[0];
  }

  private buildProviderError(
    stage: 'generateText' | 'streamText' | 'generateObject',
    options: GenerateTextOptions,
    error: unknown
  ) {
    const model = this.resolveModelId(options) ?? 'unknown-model';
    const baseUrl = this.config.baseUrl ? normalizeModelBaseUrl(this.config.baseUrl) : 'https://api.minimax.io/v1';
    return new Error(
      `[provider=${this.providerId} stage=${stage} model=${model} baseUrl=${baseUrl}] ${describeProviderError(error)}`
    );
  }
}
