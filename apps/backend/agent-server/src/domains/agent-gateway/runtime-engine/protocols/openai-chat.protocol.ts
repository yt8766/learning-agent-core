import type {
  GatewayOpenAIChatCompletionResponse,
  GatewayRuntimeInvocation,
  GatewayRuntimeProviderKind,
  GatewayRuntimeStreamEvent
} from '@agent/core';

import type { RuntimeEngineInvokeResult } from '../types/runtime-engine.types';
import { createBaseInvocation } from './provider-pinned-runtime-invocation';

interface OpenAIChatContentPart {
  type: string;
  text?: string;
  image_url?: { url?: string };
}

interface NormalizeOpenAIChatRequestInput {
  requestId: string;
  clientId: string;
  apiKeyId: string;
  scopes: string[];
  body: {
    model: string;
    messages: Array<{ role: string; content: string | OpenAIChatContentPart[] }>;
    stream?: boolean;
  };
  providerKind?: GatewayRuntimeProviderKind;
}

interface ProjectOpenAIChatCompletionStreamEventOptions {
  model?: string;
  created?: number;
}

export function normalizeOpenAIChatCompletionRequest(input: NormalizeOpenAIChatRequestInput): GatewayRuntimeInvocation {
  const invocation: GatewayRuntimeInvocation = {
    id: input.requestId,
    protocol: 'openai.chat.completions',
    model: input.body.model,
    stream: input.body.stream === true,
    messages: input.body.messages.map(message => ({
      role: normalizeRole(message.role),
      content: normalizeContent(message.content)
    })),
    requestedAt: new Date().toISOString(),
    client: {
      clientId: input.clientId,
      apiKeyId: input.apiKeyId,
      scopes: input.scopes
    },
    metadata: {}
  };
  if (!input.providerKind) return invocation;
  return createBaseInvocation({
    requestId: invocation.id,
    protocol: invocation.protocol,
    providerKind: input.providerKind,
    model: invocation.model,
    stream: invocation.stream,
    client: invocation.client,
    messages: invocation.messages
  });
}

export function projectOpenAIChatCompletionResponse(
  result: RuntimeEngineInvokeResult
): GatewayOpenAIChatCompletionResponse {
  return {
    id: result.invocationId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: result.usage.inputTokens,
      completion_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens
    }
  };
}

export function projectOpenAIChatCompletionStreamEvent(
  event: GatewayRuntimeStreamEvent,
  options: ProjectOpenAIChatCompletionStreamEventOptions = {}
): string {
  if (event.type === 'done') return '[DONE]';

  const created = options.created ?? parseCreatedAt(event.createdAt);
  const model = options.model ?? 'agent-gateway';

  if (event.type === 'usage') {
    return JSON.stringify({
      id: event.invocationId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [],
      usage: {
        prompt_tokens: event.usage.inputTokens,
        completion_tokens: event.usage.outputTokens,
        total_tokens: event.usage.totalTokens
      }
    });
  }

  return JSON.stringify({
    id: event.invocationId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }]
  });
}

function parseCreatedAt(createdAt: string): number {
  const milliseconds = Date.parse(createdAt);
  if (Number.isNaN(milliseconds)) return Math.floor(Date.now() / 1000);
  return Math.floor(milliseconds / 1000);
}

function normalizeRole(role: string): 'system' | 'user' | 'assistant' | 'tool' {
  if (role === 'system' || role === 'assistant' || role === 'tool') return role;
  return 'user';
}

function normalizeContent(
  content: string | OpenAIChatContentPart[]
): GatewayRuntimeInvocation['messages'][number]['content'] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];

  const normalized: GatewayRuntimeInvocation['messages'][number]['content'] = [];
  for (const part of content) {
    if (part.type === 'text') {
      normalized.push({ type: 'text', text: part.text ?? '' });
      continue;
    }

    if (part.type === 'image_url' && part.image_url?.url) {
      normalized.push({ type: 'imageUrl', imageUrl: part.image_url.url });
    }
  }

  return normalized;
}
