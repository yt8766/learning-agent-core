import type { LlmProviderMessage as ChatMessage } from '@agent/core';

export interface LlmRetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
  formatErrorFeedback?: (error: Error) => string;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_PATTERN =
  /(json|schema|parse|invalid|unexpected token|unterminated|format|syntax|object|enum|required|missing)/i;

export function defaultLlmRetryFeedback(error: Error): string {
  return [
    '上一次生成失败，请根据错误原因修正输出并重新生成。',
    `错误信息：${error.message}`,
    '要求：',
    '1. 严格遵守目标 Schema 与字段枚举',
    '2. 只返回合法结果，不要附加解释或多余文本',
    '3. 检查 JSON 结构、必填字段与类型是否完整'
  ].join('\n');
}

export function isRetryableLlmError(error: Error) {
  return DEFAULT_RETRY_PATTERN.test(error.message);
}

export async function withLlmRetry<T>(
  invoke: (messages: ChatMessage[]) => Promise<T>,
  messages: ChatMessage[],
  options: LlmRetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    onRetry,
    shouldRetry = isRetryableLlmError,
    formatErrorFeedback = defaultLlmRetryFeedback
  } = options;

  let lastError: Error | undefined;
  let currentMessages = [...messages];

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await invoke(currentMessages);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }
      onRetry?.(attempt, lastError);
      currentMessages = [
        ...messages,
        {
          role: 'user',
          content: formatErrorFeedback(lastError)
        }
      ];
    }
  }

  throw lastError ?? new Error('LLM retry exhausted without a captured error.');
}
