import type { AuthErrorCode } from '@agent/core';

export class IdentityServiceError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'IdentityServiceError';
  }
}
