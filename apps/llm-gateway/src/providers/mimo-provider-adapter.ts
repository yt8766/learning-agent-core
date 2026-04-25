import { GatewayError } from '../gateway/errors';
import type {
  GatewayChatRequest,
  GatewayChatResponse,
  GatewayChatStreamChunk,
  GatewayUsage,
  ProviderAdapter
} from './provider-adapter';
import { createUnavailableProviderAdapter } from './provider-adapter';

export interface MiMoProviderAdapterConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

type MiMoFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;

interface MiMoChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: MiMoFinishReason;
}

interface MiMoChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  choices: MiMoChatCompletionChoice[];
  usage: GatewayUsage;
}

interface MiMoChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  usage?: GatewayUsage;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: MiMoFinishReason;
  }>;
}

export function createMiMoProviderAdapter(config?: MiMoProviderAdapterConfig): ProviderAdapter {
  if (!config) {
    return createUnavailableProviderAdapter('mimo');
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  return {
    id: 'mimo',
    async complete(request) {
      const response = await postMiMoChatCompletion(endpoint, config, request, false);
      const payload = await parseJson(response);

      if (!isMiMoChatCompletionResponse(payload)) {
        throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo returned a malformed completion response', 502);
      }

      return {
        id: payload.id,
        object: 'chat.completion',
        created: payload.created,
        model: request.model,
        choices: payload.choices.map(choice => ({
          index: choice.index,
          message: {
            role: 'assistant',
            content: choice.message.content
          },
          finish_reason: choice.finish_reason
        })),
        usage: payload.usage
      } satisfies GatewayChatResponse;
    },
    async *stream(request) {
      const response = await postMiMoChatCompletion(endpoint, config, request, true);

      if (!response.body) {
        throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo returned a stream response without a body', 502);
      }

      for await (const payload of readSsePayloads(response.body)) {
        if (payload === '[DONE]') {
          continue;
        }

        const parsed = parseSseJson(payload);
        if (!isMiMoChatCompletionChunk(parsed)) {
          throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo returned a malformed stream chunk', 502);
        }

        yield {
          id: parsed.id,
          object: 'chat.completion.chunk',
          created: parsed.created,
          model: request.model,
          choices: parsed.choices.map(choice => ({
            index: choice.index,
            delta: {
              role: choice.delta.role,
              content: choice.delta.content
            },
            finish_reason: choice.finish_reason
          })),
          usage: parsed.usage
        } satisfies GatewayChatStreamChunk;
      }
    },
    async healthCheck() {
      return {
        status: 'available',
        checkedAt: new Date().toISOString()
      };
    }
  };
}

async function postMiMoChatCompletion(
  endpoint: string,
  config: MiMoProviderAdapterConfig,
  request: GatewayChatRequest,
  stream: boolean
): Promise<Response> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: request.providerModel,
        messages: request.messages,
        stream,
        ...(stream ? { stream_options: { include_usage: true } } : {}),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens })
      }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      throw mapMiMoStatus(response.status);
    }

    return response;
  } catch (error) {
    if (error instanceof GatewayError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new GatewayError('UPSTREAM_TIMEOUT', 'MiMo request timed out', 504);
    }

    throw new GatewayError('UPSTREAM_UNAVAILABLE', 'MiMo provider is unavailable', 503);
  }
}

function mapMiMoStatus(status: number): GatewayError {
  if (status === 401 || status === 403) {
    return new GatewayError('UPSTREAM_AUTH_ERROR', 'MiMo authentication failed', status);
  }

  if (status === 429) {
    return new GatewayError('UPSTREAM_RATE_LIMITED', 'MiMo rate limit exceeded', 429);
  }

  if (status >= 500) {
    return new GatewayError('UPSTREAM_UNAVAILABLE', 'MiMo provider is unavailable', 503);
  }

  return new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo request failed', 502);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo returned invalid JSON', 502);
  }
}

async function* readSsePayloads(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const payload = readSseData(event);
        if (payload !== null) {
          yield payload;
        }
      }
    }

    buffer += decoder.decode();
    const payload = readSseData(buffer);
    if (payload !== null) {
      yield payload;
    }
  } finally {
    reader.releaseLock();
  }
}

function readSseData(event: string): string | null {
  const dataLines = event
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trimStart());

  return dataLines.length > 0 ? dataLines.join('\n') : null;
}

function parseSseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'MiMo returned invalid stream JSON', 502);
  }
}

function isMiMoChatCompletionResponse(value: unknown): value is MiMoChatCompletionResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.object === 'chat.completion' &&
    typeof value.created === 'number' &&
    (value.usage === undefined || isGatewayUsage(value.usage)) &&
    Array.isArray(value.choices) &&
    value.choices.every(isMiMoChatCompletionChoice) &&
    isGatewayUsage(value.usage)
  );
}

function isMiMoChatCompletionChoice(value: unknown): value is MiMoChatCompletionChoice {
  return (
    isRecord(value) &&
    typeof value.index === 'number' &&
    isRecord(value.message) &&
    value.message.role === 'assistant' &&
    typeof value.message.content === 'string' &&
    isMiMoFinishReason(value.finish_reason)
  );
}

function isMiMoChatCompletionChunk(value: unknown): value is MiMoChatCompletionChunk {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.object === 'chat.completion.chunk' &&
    typeof value.created === 'number' &&
    Array.isArray(value.choices) &&
    value.choices.every(isMiMoChatCompletionChunkChoice)
  );
}

function isMiMoChatCompletionChunkChoice(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.index === 'number' &&
    isRecord(value.delta) &&
    (value.delta.role === undefined || value.delta.role === 'assistant') &&
    (value.delta.content === undefined || typeof value.delta.content === 'string') &&
    isMiMoFinishReason(value.finish_reason)
  );
}

function isMiMoFinishReason(value: unknown): value is MiMoFinishReason {
  return (
    value === null || value === 'stop' || value === 'length' || value === 'tool_calls' || value === 'content_filter'
  );
}

function isGatewayUsage(value: unknown): value is GatewayUsage {
  return (
    isRecord(value) &&
    typeof value.prompt_tokens === 'number' &&
    typeof value.completion_tokens === 'number' &&
    typeof value.total_tokens === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
