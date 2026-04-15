import type { ZodType } from 'zod/v4';

import {
  appendJsonSafetyToMessages,
  safeGenerateObject,
  withLlmRetry,
  type ChatMessage,
  type GenerateTextOptions,
  type LlmProvider,
  type SafeGenerateObjectRetryOptions
} from '@agent/adapters';

export interface LlmRetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
  formatErrorFeedback?: (error: Error) => string;
}

export async function generateTextWithRetry(params: {
  llm: LlmProvider;
  messages: ChatMessage[];
  options: GenerateTextOptions;
  retryOptions?: LlmRetryOptions;
}) {
  return withLlmRetry(
    retryMessages => params.llm.generateText(retryMessages, params.options),
    params.messages,
    params.retryOptions
  );
}

export async function streamTextWithRetry(params: {
  llm: LlmProvider;
  messages: ChatMessage[];
  options: GenerateTextOptions;
  onToken: (token: string, metadata?: { model?: string }) => void;
  retryOptions?: LlmRetryOptions;
}) {
  return withLlmRetry(
    retryMessages => params.llm.streamText(retryMessages, params.options, params.onToken),
    params.messages,
    params.retryOptions
  );
}

export async function generateObjectWithRetry<T>(params: {
  llm: LlmProvider;
  messages: ChatMessage[];
  schema: ZodType<T>;
  options: GenerateTextOptions;
  contractName: string;
  contractVersion: string;
  retryOptions?: SafeGenerateObjectRetryOptions;
}) {
  const safeMessages = appendJsonSafetyToMessages(params.messages);
  const result = await safeGenerateObject<T>({
    contractName: params.contractName,
    contractVersion: params.contractVersion,
    isConfigured: params.llm.isConfigured(),
    schema: params.schema,
    retryOptions: params.retryOptions,
    messages: safeMessages,
    invokeWithMessages: retryMessages => params.llm.generateObject(retryMessages, params.schema, params.options)
  });

  if (!result.object) {
    throw new Error(result.meta.fallbackReason ?? `${params.contractName} generation failed.`);
  }

  return result.object;
}
