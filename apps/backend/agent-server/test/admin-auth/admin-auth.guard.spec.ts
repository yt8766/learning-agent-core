import { describe, expect, it, vi } from 'vitest';

import { AdminAuthGuard } from '../../src/admin-auth/admin-auth.guard';
import { AdminAuthError } from '../../src/admin-auth/admin-auth.errors';

describe('AdminAuthGuard', () => {
  const createContext = (headers: Record<string, string | undefined>) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers })
      })
    } as never;
  };

  const createService = (verifyResult?: unknown) => ({
    verifyAccessToken: verifyResult
      ? vi.fn().mockResolvedValue(verifyResult)
      : vi.fn().mockRejectedValue(new Error('not implemented'))
  });

  it('throws access_token_missing when Authorization header is absent', async () => {
    const guard = new AdminAuthGuard(createService() as never);

    await expect(guard.canActivate(createContext({}))).rejects.toThrow(AdminAuthError);
    await expect(guard.canActivate(createContext({}))).rejects.toMatchObject({
      code: 'access_token_missing'
    });
  });

  it('throws access_token_missing when Authorization header is not a string', async () => {
    const guard = new AdminAuthGuard(createService() as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: undefined } })
      })
    } as never;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'access_token_missing'
    });
  });

  it('throws access_token_invalid when Authorization header does not start with Bearer', async () => {
    const guard = new AdminAuthGuard(createService() as never);

    await expect(guard.canActivate(createContext({ authorization: 'Basic abc123' }))).rejects.toMatchObject({
      code: 'access_token_invalid'
    });
  });

  it('throws access_token_invalid when Bearer token is empty', async () => {
    const guard = new AdminAuthGuard(createService() as never);

    await expect(guard.canActivate(createContext({ authorization: 'Bearer ' }))).rejects.toMatchObject({
      code: 'access_token_invalid'
    });
  });

  it('verifies the token and sets adminPrincipal on the request', async () => {
    const principal = { accountId: 'acc-1', username: 'admin', sessionId: 'sess-1' };
    const service = createService(principal);
    const request = { headers: { authorization: 'Bearer valid-token' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as never;

    const guard = new AdminAuthGuard(service as never);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect((request as Record<string, unknown>).adminPrincipal).toBe(principal);
  });
});
