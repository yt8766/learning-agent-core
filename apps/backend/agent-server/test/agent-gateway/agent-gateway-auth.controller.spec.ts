import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayAuthController } from '../../src/api/agent-gateway/agent-gateway-auth.controller';
import { AgentGatewayAuthError } from '../../src/domains/agent-gateway/auth/agent-gateway-auth.service';

describe('AgentGatewayAuthController', () => {
  const createController = (authServiceOverrides: Record<string, unknown> = {}) => {
    const authService = {
      login: vi.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: '2026-05-10T01:00:00.000Z',
        refreshTokenExpiresAt: '2026-05-17T00:00:00.000Z',
        refreshTokenStorage: 'localStorage',
        session: {
          user: { id: 'u-1', username: 'admin', displayName: 'Admin', role: 'admin' },
          issuedAt: '2026-05-10T00:00:00.000Z'
        }
      }),
      refresh: vi.fn().mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: '2026-05-10T01:00:00.000Z',
        refreshTokenExpiresAt: '2026-05-17T00:00:00.000Z',
        refreshTokenStorage: 'localStorage',
        session: {
          user: { id: 'u-1', username: 'admin', displayName: 'Admin', role: 'admin' },
          issuedAt: '2026-05-10T00:00:00.000Z'
        }
      }),
      ...authServiceOverrides
    };
    return new AgentGatewayAuthController(authService as never);
  };

  describe('login', () => {
    it('returns login response for valid request', () => {
      const controller = createController();

      const result = controller.login({ username: 'admin', password: 'password' });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('throws BadRequestException for invalid request body', () => {
      const controller = createController();

      expect(() => controller.login(null)).toThrow(BadRequestException);
      expect(() => controller.login({})).toThrow(BadRequestException);
    });

    it('maps AgentGatewayAuthError to UnauthorizedException', () => {
      const controller = createController({
        login: vi.fn().mockImplementation(() => {
          throw new AgentGatewayAuthError('INVALID_CREDENTIALS', 'bad credentials');
        })
      });

      expect(() => controller.login({ username: 'admin', password: 'wrong' })).toThrow(UnauthorizedException);
    });

    it('re-throws non-AgentGatewayAuthError errors', () => {
      const controller = createController({
        login: vi.fn().mockImplementation(() => {
          throw new Error('unexpected');
        })
      });

      expect(() => controller.login({ username: 'admin', password: 'password' })).toThrow('unexpected');
    });
  });

  describe('refresh', () => {
    it('returns refresh response for valid request', () => {
      const controller = createController();

      const result = controller.refresh({ refreshToken: 'valid-refresh-token' });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('throws BadRequestException for invalid request body', () => {
      const controller = createController();

      expect(() => controller.refresh(null)).toThrow(BadRequestException);
    });

    it('maps AgentGatewayAuthError to UnauthorizedException', () => {
      const controller = createController({
        refresh: vi.fn().mockImplementation(() => {
          throw new AgentGatewayAuthError('REFRESH_TOKEN_EXPIRED', 'expired');
        })
      });

      expect(() => controller.refresh({ refreshToken: 'expired-token' })).toThrow(UnauthorizedException);
    });
  });
});
