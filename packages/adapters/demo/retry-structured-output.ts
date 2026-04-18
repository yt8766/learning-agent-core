import { z } from 'zod/v4';

import {
  generateObjectWithRetry,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type LlmProviderModelInfo
} from '../src/index.js';

class DemoStructuredProvider implements LlmProvider {
  readonly providerId = 'demo-structured';
  readonly displayName = 'Demo Structured Provider';
  private attempts = 0;

  supportedModels(): LlmProviderModelInfo[] {
    return [
      {
        id: 'demo-structured-model',
        displayName: 'demo-structured-model',
        providerId: this.providerId,
        contextWindow: 32_000,
        maxOutput: 2_048,
        capabilities: ['text']
      }
    ];
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(messages: ChatMessage[]): Promise<string> {
    return messages.at(-1)?.content ?? '';
  }

  async streamText(
    messages: ChatMessage[],
    _options: GenerateTextOptions,
    onToken: (token: string) => void
  ): Promise<string> {
    const text = await this.generateText(messages);
    onToken(text);
    return text;
  }

  async generateObject<T>(_messages: ChatMessage[], schema: z.ZodType<T>): Promise<T> {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error('invalid json shape from upstream provider');
    }

    return schema.parse({
      answer: '已通过重试拿到结构化对象',
      score: 0.98
    });
  }
}

async function main() {
  const provider = new DemoStructuredProvider();
  const result = await generateObjectWithRetry({
    llm: provider,
    messages: [{ role: 'user', content: '请返回结构化对象' }],
    schema: z.object({
      answer: z.string(),
      score: z.number()
    }),
    contractName: 'demo-structured-output',
    contractVersion: '1.0.0',
    options: {
      role: 'manager',
      thinking: false
    },
    retryOptions: {
      onRetry(attempt, error) {
        console.log(`retry #${attempt}: ${error.message}`);
      }
    }
  });

  console.log('structured output result:', result);
}

void main();
