import type { ZodType } from 'zod/v4';

import { jsonObjectInstruction, type ChatMessage, type LlmUsageMetadata } from '../../contracts/llm/llm-provider.types';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequestPayload {
  model: string;
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
  system?: string;
  messages: AnthropicMessage[];
}

export function toAnthropicPayload(
  messages: ChatMessage[],
  options: {
    model: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    schemaInstruction?: string;
  }
): AnthropicRequestPayload {
  const systemParts: string[] = [];
  if (options.schemaInstruction) {
    systemParts.push(options.schemaInstruction);
  }

  const anthropicMessages: AnthropicMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }
    anthropicMessages.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    });
  }

  return {
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.2,
    stream: options.stream,
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: anthropicMessages
  };
}

export function withJsonObjectInstruction(messages: ChatMessage[], schema: ZodType<unknown>) {
  return [...messages, { role: 'system', content: jsonObjectInstruction(schema) } satisfies ChatMessage];
}

export function readAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const content = 'content' in payload ? (payload as { content?: unknown }).content : undefined;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(item => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      const candidate = item as { type?: unknown; text?: unknown };
      return candidate.type === 'text' && typeof candidate.text === 'string' ? candidate.text : '';
    })
    .join('')
    .trim();
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readAnthropicUsage(payload: unknown): LlmUsageMetadata | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const usage = 'usage' in payload ? (payload as { usage?: unknown }).usage : undefined;
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const candidate = usage as Record<string, unknown>;
  const promptTokens = readNumber(candidate.input_tokens ?? candidate.prompt_tokens);
  const completionTokens = readNumber(candidate.output_tokens ?? candidate.completion_tokens);
  const totalTokens =
    readNumber(candidate.total_tokens) ??
    (promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : undefined);

  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return undefined;
  }

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? 0
  };
}

export async function readAnthropicError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as
      | {
          error?: { message?: unknown; type?: unknown };
        }
      | undefined;
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : response.statusText;
    const type = typeof payload?.error?.type === 'string' ? payload.error.type : undefined;
    return [message, `status=${response.status}`, type ? `type=${type}` : null].filter(Boolean).join(' | ');
  } catch {
    return [`status=${response.status}`, response.statusText].filter(Boolean).join(' | ');
  }
}

export async function* parseAnthropicSse(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ event?: string; data: unknown }, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) {
        break;
      }
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = rawEvent.split(/\r?\n/);
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trim());
        }
      }

      const rawData = dataLines.join('\n');
      if (!rawData || rawData === '[DONE]') {
        continue;
      }

      yield {
        event,
        data: JSON.parse(rawData)
      };
    }
  }
}
