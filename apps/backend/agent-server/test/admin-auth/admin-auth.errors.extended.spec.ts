import { describe, expect, it } from 'vitest';

import { AdminAuthError, adminAuthError } from '../../src/admin-auth/admin-auth.errors';

describe('AdminAuthError extended coverage', () => {
  describe('constructor', () => {
    it('sets code and httpStatus correctly for invalid_request', () => {
      const error = new AdminAuthError('invalid_request');
      expect(error.code).toBe('invalid_request');
      expect(error.httpStatus).toBe(400);
    });

    it('sets code and httpStatus correctly for internal_error', () => {
      const error = new AdminAuthError('internal_error', 'Custom error');
      expect(error.code).toBe('internal_error');
      expect(error.httpStatus).toBe(500);
    });

    it('sets name to AdminAuthError', () => {
      const error = new AdminAuthError('invalid_credentials');
      expect(error.name).toBe('AdminAuthError');
    });
  });

  describe('toResponse', () => {
    it('includes requestId when provided', () => {
      const error = new AdminAuthError('access_token_expired');
      const response = error.toResponse('req-123');

      expect(response.error).toMatchObject({
        code: 'access_token_expired',
        requestId: 'req-123'
      });
    });

    it('excludes requestId when not provided', () => {
      const error = new AdminAuthError('access_token_expired');
      const response = error.toResponse();

      expect(response.error).not.toHaveProperty('requestId');
      expect(response.error.code).toBe('access_token_expired');
    });
  });

  describe('all error codes have correct HTTP status', () => {
    const cases: Array<[string, number]> = [
      ['invalid_request', 400],
      ['invalid_credentials', 401],
      ['account_disabled', 403],
      ['account_locked', 423],
      ['access_token_missing', 401],
      ['access_token_expired', 401],
      ['access_token_invalid', 401],
      ['refresh_token_missing', 401],
      ['refresh_token_expired', 401],
      ['refresh_token_invalid', 401],
      ['session_revoked', 401],
      ['insufficient_role', 403],
      ['internal_error', 500]
    ];

    for (const [code, expectedStatus] of cases) {
      it(`maps ${code} to HTTP ${expectedStatus}`, () => {
        const error = new AdminAuthError(code as any);
        expect(error.httpStatus).toBe(expectedStatus);
      });
    }
  });
});

describe('adminAuthError factory', () => {
  it('creates all error types from the factory', () => {
    expect(adminAuthError.invalidRequest()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.invalidRequest().code).toBe('invalid_request');

    expect(adminAuthError.invalidCredentials()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.invalidCredentials().code).toBe('invalid_credentials');

    expect(adminAuthError.accountDisabled()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.accountDisabled().code).toBe('account_disabled');

    expect(adminAuthError.accountLocked()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.accountLocked().code).toBe('account_locked');

    expect(adminAuthError.accessTokenMissing()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.accessTokenMissing().code).toBe('access_token_missing');

    expect(adminAuthError.accessTokenExpired()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.accessTokenExpired().code).toBe('access_token_expired');

    expect(adminAuthError.accessTokenInvalid()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.accessTokenInvalid().code).toBe('access_token_invalid');

    expect(adminAuthError.refreshTokenMissing()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.refreshTokenMissing().code).toBe('refresh_token_missing');

    expect(adminAuthError.refreshTokenExpired()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.refreshTokenExpired().code).toBe('refresh_token_expired');

    expect(adminAuthError.refreshTokenInvalid()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.refreshTokenInvalid().code).toBe('refresh_token_invalid');

    expect(adminAuthError.sessionRevoked()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.sessionRevoked().code).toBe('session_revoked');

    expect(adminAuthError.insufficientRole()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.insufficientRole().code).toBe('insufficient_role');

    expect(adminAuthError.internalError()).toBeInstanceOf(AdminAuthError);
    expect(adminAuthError.internalError().code).toBe('internal_error');
  });
});
