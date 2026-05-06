import type { AuthErrorCode } from '@agent/core';

export class AuthServiceError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}
