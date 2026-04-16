import { loadSettings } from '@agent/config';

import { ChatMessage, GenerateTextOptions, LlmProvider, ModelInfo } from './llm-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

export class ZhipuLlmProvider implements LlmProvider {
  readonly providerId = 'zhipu';
  readonly displayName = 'ZhiPu';

  private readonly delegate: OpenAICompatibleProvider;

  constructor(settings = loadSettings()) {
    this.delegate = OpenAICompatibleProvider.fromConfig({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: settings.zhipuApiKey,
      baseUrl: settings.zhipuApiBaseUrl,
      models: Array.from(new Set(Object.values(settings.zhipuModels))),
      roleModels: settings.zhipuModels
    });
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

  generateObject<T>(
    messages: ChatMessage[],
    schema: import('zod/v4').ZodType<T>,
    options: GenerateTextOptions
  ): Promise<T> {
    return this.delegate.generateObject(messages, schema, options);
  }
}
