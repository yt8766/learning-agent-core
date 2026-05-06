import { ProviderSettingsRecord } from '@agent/config';
import type { ZodType } from 'zod/v4';

import { OpenAICompatibleProvider } from '../../openai-compatible/provider/openai-compatible-provider';
import { ChatMessage, GenerateTextOptions, LlmProvider, ModelInfo } from '../../contracts/llm/llm-provider.types';

export class KimiProvider implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;
  private readonly delegate: OpenAICompatibleProvider;

  constructor(config: ProviderSettingsRecord) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? 'Moonshot';
    this.delegate = OpenAICompatibleProvider.fromConfig(config);
  }

  static fromConfig(config: ProviderSettingsRecord): KimiProvider {
    return new KimiProvider(config);
  }

  supportedModels(): ModelInfo[] {
    return this.delegate.supportedModels();
  }

  isConfigured(): boolean {
    return this.delegate.isConfigured();
  }

  generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    return this.delegate.generateText(messages, options);
  }

  streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    return this.delegate.streamText(messages, options, onToken);
  }

  generateObject<T>(messages: ChatMessage[], schema: ZodType<T>, options: GenerateTextOptions): Promise<T> {
    return this.delegate.generateObject(messages, schema, options);
  }
}
