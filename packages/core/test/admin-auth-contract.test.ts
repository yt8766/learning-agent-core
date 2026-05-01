import { describe, expect, it } from 'vitest';

import {
  AdminAuthErrorResponseSchema,
  AdminLoginRequestSchema,
  AdminRefreshRequestSchema,
  AdminRoleSchema,
  AdminTokenPairSchema
} from '../src';

describe('@agent/core admin auth contracts', () => {
  it('parses username and password login requests without email semantics', () => {
    const request = AdminLoginRequestSchema.parse({
      username: 'admin.user-01',
      password: 'password123',
      remember: true
    });

    expect(request.username).toBe('admin.user-01');
    expect(request.remember).toBe(true);
  });

  it('rejects invalid login identifiers and short passwords', () => {
    expect(() =>
      AdminLoginRequestSchema.parse({
        username: '',
        password: 'password123'
      })
    ).toThrow();

    expect(() =>
      AdminLoginRequestSchema.parse({
        username: 'admin user',
        password: 'password123'
      })
    ).toThrow();

    expect(() =>
      AdminLoginRequestSchema.parse({
        username: 'admin',
        password: 'short'
      })
    ).toThrow();
  });

  it('does not accept email-only payloads as login requests', () => {
    expect(() =>
      AdminLoginRequestSchema.parse({
        email: 'admin@example.com',
        password: 'password123'
      })
    ).toThrow();
  });

  it('limits admin roles to super admin and developer', () => {
    expect(AdminRoleSchema.parse('super_admin')).toBe('super_admin');
    expect(AdminRoleSchema.parse('developer')).toBe('developer');
    expect(() => AdminRoleSchema.parse('operator')).toThrow();
  });

  it('requires bearer token pairs with access and refresh expirations', () => {
    const tokens = AdminTokenPairSchema.parse({
      tokenType: 'Bearer',
      accessToken: 'access.jwt',
      accessTokenExpiresAt: '2026-04-30T12:15:00.000Z',
      refreshToken: 'refresh.jwt',
      refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
    });

    expect(tokens.tokenType).toBe('Bearer');
    expect(() =>
      AdminTokenPairSchema.parse({
        ...tokens,
        tokenType: 'Basic'
      })
    ).toThrow();
  });

  it('parses standard auth error responses', () => {
    const response = AdminAuthErrorResponseSchema.parse({
      error: {
        code: 'access_token_expired',
        message: '登录状态已过期，正在刷新',
        requestId: 'req_001'
      }
    });

    expect(response.error.code).toBe('access_token_expired');
    expect(() =>
      AdminAuthErrorResponseSchema.parse({
        error: {
          code: 'unknown',
          message: 'unknown'
        }
      })
    ).toThrow();
  });

  it('allows refresh requests to support body token and future cookie mode', () => {
    expect(
      AdminRefreshRequestSchema.parse({
        refreshToken: 'refresh.jwt'
      }).refreshToken
    ).toBe('refresh.jwt');
    expect(AdminRefreshRequestSchema.parse({})).toEqual({});
  });
});
