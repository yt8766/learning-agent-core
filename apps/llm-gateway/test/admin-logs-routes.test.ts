import { beforeEach, describe, expect, it } from 'vitest';

import { GET as dashboardGET } from '../app/api/admin/dashboard/route.js';
import { GET as logsGET } from '../app/api/admin/logs/route.js';
import { createAdminAuthService, setAdminAuthServiceForRoutes } from '../src/auth/admin-auth.js';
import { createMemoryAdminLogsStore, setAdminLogsRouteServiceForRoutes } from '../src/admin/admin-logs-routes.js';
import { AdminDashboardResponseSchema, AdminRequestLogListResponseSchema } from '../src/contracts/admin-logs.js';
import { createMemoryAdminAuthRepository } from '../src/repositories/admin-auth.js';
import { createJsonRequest, readJsonResponse } from './helpers/http-test-helpers.js';

const now = '2026-04-25T00:00:00.000Z';

async function seedRoutes() {
  const authService = createAdminAuthService({
    repository: createMemoryAdminAuthRepository(),
    jwtSecret: 'admin-logs-route-test-secret',
    now: () => new Date(now)
  });
  await authService.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
  const tokenPair = await authService.login({ username: 'Owner', password: 'correct-password' });
  setAdminAuthServiceForRoutes(authService);
  setAdminLogsRouteServiceForRoutes(
    createMemoryAdminLogsStore({
      logs: [
        log({ id: 'log_success', status: 'success', totalTokens: 100, estimatedCost: 0.002, latencyMs: 200 }),
        log({
          id: 'log_error',
          keyId: 'key_stage',
          model: 'gpt-alt',
          provider: 'minimax',
          status: 'error',
          totalTokens: 20,
          estimatedCost: 0.001,
          latencyMs: 800,
          errorMessage: 'upstream failed with sk-provider-secret'
        })
      ]
    })
  );

  return { authorization: `Bearer ${tokenPair.accessToken}` };
}

describe('admin logs routes', () => {
  beforeEach(() => {
    setAdminAuthServiceForRoutes(null);
    setAdminLogsRouteServiceForRoutes(null);
  });

  it('rejects logs requests without an admin access token', async () => {
    await seedRoutes();

    const response = await logsGET(createJsonRequest('http://localhost/api/admin/logs'));
    const body = await readJsonResponse<{ error: { code: string } }>(response);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('admin_access_token_missing');
  });

  it('filters request logs by key, model, provider, and status while redacting messages', async () => {
    const { authorization } = await seedRoutes();

    const response = await logsGET(
      createJsonRequest('http://localhost/api/admin/logs?keyId=key_stage&model=gpt-alt&provider=minimax&status=error', {
        headers: { authorization }
      })
    );
    const body = AdminRequestLogListResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: 'log_error', keyId: 'key_stage', status: 'error' });
    expect(JSON.stringify(body)).not.toContain('sk-provider-secret');
    expect(body.items[0].errorMessage).toBe('[redacted]');
  });

  it('returns dashboard rollups with matching filters', async () => {
    const { authorization } = await seedRoutes();

    const response = await dashboardGET(
      createJsonRequest('http://localhost/api/admin/dashboard?provider=minimax', {
        headers: { authorization }
      })
    );
    const body = AdminDashboardResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({
      requestCount: 1,
      totalTokens: 20,
      estimatedCost: 0.001,
      failureRate: 1,
      averageLatencyMs: 800
    });
    expect(body.topModels).toEqual([{ model: 'gpt-alt', requestCount: 1, totalTokens: 20, estimatedCost: 0.001 }]);
    expect(body.topKeys[0].keyId).toBe('key_stage');
  });
});

function log(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log_1',
    keyId: 'key_prod',
    requestedModel: 'gpt-main',
    model: 'gpt-main',
    provider: 'openai',
    providerModel: 'gpt-4.1',
    status: 'success',
    promptTokens: 60,
    completionTokens: 40,
    totalTokens: 100,
    estimatedCost: 0.002,
    latencyMs: 200,
    stream: false,
    fallbackAttemptCount: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    ...overrides
  };
}
