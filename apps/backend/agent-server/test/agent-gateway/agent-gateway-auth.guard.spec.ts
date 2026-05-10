import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayAuthGuard } from '../../src/domains/agent-gateway/auth/agent-gateway-auth.guard';
import type { IdentityAuthService } from '../../src/domains/identity/services/identity-auth.service';

function createContext(authorization?: string): ExecutionContext {
  const request = {
    headers: { authorization }
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

describe('AgentGatewayAuthGuard', () => {
  it('accepts unified Identity access tokens and projects a gateway session', async () => {
    const identityAuth = {
      getCurrentUser: vi.fn(async (accessToken: string) => ({
        account: {
          id: 'user_admin',
          username: 'admin',
          displayName: 'Admin',
          roles: ['admin'],
          status: 'enabled'
        }
      }))
    } as unknown as IdentityAuthService;
    const context = createContext('Bearer identity-access-token');
    const request = context.switchToHttp().getRequest() as { gatewaySession?: unknown };
    const guard = new AgentGatewayAuthGuard(identityAuth);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(identityAuth.getCurrentUser).toHaveBeenCalledWith('identity-access-token');
    expect(request.gatewaySession).toMatchObject({
      user: { id: 'user_admin', username: 'admin', role: 'admin' }
    });
  });

  it('rejects requests without a bearer token', async () => {
    const identityAuth = { getCurrentUser: vi.fn() } as unknown as IdentityAuthService;
    const guard = new AgentGatewayAuthGuard(identityAuth);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
