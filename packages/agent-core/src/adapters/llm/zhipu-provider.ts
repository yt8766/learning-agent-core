import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import {
  ChatMessage,
  extractJsonObject,
  GenerateTextOptions,
  jsonObjectInstruction,
  LlmUsageMetadata,
  LlmProvider
} from './llm-provider';
import { ZhipuChatModelFactory } from './chat-model-factory';

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

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'text' in item) {
          const value = (item as { text?: unknown }).text;
          return typeof value === 'string' ? value : '';
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function readUsage(payload: unknown): LlmUsageMetadata | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const usageMetadata =
    'usage_metadata' in payload ? (payload as { usage_metadata?: unknown }).usage_metadata : undefined;
  const responseMetadata =
    'response_metadata' in payload ? (payload as { response_metadata?: unknown }).response_metadata : undefined;

  const direct = normalizeUsageLike(usageMetadata);
  if (direct) {
    return direct;
  }

  if (responseMetadata && typeof responseMetadata === 'object') {
    const tokenUsage =
      'tokenUsage' in responseMetadata
        ? (responseMetadata as { tokenUsage?: unknown }).tokenUsage
        : 'usage' in responseMetadata
          ? (responseMetadata as { usage?: unknown }).usage
          : undefined;
    const fromResponse = normalizeUsageLike(tokenUsage);
    if (fromResponse) {
      const modelName =
        'model_name' in responseMetadata ? (responseMetadata as { model_name?: unknown }).model_name : undefined;
      return {
        ...fromResponse,
        model: typeof modelName === 'string' ? modelName : fromResponse.model
      };
    }
  }

  return undefined;
}

function normalizeUsageLike(payload: unknown): LlmUsageMetadata | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  const promptTokens = readNumber(candidate.promptTokens ?? candidate.prompt_tokens ?? candidate.input_tokens);
  const completionTokens = readNumber(
    candidate.completionTokens ?? candidate.completion_tokens ?? candidate.output_tokens
  );
  const totalTokens =
    readNumber(candidate.totalTokens ?? candidate.total_tokens) ??
    (promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : undefined);

  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return undefined;
  }

  const model = typeof candidate.model === 'string' ? candidate.model : undefined;
  const costUsd = readNumber(candidate.costUsd ?? candidate.cost_usd ?? candidate.total_cost_usd);
  const costCny = readNumber(candidate.costCny ?? candidate.cost_cny ?? candidate.total_cost_cny);

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? 0,
    model,
    costUsd,
    costCny
  };
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export class ZhipuLlmProvider implements LlmProvider {
  private readonly factory = new ZhipuChatModelFactory();

  isConfigured(): boolean {
    return this.factory.isConfigured();
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('ZHIPU_API_KEY is not configured.');
    }

    const model = this.factory.create(options.role, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      thinking: options.thinking
    });
    const response = await model.invoke(messages.map(toLangChainMessage));
    const usage = readUsage(response);
    if (usage) {
      options.onUsage?.(usage);
    }
    return readContent(response.content);
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('ZHIPU_API_KEY is not configured.');
    }

    const model = this.factory.create(options.role, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      thinking: options.thinking
    });

    const stream = await model.stream(messages.map(toLangChainMessage));
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
      const meta = chunk.response_metadata as { model_name?: unknown } | undefined;
      const modelName = meta?.model_name;
      onToken(token, {
        model: typeof modelName === 'string' ? modelName : undefined
      });
    }

    if (lastUsage) {
      options.onUsage?.(lastUsage);
    }

    return finalText;
  }

  async generateObject<T>(
    messages: ChatMessage[],
    schema: import('zod/v4').ZodType<T>,
    options: GenerateTextOptions
  ): Promise<T> {
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
  }
}

export { ZhipuChatModelFactory };
