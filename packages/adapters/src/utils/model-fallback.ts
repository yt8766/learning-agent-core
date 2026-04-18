import type { AgentModelRole } from '../providers/llm/base/llm-provider.types';

export function shouldFallbackModel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /429|500|502|503|timeout|timed out|stream/i.test(message);
}

export async function withFallbackModel<T>(params: {
  primaryModelId?: string;
  fallbackModelId?: string;
  role: AgentModelRole;
  invoke: (modelId?: string) => Promise<T>;
  onPrimaryFailure?: (error: unknown) => void;
  onFallbackStart?: (fallbackModelId: string, error: unknown) => void;
  onFallbackFailure?: (fallbackModelId: string, error: unknown) => void;
}) {
  try {
    return await params.invoke(params.primaryModelId);
  } catch (error) {
    if (!shouldFallbackModel(error) || !params.fallbackModelId || params.fallbackModelId === params.primaryModelId) {
      params.onPrimaryFailure?.(error);
      return null;
    }

    params.onFallbackStart?.(params.fallbackModelId, error);
    try {
      return await params.invoke(params.fallbackModelId);
    } catch (fallbackError) {
      params.onFallbackFailure?.(params.fallbackModelId, fallbackError);
      return null;
    }
  }
}
