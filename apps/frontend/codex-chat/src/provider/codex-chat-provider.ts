import { AbstractChatProvider, XRequest } from '@ant-design/x-sdk';
import type { SSEFields, TransformMessage, XRequestOptions } from '@ant-design/x-sdk';

import type { CodexChatInput, CodexChatMessage, CodexThoughtStep, DirectChatChunk } from '@/types/chat';
import { splitReasoning } from '@/utils/parse-reasoning';

type SseChunk = Partial<Record<SSEFields, unknown>> | DirectChatChunk;

function parseChunk(chunk?: SseChunk): DirectChatChunk | undefined {
  if (!chunk) {
    return undefined;
  }

  const directChunk = chunk as DirectChatChunk;
  const data = directChunk.data;

  if (typeof data === 'string') {
    if (data === '[DONE]') {
      return { event: 'done' };
    }

    try {
      return JSON.parse(data) as DirectChatChunk;
    } catch {
      return { event: directChunk.event, content: data };
    }
  }

  if (data && typeof data === 'object') {
    return data as DirectChatChunk;
  }

  return directChunk;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stepFromChunk(chunk: DirectChatChunk, index: number): CodexThoughtStep | undefined {
  const payload = chunk.payload ?? {};
  const title =
    readString(payload.title) ??
    readString(payload.label) ??
    readString(payload.stage) ??
    readString(chunk.stage) ??
    readString(chunk.event);

  if (!title) {
    return undefined;
  }

  const status = chunk.event === 'stage' || chunk.event === 'node_progress' ? 'running' : 'completed';

  return {
    id: readString(payload.id) ?? `${chunk.event ?? 'step'}-${index}`,
    title,
    description: readString(payload.description) ?? readString(payload.summary),
    status,
    agentLabel: readString(payload.agentLabel) ?? readString(payload.ownerLabel)
  };
}

function mergeSteps(existing: CodexThoughtStep[] | undefined, next?: CodexThoughtStep): CodexThoughtStep[] | undefined {
  if (!next) {
    return existing;
  }

  const current = existing ?? [];
  const index = current.findIndex(step => step.id === next.id);

  if (index < 0) {
    return [...current, next];
  }

  return current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...next } : step));
}

export class CodexDirectChatProvider extends AbstractChatProvider<CodexChatMessage, CodexChatInput, SseChunk> {
  transformParams(
    requestParams: Partial<CodexChatInput>,
    options: XRequestOptions<CodexChatInput, SseChunk, CodexChatMessage>
  ): CodexChatInput {
    const messages = requestParams.messages ?? [];
    const message = requestParams.message ?? messages.at(-1)?.content ?? '';

    return {
      ...(options?.params ?? {}),
      message,
      messages,
      modelId: requestParams.modelId,
      preferLlm: true,
      stream: true
    };
  }

  transformLocalMessage(requestParams: Partial<CodexChatInput>): CodexChatMessage {
    return {
      role: 'user',
      content: requestParams.message ?? requestParams.messages?.at(-1)?.content ?? ''
    };
  }

  transformMessage(info: TransformMessage<CodexChatMessage, SseChunk>): CodexChatMessage {
    const chunk = parseChunk(info.chunk);
    const origin = info.originMessage ?? { role: 'assistant', content: '' };

    if (!chunk || chunk.event === 'done') {
      return origin;
    }

    const payload = chunk.payload ?? {};
    const token =
      readString(chunk.content) ??
      readString(payload.content) ??
      readString(payload.delta) ??
      readString(payload.text) ??
      '';
    const rawContent = `${origin.content}${token}`;
    const parts = splitReasoning(rawContent);

    return {
      ...origin,
      role: 'assistant',
      content: parts.visibleContent,
      reasoning: parts.reasoning ?? origin.reasoning,
      steps: mergeSteps(origin.steps, stepFromChunk(chunk, info.chunks.length))
    };
  }
}

export function createCodexDirectChatProvider() {
  return new CodexDirectChatProvider({
    request: XRequest<CodexChatInput, SseChunk, CodexChatMessage>('/api/chat', {
      manual: true,
      params: {
        preferLlm: true,
        stream: true
      }
    })
  });
}
