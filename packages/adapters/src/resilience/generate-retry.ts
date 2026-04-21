import type { ZodType } from 'zod/v4';

import type { ChatMessage, GenerateTextOptions, LlmProvider } from '../contracts/llm/llm-provider.types';
import { appendJsonSafetyToMessages } from '../prompts';
import { createModelCapabilities, MODEL_CAPABILITIES } from '../contracts/llm/llm-provider.types';
import { safeGenerateObject, type SafeGenerateObjectRetryOptions } from '../structured-output';
import { withLlmRetry, type LlmRetryOptions } from './llm-retry';

function normalizeRequiredCapabilities(options: GenerateTextOptions): GenerateTextOptions {
  const requiredCapabilities = createModelCapabilities(
    MODEL_CAPABILITIES.TEXT,
    ...(options.thinking ? [MODEL_CAPABILITIES.THINKING] : []),
    ...(options.requiredCapabilities ?? [])
  );

  return {
    ...options,
    requiredCapabilities
  };
}

export async function generateTextWithRetry(params: {
  llm: LlmProvider;
  messages: ChatMessage[];
  options: GenerateTextOptions;
  retryOptions?: LlmRetryOptions;
}) {
  const options = normalizeRequiredCapabilities(params.options);
  return withLlmRetry(
    retryMessages => params.llm.generateText(retryMessages, options),
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
  const options = normalizeRequiredCapabilities(params.options);
  return withLlmRetry(
    retryMessages => params.llm.streamText(retryMessages, options, params.onToken),
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
  const options = normalizeRequiredCapabilities(params.options);
  const safeMessages = appendJsonSafetyToMessages(params.messages);
  const result = await safeGenerateObject<T>({
    contractName: params.contractName,
    contractVersion: params.contractVersion,
    isConfigured: params.llm.isConfigured(),
    schema: params.schema,
    retryOptions: params.retryOptions,
    messages: safeMessages,
    invokeWithMessages: retryMessages => params.llm.generateObject(retryMessages, params.schema, options)
  });

  if (!result.object) {
    throw new Error(result.meta.fallbackReason ?? `${params.contractName} generation failed.`);
  }

  return result.object;
}
