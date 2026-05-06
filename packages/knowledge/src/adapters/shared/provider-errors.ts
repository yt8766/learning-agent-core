import { KnowledgeProviderError, type JsonObject } from '../../core';

export function toKnowledgeProviderError(input: {
  providerId: string;
  message: string;
  code?: string;
  retryable?: boolean;
  details?: JsonObject;
  cause?: unknown;
}): KnowledgeProviderError {
  return new KnowledgeProviderError(input.message, {
    providerId: input.providerId,
    code: input.code ?? 'knowledge_provider_call_failed',
    retryable: input.retryable ?? false,
    details: input.details,
    cause: input.cause
  });
}
