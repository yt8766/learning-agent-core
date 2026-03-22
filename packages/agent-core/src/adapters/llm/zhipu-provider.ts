import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import {
  ChatMessage,
  extractJsonObject,
  GenerateTextOptions,
  jsonObjectInstruction,
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

    for await (const chunk of stream) {
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
