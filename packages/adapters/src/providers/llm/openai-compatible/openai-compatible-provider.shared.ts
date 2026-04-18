import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { ChatMessage, LlmUsageMetadata } from '../base/llm-provider.types';

export function toLangChainMessage(message: ChatMessage) {
  switch (message.role) {
    case 'system':
      return new SystemMessage(message.content);
    case 'assistant':
      return new AIMessage(message.content);
    default:
      return new HumanMessage(message.content);
  }
}

export function readContent(content: unknown): string {
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

export function readUsage(payload: unknown): LlmUsageMetadata | undefined {
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

export function describeProviderError(error: unknown): string {
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
    return describeProviderError(record.cause);
  }
  return parts.join(' | ') || 'unknown provider error';
}

export function resolveStreamDelta(nextChunkText: string, accumulatedText: string): string {
  if (!nextChunkText) {
    return '';
  }

  if (!accumulatedText) {
    return nextChunkText;
  }

  if (nextChunkText === accumulatedText) {
    return '';
  }

  if (nextChunkText.startsWith(accumulatedText)) {
    return nextChunkText.slice(accumulatedText.length);
  }

  if (accumulatedText.endsWith(nextChunkText)) {
    return '';
  }

  return nextChunkText;
}
