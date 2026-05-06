import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import { AuthServiceError } from '../auth.errors';

interface ErrorResponse {
  status(status: number): ErrorResponse;
  json(body: unknown): void;
}

const AUTH_ERROR_STATUS: Record<string, number> = {
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
  insufficient_role: 403
};

export function toAuthHttpError(error: Pick<AuthServiceError, 'code' | 'message'>) {
  return {
    status: AUTH_ERROR_STATUS[error.code] ?? 400,
    body: {
      error: {
        code: error.code,
        message: error.message,
        requestId: 'auth-server'
      }
    }
  };
}

@Catch(AuthServiceError)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: AuthServiceError, host: ArgumentsHost): void {
    const mapped = toAuthHttpError(exception);
    host.switchToHttp().getResponse<ErrorResponse>().status(mapped.status).json(mapped.body);
  }
}
