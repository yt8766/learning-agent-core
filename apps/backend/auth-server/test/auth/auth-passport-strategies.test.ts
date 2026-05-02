import { describe, expect, it, vi } from 'vitest';

import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { LocalStrategy } from '../../src/auth/strategies/local.strategy';

describe('auth passport strategies', () => {
  it('delegates local username/password validation to AuthService', async () => {
    const user = {
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: '$2b$hash'
    };
    const authService = {
      validateCredentials: vi.fn().mockResolvedValue(user)
    };
    const strategy = new LocalStrategy(authService as never);

    await expect(strategy.validate('admin', 'secret-123')).resolves.toBe(user);
    expect(authService.validateCredentials).toHaveBeenCalledWith('admin', 'secret-123');
  });

  it('projects jwt payloads as authenticated users', () => {
    const strategy = new JwtStrategy();
    const payload = {
      sub: 'user_admin',
      sid: 'sess_1',
      username: 'admin',
      roles: ['admin'],
      status: 'enabled',
      iss: 'auth-server',
      aud: ['agent-admin'],
      exp: 4_102_444_800
    };

    expect(strategy.validate(payload)).toBe(payload);
  });
});
