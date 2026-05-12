import { KnowledgeRagStreamEventSchema } from '@agent/knowledge/browser';

import type { ChatRequest } from '../types/api';
import type { KnowledgeRagStreamEvent } from '../types/chat';

export interface KnowledgeChatStreamRequest {
  accessToken?: string | null;
  baseUrl: string;
  fetcher?: typeof fetch;
  input: ChatRequest;
}

export async function* streamKnowledgeChat({
  accessToken,
  baseUrl,
  fetcher = globalThis.fetch.bind(globalThis),
  input
}: KnowledgeChatStreamRequest): AsyncIterable<KnowledgeRagStreamEvent> {
  const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/knowledge/chat`, {
    body: JSON.stringify({ ...input, stream: true }),
    headers: mergeStreamHeaders(accessToken),
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(await readStreamError(response));
  }
  if (!response.body) {
    throw new Error('Knowledge chat stream response body is empty.');
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = drainSseBuffer(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        yield event;
      }
    }
    buffer += decoder.decode();
    for (const event of drainSseBuffer(`${buffer}\n\n`).events) {
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseKnowledgeChatSseFrame(frame: string): KnowledgeRagStreamEvent | undefined {
  const data = frame
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n');
  if (!data) {
    return undefined;
  }
  const parsed = JSON.parse(data) as unknown;
  const result = KnowledgeRagStreamEventSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid knowledge chat stream event.');
  }
  return result.data;
}

function drainSseBuffer(buffer: string) {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const events = parts
    .map(parseKnowledgeChatSseFrame)
    .filter((event): event is KnowledgeRagStreamEvent => Boolean(event));
  return { events, rest };
}

function mergeStreamHeaders(accessToken: string | null | undefined) {
  const headers = new Headers({ Accept: 'text/event-stream', 'Content-Type': 'application/json' });
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

async function readStreamError(response: Response) {
  const body = await response.json().catch(() => undefined);
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }
  return `HTTP ${response.status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
