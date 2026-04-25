import { beforeEach, describe, expect, it } from 'vitest';

import { GET, POST } from '../app/api/admin/keys/route.js';
import { DELETE, PATCH } from '../app/api/admin/keys/[id]/route.js';
import { POST as revoke } from '../app/api/admin/keys/[id]/revoke/route.js';
import { createAdminAuthService, setAdminAuthServiceForRoutes } from '../src/auth/admin-auth.js';
import {
  createMemoryAdminApiKeyStore,
  setAdminApiKeyRouteServiceForRoutes
} from '../src/admin/admin-api-key-routes.js';
import { ApiKeyAdminListResponseSchema, CreateApiKeyResponseSchema } from '../src/contracts/admin-api-key.js';
import { createMemoryAdminAuthRepository } from '../src/repositories/admin-auth.js';
import { createJsonRequest, readJsonResponse } from './helpers/http-test-helpers.js';

const now = '2026-04-25T00:00:00.000Z';

async function seedRoutes() {
  const authService = createAdminAuthService({
    repository: createMemoryAdminAuthRepository(),
    jwtSecret: 'admin-api-key-route-test-secret',
    now: () => new Date(now)
  });
  await authService.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
  setAdminAuthServiceForRoutes(authService);
  setAdminApiKeyRouteServiceForRoutes(
    createMemoryAdminApiKeyStore({
      secret: 'virtual-key-test-secret',
      now: () => new Date(now)
    })
  );
  const tokenPair = await authService.login({ username: 'Owner', password: 'correct-password' });
  return { authorization: `Bearer ${tokenPair.accessToken}` };
}

async function seedAuthOnly() {
  const authService = createAdminAuthService({
    repository: createMemoryAdminAuthRepository(),
    jwtSecret: 'admin-api-key-route-test-secret',
    now: () => new Date(now)
  });
  await authService.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
  setAdminAuthServiceForRoutes(authService);
  const tokenPair = await authService.login({ username: 'Owner', password: 'correct-password' });
  return { authorization: `Bearer ${tokenPair.accessToken}` };
}

function createKeyRequest(authorization: string, name = 'Route key'): Request {
  return createJsonRequest('http://localhost/api/admin/keys', {
    method: 'POST',
    headers: { authorization },
    body: {
      name,
      allowAllModels: false,
      models: ['gpt-main'],
      rpmLimit: 60,
      tpmLimit: null,
      dailyTokenLimit: null,
      dailyCostLimit: null,
      expiresAt: null
    }
  });
}

async function createKey(authorization: string) {
  const response = await POST(createKeyRequest(authorization));
  expect(response.status).toBe(200);
  return CreateApiKeyResponseSchema.parse(await response.json());
}

describe('admin API key routes', () => {
  beforeEach(() => {
    setAdminAuthServiceForRoutes(null);
    setAdminApiKeyRouteServiceForRoutes(null);
  });

  it('rejects list requests without an admin access token', async () => {
    await seedRoutes();

    const response = await GET(createJsonRequest('http://localhost/api/admin/keys'));
    const body = await readJsonResponse<{ error: { code: string } }>(response);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('admin_access_token_missing');
  });

  it('creates a virtual API key and exposes plaintext only in the create response', async () => {
    const { authorization } = await seedRoutes();

    const createBody = await createKey(authorization);
    expect(createBody.plaintext).toMatch(/^sk-llmgw_/);
    expect(createBody.key).not.toHaveProperty('keyHash');

    const listResponse = await GET(
      createJsonRequest('http://localhost/api/admin/keys', {
        headers: { authorization }
      })
    );
    const listBody = ApiKeyAdminListResponseSchema.parse(await listResponse.json());

    expect(listResponse.status).toBe(200);
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]).not.toHaveProperty('plaintext');
    expect(listBody.items[0]).not.toHaveProperty('keyHash');
    expect(JSON.stringify(listBody)).not.toContain(createBody.plaintext);
  });

  it('redacts secret material from list responses', async () => {
    const { authorization } = await seedRoutes();
    await createKey(authorization);

    const response = await GET(
      createJsonRequest('http://localhost/api/admin/keys', {
        headers: { authorization }
      })
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('keyHash');
    expect(JSON.stringify(body)).not.toContain('plaintext');
  });

  it('fails closed for Postgres API key admin routes when the key hash secret is missing', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalKeyHashSecret = process.env.LLM_GATEWAY_KEY_HASH_SECRET;
    const originalLegacySecret = process.env.LLM_GATEWAY_API_KEY_SECRET;
    const { authorization } = await seedAuthOnly();

    process.env.DATABASE_URL = 'postgres://localhost/llm_gateway_test';
    delete process.env.LLM_GATEWAY_KEY_HASH_SECRET;
    delete process.env.LLM_GATEWAY_API_KEY_SECRET;
    setAdminApiKeyRouteServiceForRoutes(null);

    try {
      const response = await POST(createKeyRequest(authorization));
      const body = await readJsonResponse<{ error: { code: string } }>(response);

      expect(response.status).toBe(503);
      expect(body.error.code).toBe('api_key_secret_not_configured');
    } finally {
      setAdminApiKeyRouteServiceForRoutes(null);
      restoreEnv('DATABASE_URL', originalDatabaseUrl);
      restoreEnv('LLM_GATEWAY_KEY_HASH_SECRET', originalKeyHashSecret);
      restoreEnv('LLM_GATEWAY_API_KEY_SECRET', originalLegacySecret);
    }
  });

  it('keeps revoked API keys terminal during patch requests', async () => {
    const { authorization } = await seedRoutes();
    const created = await createKey(authorization);

    const revokeResponse = await revoke(
      createJsonRequest(`http://localhost/api/admin/keys/${created.key.id}/revoke`, {
        method: 'POST',
        headers: { authorization }
      }),
      { params: { id: created.key.id } }
    );
    expect(revokeResponse.status).toBe(200);

    const patchResponse = await PATCH(
      createJsonRequest(`http://localhost/api/admin/keys/${created.key.id}`, {
        method: 'PATCH',
        headers: { authorization },
        body: { name: 'Recovered key' }
      }),
      { params: { id: created.key.id } }
    );
    const patchBody = await readJsonResponse<{ error: { code: string } }>(patchResponse);

    expect(patchResponse.status).toBe(409);
    expect(patchBody.error.code).toBe('api_key_revoked_terminal');
  });

  it('revokes active API keys and redacts the revoke response', async () => {
    const { authorization } = await seedRoutes();
    const created = await createKey(authorization);

    const response = await revoke(
      createJsonRequest(`http://localhost/api/admin/keys/${created.key.id}/revoke`, {
        method: 'POST',
        headers: { authorization }
      }),
      { params: { id: created.key.id } }
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: created.key.id,
      status: 'revoked',
      revokedAt: now
    });
    expect(JSON.stringify(body)).not.toContain('keyHash');
    expect(JSON.stringify(body)).not.toContain('plaintext');
  });

  it('soft deletes API keys through DELETE by revoking them', async () => {
    const { authorization } = await seedRoutes();
    const created = await createKey(authorization);

    const response = await DELETE(
      createJsonRequest(`http://localhost/api/admin/keys/${created.key.id}`, {
        method: 'DELETE',
        headers: { authorization }
      }),
      { params: { id: created.key.id } }
    );
    const body = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: created.key.id, status: 'revoked', revokedAt: now });

    const listResponse = await GET(
      createJsonRequest('http://localhost/api/admin/keys', {
        headers: { authorization }
      })
    );
    const listBody = ApiKeyAdminListResponseSchema.parse(await listResponse.json());
    expect(listBody.items).toEqual([expect.objectContaining({ id: created.key.id, status: 'revoked' })]);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
