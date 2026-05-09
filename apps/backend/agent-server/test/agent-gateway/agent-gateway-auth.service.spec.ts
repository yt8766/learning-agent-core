import { describe, expect, it } from 'vitest';
import {
  AgentGatewayAuthError,
  AgentGatewayAuthService
} from '../../src/domains/agent-gateway/auth/agent-gateway-auth.service';

describe('AgentGatewayAuthService', () => {
  it('issues dual tokens and verifies access tokens', () => {
    const service = new AgentGatewayAuthService({
      secret: 'test-secret',
      users: [{ username: 'admin', password: 'test-password', displayName: '网关管理员', role: 'admin' }]
    });
    const response = service.login({ username: 'admin', password: 'test-password' });

    expect(response.accessToken).toContain('gateway-access.');
    expect(response.refreshToken).toContain('gateway-refresh.');
    expect(response.refreshTokenStorage).toBe('localStorage');
    expect(service.verifyAccessToken(response.accessToken).user.username).toBe('admin');
  });

  it('rejects invalid credentials with a stable error type', () => {
    const service = new AgentGatewayAuthService({
      secret: 'test-secret',
      users: [{ username: 'admin', password: 'test-password', displayName: '网关管理员', role: 'admin' }]
    });

    expect(() => service.login({ username: 'admin', password: 'wrong' })).toThrow(AgentGatewayAuthError);
  });

  it('refreshes a short access token from a long refresh token', () => {
    const service = new AgentGatewayAuthService({
      secret: 'test-secret',
      users: [{ username: 'admin', password: 'test-password', displayName: '网关管理员', role: 'admin' }]
    });
    const login = service.login({ username: 'admin', password: 'test-password' });

    const refresh = service.refresh(login.refreshToken);

    expect(refresh.session.user.role).toBe('admin');
    expect(refresh.refreshToken).toContain('gateway-refresh.');
    expect(refresh.refreshTokenExpiresAt).toEqual(expect.any(String));
    expect(refresh.refreshTokenStorage).toBe('localStorage');
  });

  it('does not enable default credentials without explicit configuration', () => {
    const service = new AgentGatewayAuthService({ secret: 'test-secret', users: [] });

    expect(() => service.login({ username: 'admin', password: 'admin123' })).toThrow(AgentGatewayAuthError);
  });
});
