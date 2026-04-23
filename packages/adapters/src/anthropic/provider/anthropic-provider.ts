import { ProviderSettingsRecord } from '@agent/config';
import type { ZodType } from 'zod/v4';

import { normalizeModelBaseUrl } from '../../shared/urls';
import {
  createModelCapabilities,
  extractJsonObject,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type ModelInfo
} from '../../contracts/llm/llm-provider.types';
import {
  parseAnthropicSse,
  readAnthropicError,
  readAnthropicText,
  readAnthropicUsage,
  toAnthropicPayload,
  withJsonObjectInstruction
} from './anthropic-provider.shared';

export class AnthropicProvider implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;

  constructor(private readonly config: ProviderSettingsRecord) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? config.id;
  }

  static fromConfig(config: ProviderSettingsRecord): AnthropicProvider {
    return new AnthropicProvider(config);
  }

  supportedModels(): ModelInfo[] {
    return this.config.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId: this.providerId,
      contextWindow: 200_000,
      maxOutput: 8_192,
      capabilities: createModelCapabilities('text', 'tool-call')
    }));
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    const model = this.resolveModelId(options);
    if (!model) {
      throw new Error(`Provider ${this.providerId} has no configured model.`);
    }

    try {
      const response = await fetch(this.messagesEndpoint(), {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(
          toAnthropicPayload(messages, {
            model,
            maxTokens: options.maxTokens,
            temperature: options.temperature
          })
        )
      });

      if (!response.ok) {
        throw new Error(await readAnthropicError(response));
      }

      const payload = await response.json();
      const usage = readAnthropicUsage(payload);
      if (usage) {
        options.onUsage?.(usage);
      }
      return readAnthropicText(payload);
    } catch (error) {
      throw this.buildProviderError('generateText', options, error);
    }
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    const model = this.resolveModelId(options);
    if (!model) {
      throw new Error(`Provider ${this.providerId} has no configured model.`);
    }

    try {
      const response = await fetch(this.messagesEndpoint(), {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(
          toAnthropicPayload(messages, {
            model,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            stream: true
          })
        )
      });

      if (!response.ok) {
        throw new Error(await readAnthropicError(response));
      }
      if (!response.body) {
        throw new Error('Anthropic stream response did not include a readable body.');
      }

      let finalText = '';
      let latestUsage:
        | {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          }
        | undefined;

      for await (const chunk of parseAnthropicSse(response.body)) {
        if (chunk.event === 'content_block_delta' && chunk.data && typeof chunk.data === 'object') {
          const delta = 'delta' in chunk.data ? (chunk.data as { delta?: unknown }).delta : undefined;
          if (delta && typeof delta === 'object') {
            const candidate = delta as { type?: unknown; text?: unknown };
            if (candidate.type === 'text_delta' && typeof candidate.text === 'string' && candidate.text.length > 0) {
              finalText += candidate.text;
              onToken(candidate.text, { model });
            }
          }
        }

        if (chunk.event === 'message_delta' && chunk.data && typeof chunk.data === 'object') {
          const usage = 'usage' in chunk.data ? (chunk.data as { usage?: unknown }).usage : undefined;
          if (usage && typeof usage === 'object') {
            latestUsage = usage as { input_tokens?: number; output_tokens?: number; total_tokens?: number };
          }
        }
      }

      if (latestUsage) {
        options.onUsage?.({
          promptTokens: latestUsage.input_tokens ?? 0,
          completionTokens: latestUsage.output_tokens ?? 0,
          totalTokens: latestUsage.total_tokens ?? (latestUsage.input_tokens ?? 0) + (latestUsage.output_tokens ?? 0)
        });
      }

      return finalText;
    } catch (error) {
      throw this.buildProviderError('streamText', options, error);
    }
  }

  async generateObject<T>(messages: ChatMessage[], schema: ZodType<T>, options: GenerateTextOptions): Promise<T> {
    const responseText = await this.generateText(withJsonObjectInstruction(messages, schema), options);
    try {
      return schema.parse(extractJsonObject(responseText));
    } catch (error) {
      throw this.buildProviderError('generateObject', options, error);
    }
  }

  private resolveModelId(options: GenerateTextOptions): string | undefined {
    const roleModel = this.config.roleModels?.[options.role];
    return options.modelId ?? roleModel ?? this.config.models[0];
  }

  private buildHeaders(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-key': this.config.apiKey ?? '',
      'anthropic-version': '2023-06-01'
    };
  }

  private messagesEndpoint(): string {
    const baseUrl = this.normalizedBaseUrl();
    return `${baseUrl}/messages`;
  }

  private normalizedBaseUrl(): string {
    return normalizeModelBaseUrl(this.config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  }

  private buildProviderError(
    stage: 'generateText' | 'streamText' | 'generateObject',
    options: GenerateTextOptions,
    error: unknown
  ) {
    const model = this.resolveModelId(options) ?? 'unknown-model';
    const baseUrl = this.normalizedBaseUrl();
    const message = error instanceof Error ? error.message : String(error ?? 'unknown provider error');
    return new Error(`[provider=${this.providerId} stage=${stage} model=${model} baseUrl=${baseUrl}] ${message}`);
  }
}
