import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

import { ProviderSettingsRecord } from '@agent/config';

import {
  ChatMessage,
  extractJsonObject,
  GenerateTextOptions,
  jsonObjectInstruction,
  LlmProvider,
  LlmUsageMetadata,
  ModelInfo
} from './llm-provider';

function toLangChainMessage(message: ChatMessage) {
  switch (message.role) {
    case 'system':
      return new SystemMessage(message.content);
    case 'assistant':
      return new AIMessage(message.content);
    default:
      return new HumanMessage(message.content);
  }
}

function readContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(item => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('')
    .trim();
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readUsage(payload: unknown): LlmUsageMetadata | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const usageMetadata =
    'usage_metadata' in payload ? (payload as { usage_metadata?: unknown }).usage_metadata : undefined;
  const responseMetadata =
    'response_metadata' in payload ? (payload as { response_metadata?: unknown }).response_metadata : undefined;
  const candidate = (usageMetadata ?? responseMetadata) as Record<string, unknown> | undefined;
  if (!candidate) {
    return undefined;
  }

  const promptTokens = readNumber(candidate.promptTokens ?? candidate.prompt_tokens ?? candidate.input_tokens);
  const completionTokens = readNumber(
    candidate.completionTokens ?? candidate.completion_tokens ?? candidate.output_tokens
  );
  const totalTokens =
    readNumber(candidate.totalTokens ?? candidate.total_tokens) ??
    (promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : undefined);

  if (totalTokens == null && promptTokens == null && completionTokens == null) {
    return undefined;
  }

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? 0,
    model: typeof candidate.model === 'string' ? candidate.model : undefined,
    costUsd: readNumber(candidate.costUsd ?? candidate.cost_usd),
    costCny: readNumber(candidate.costCny ?? candidate.cost_cny)
  };
}

function toBaseUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/\/chat\/completions\/?$/, '');
}

function describeError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const record = error as {
    message?: unknown;
    status?: unknown;
    code?: unknown;
    cause?: unknown;
    response?: { status?: unknown; data?: unknown };
    error?: { message?: unknown; code?: unknown; type?: unknown };
  };

  const parts: string[] = [];
  if (typeof record.message === 'string' && record.message.trim()) {
    parts.push(record.message.trim());
  }
  const status =
    (typeof record.status === 'number' ? record.status : undefined) ??
    (typeof record.response?.status === 'number' ? record.response.status : undefined);
  if (status != null) {
    parts.push(`status=${status}`);
  }
  if (typeof record.code === 'string' && record.code.trim()) {
    parts.push(`code=${record.code.trim()}`);
  } else if (typeof record.error?.code === 'string' && record.error.code.trim()) {
    parts.push(`code=${record.error.code.trim()}`);
  }
  if (typeof record.error?.type === 'string' && record.error.type.trim()) {
    parts.push(`type=${record.error.type.trim()}`);
  }
  if (typeof record.error?.message === 'string' && record.error.message.trim()) {
    parts.push(`provider=${record.error.message.trim()}`);
  }
  if (!parts.length && record.cause) {
    return describeError(record.cause);
  }
  return parts.join(' | ') || 'unknown provider error';
}

export class OpenAICompatibleProvider implements LlmProvider {
  readonly providerId: string;
  readonly displayName: string;

  constructor(private readonly config: ProviderSettingsRecord) {
    this.providerId = config.id;
    this.displayName = config.displayName ?? config.id;
  }

  static fromConfig(config: ProviderSettingsRecord): OpenAICompatibleProvider {
    return new OpenAICompatibleProvider(config);
  }

  supportedModels(): ModelInfo[] {
    return this.config.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId: this.providerId,
      contextWindow: 128_000,
      maxOutput: 8_192,
      capabilities: ['text', 'tool-call']
    }));
  }

  isConfigured(): boolean {
    if (this.config.type === 'ollama') {
      return Boolean(this.config.baseUrl || 'http://localhost:11434/v1');
    }
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
      let lastUsage: LlmUsageMetadata | undefined;

      for await (const chunk of stream) {
        const usage = readUsage(chunk);
        if (usage) {
          lastUsage = usage;
        }
        const token = readContent(chunk.content);
        if (!token) {
          continue;
        }
        finalText += token;
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

  async generateObject<T>(
    messages: ChatMessage[],
    schema: import('zod/v4').ZodType<T>,
    options: GenerateTextOptions
  ): Promise<T> {
    try {
      const responseText = await this.generateText(
        [
          ...messages,
          {
            role: 'system',
            content: jsonObjectInstruction(schema)
          }
        ],
        options
      );

      return schema.parse(extractJsonObject(responseText));
    } catch (error) {
      throw this.buildProviderError('generateObject', options, error);
    }
  }

  private createModel(options: GenerateTextOptions): ChatOpenAI {
    const model = this.resolveModelId(options);
    if (!model) {
      throw new Error(`Provider ${this.providerId} has no configured model.`);
    }

    return new ChatOpenAI({
      model,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens,
      apiKey: this.config.apiKey,
      configuration: this.config.baseUrl
        ? {
            baseURL: toBaseUrl(this.config.baseUrl)
          }
        : undefined,
      modelKwargs: options.thinking
        ? {
            thinking: {
              type: 'enabled'
            }
          }
        : undefined
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
    const baseUrl = toBaseUrl(this.config.baseUrl) ?? 'default-openai-endpoint';
    return new Error(
      `[provider=${this.providerId} stage=${stage} model=${model} baseUrl=${baseUrl}] ${describeError(error)}`
    );
  }
}
