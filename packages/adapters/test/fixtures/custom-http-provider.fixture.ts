import type { ProviderSettingsRecord } from '@agent/config';
import {
  createModelCapabilities,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type ModelInfo
} from '@agent/adapters';
import type { ZodType } from 'zod/v4';

export class CustomHttpProviderFixture implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;

  constructor(private readonly config: ProviderSettingsRecord) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? config.id;
  }

  supportedModels(): ModelInfo[] {
    return this.config.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId: this.providerId,
      contextWindow: 64_000,
      maxOutput: 4_096,
      capabilities: createModelCapabilities('text')
    }));
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    const modelId =
      options.modelId ?? this.config.roleModels?.[options.role] ?? this.config.models[0] ?? 'custom-model';
    const summary = messages.map(message => `${message.role}:${message.content}`).join(' | ');
    return `[custom-http model=${modelId}] ${summary}`;
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    const text = await this.generateText(messages, options);
    onToken(text, { model: options.modelId ?? this.config.models[0] });
    return text;
  }

  async generateObject<T>(_messages: ChatMessage[], schema: ZodType<T>, _options: GenerateTextOptions): Promise<T> {
    return schema.parse({
      ok: true
    });
  }
}
