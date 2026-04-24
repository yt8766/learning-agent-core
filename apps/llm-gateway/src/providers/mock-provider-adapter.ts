import type {
  GatewayChatRequest,
  GatewayChatResponse,
  GatewayChatStreamChunk,
  ProviderAdapter
} from './provider-adapter';

interface MockProviderAdapterOptions {
  content?: string;
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimatePromptTokens(request: GatewayChatRequest): number {
  return request.messages.reduce((total, message) => total + estimateTextTokens(message.content) + 4, 0);
}

export function createMockProviderAdapter(options: MockProviderAdapterOptions = {}): ProviderAdapter {
  const content = options.content ?? 'mock response';

  return {
    id: 'mock',
    async complete(request) {
      const completionTokens = estimateTextTokens(content);
      const promptTokens = estimatePromptTokens(request);

      return {
        id: `chatcmpl-${request.id ?? 'mock'}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        }
      } satisfies GatewayChatResponse;
    },
    async *stream(request) {
      const id = `chatcmpl-${request.id ?? 'mock'}`;
      const created = Math.floor(Date.now() / 1000);

      for (const char of content) {
        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              delta: { content: char },
              finish_reason: null
            }
          ]
        } satisfies GatewayChatStreamChunk;
      }

      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model: request.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }
        ]
      };
    },
    async healthCheck() {
      return {
        status: 'available',
        checkedAt: new Date().toISOString()
      };
    }
  };
}
