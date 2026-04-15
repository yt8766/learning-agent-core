import type { ZodType } from 'zod/v4';

import type { ChatMessage, GenerateTextOptions, LlmProvider } from '../llm/llm-provider';
import { appendJsonSafetyToMessages } from '../shared/prompts/json-safety-prompt';
import { safeGenerateObject, type SafeGenerateObjectRetryOptions } from './schemas/safe-generate-object';
import { withLlmRetry, type LlmRetryOptions } from './retry';

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
