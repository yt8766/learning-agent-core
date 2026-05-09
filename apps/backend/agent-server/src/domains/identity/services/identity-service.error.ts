import type { AuthErrorCode } from '@agent/core';
import { HttpException } from '@nestjs/common';

const identityErrorHttpStatus: Record<AuthErrorCode, number> = {
  invalid_request: 400,
  invalid_credentials: 401,
  account_disabled: 403,
  access_token_missing: 401,
  access_token_expired: 401,
  access_token_invalid: 401,
  refresh_token_missing: 401,
  refresh_token_expired: 401,
  refresh_token_invalid: 401,
  refresh_token_reused: 401,
  session_revoked: 401,
  insufficient_role: 403,
  internal_error: 500
};

export class IdentityServiceError extends HttpException {
  readonly httpStatus: number;

  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    const httpStatus = identityErrorHttpStatus[code];
    super({ error: { code, message } }, httpStatus);
    this.name = 'IdentityServiceError';
    this.httpStatus = httpStatus;
  }
}
