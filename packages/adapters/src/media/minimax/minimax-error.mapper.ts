import type { MediaProviderError } from '@agent/core';

const RETRYABLE_MINIMAX_ERROR_CODES = new Set(['rate_limit', 'timeout', 'temporarily_unavailable']);

export interface MiniMaxErrorMapperInput {
  readonly code: string;
  readonly message: string;
}

export function mapMiniMaxError(input: MiniMaxErrorMapperInput): MediaProviderError {
  return {
    code: input.code,
    message: input.message,
    provider: 'minimax',
    retryable: RETRYABLE_MINIMAX_ERROR_CODES.has(input.code)
  };
}
