import type { AdminAuthErrorCode } from '@agent/core';
import { HttpException } from '@nestjs/common';

const adminAuthErrorMessages: Record<AdminAuthErrorCode, string> = {
  invalid_request: '请求参数不正确',
  invalid_credentials: '账号或密码错误',
  account_disabled: '账号已停用',
  account_locked: '账号已锁定，请稍后再试',
  access_token_missing: '未登录，请先登录',
  access_token_expired: '登录状态已过期，正在刷新',
  access_token_invalid: '登录状态无效，请重新登录',
  refresh_token_missing: '登录已过期，请重新登录',
  refresh_token_expired: '登录已过期，请重新登录',
  refresh_token_invalid: '登录已失效，请重新登录',
  session_revoked: '当前会话已退出，请重新登录',
  insufficient_role: '当前账号无权访问该功能',
  internal_error: '服务异常，请稍后再试'
};

const adminAuthHttpStatus: Record<AdminAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_credentials: 401,
  account_disabled: 403,
  account_locked: 423,
  access_token_missing: 401,
  access_token_expired: 401,
  access_token_invalid: 401,
  refresh_token_missing: 401,
  refresh_token_expired: 401,
  refresh_token_invalid: 401,
  session_revoked: 401,
  insufficient_role: 403,
  internal_error: 500
};

export class AdminAuthError extends HttpException {
  readonly code: AdminAuthErrorCode;
  readonly httpStatus: number;

  constructor(code: AdminAuthErrorCode, message = adminAuthErrorMessages[code]) {
    const httpStatus = adminAuthHttpStatus[code];
    super({ error: { code, message } }, httpStatus);
    this.name = 'AdminAuthError';
    this.code = code;
    this.httpStatus = httpStatus;
  }

  toResponse(requestId?: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(requestId ? { requestId } : {})
      }
    };
  }
}

export const adminAuthError = {
  invalidRequest: () => new AdminAuthError('invalid_request'),
  invalidCredentials: () => new AdminAuthError('invalid_credentials'),
  accountDisabled: () => new AdminAuthError('account_disabled'),
  accountLocked: () => new AdminAuthError('account_locked'),
  accessTokenMissing: () => new AdminAuthError('access_token_missing'),
  accessTokenExpired: () => new AdminAuthError('access_token_expired'),
  accessTokenInvalid: () => new AdminAuthError('access_token_invalid'),
  refreshTokenMissing: () => new AdminAuthError('refresh_token_missing'),
  refreshTokenExpired: () => new AdminAuthError('refresh_token_expired'),
  refreshTokenInvalid: () => new AdminAuthError('refresh_token_invalid'),
  sessionRevoked: () => new AdminAuthError('session_revoked'),
  insufficientRole: () => new AdminAuthError('insufficient_role'),
  internalError: () => new AdminAuthError('internal_error')
};
