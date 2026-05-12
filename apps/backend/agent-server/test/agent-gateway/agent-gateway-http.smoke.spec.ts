import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayClearLogsResponseSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayRawConfigResponseSchema,
  GatewayRequestLogListResponseSchema,
  GatewaySystemModelsResponseSchema
} from '@agent/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';

describe('Agent Gateway HTTP smoke', () => {
  let app: INestApplication;
  let previousAdminUsername: string | undefined;
  let previousAdminPassword: string | undefined;
  let accessToken: string;

  beforeAll(async () => {
    previousAdminUsername = process.env.IDENTITY_ADMIN_USERNAME;
    previousAdminPassword = process.env.IDENTITY_ADMIN_PASSWORD;
    process.env.IDENTITY_ADMIN_USERNAME = 'gateway-smoke-admin';
    process.env.IDENTITY_ADMIN_PASSWORD = 'gateway-smoke-password';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/identity/login')
      .send({ username: 'gateway-smoke-admin', password: 'gateway-smoke-password', remember: false })
      .expect(201);
    accessToken = login.body.tokens.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    restoreEnv('IDENTITY_ADMIN_USERNAME', previousAdminUsername);
    restoreEnv('IDENTITY_ADMIN_PASSWORD', previousAdminPassword);
  });

  it('requires Identity auth for management endpoints', async () => {
    await request(app.getHttpServer()).get('/api/agent-gateway/dashboard').expect(401);
  });

  it('serves the full management parity surface through schema projections', async () => {
    const agent = request(app.getHttpServer());
    const endpoints = [
      ['GET', '/api/agent-gateway/config/raw', GatewayRawConfigResponseSchema],
      ['GET', '/api/agent-gateway/provider-configs', GatewayProviderSpecificConfigListResponseSchema],
      ['GET', '/api/agent-gateway/auth-files', GatewayAuthFileListResponseSchema],
      ['GET', '/api/agent-gateway/quotas/details', GatewayQuotaDetailListResponseSchema],
      ['GET', '/api/agent-gateway/logs/tail', GatewayRequestLogListResponseSchema],
      ['GET', '/api/agent-gateway/system/models', GatewaySystemModelsResponseSchema]
    ] as const;

    for (const [, path, schema] of endpoints) {
      const response = await agent.get(path).set(authHeader()).expect(200);
      expect(() => schema.parse(response.body), path).not.toThrow();
    }
  });

  it('persists management mutations and returns masked projections', async () => {
    const agent = request(app.getHttpServer());

    const rawConfig = await agent
      .put('/api/agent-gateway/config/raw')
      .set(authHeader())
      .send({ content: 'providers: []\n' })
      .expect(200);
    GatewayRawConfigResponseSchema.parse(rawConfig.body);

    const providerConfig = await agent
      .put('/api/agent-gateway/provider-configs/codex-http-smoke')
      .set(authHeader())
      .send({
        providerType: 'codex',
        displayName: 'Codex HTTP Smoke',
        enabled: true,
        baseUrl: null,
        models: [{ name: 'gpt-5.4', alias: 'gpt-5.4' }],
        excludedModels: [],
        credentials: [
          {
            credentialId: 'codex-http-smoke-key',
            apiKeyMasked: 'sk-...smoke',
            secretRef: 'secret:codex-http-smoke-key',
            status: 'valid'
          }
        ],
        rawSource: 'adapter'
      })
      .expect(200);
    GatewayProviderSpecificConfigRecordSchema.parse(providerConfig.body);

    const authUpload = await agent
      .post('/api/agent-gateway/auth-files')
      .set(authHeader())
      .send({
        files: [
          {
            fileName: 'codex-http-mutation.json',
            contentBase64: Buffer.from(
              JSON.stringify({
                accessToken: 'raw-access-token',
                refreshToken: 'raw-refresh-token',
                apiKey: 'raw-api-key'
              })
            ).toString('base64'),
            providerKind: 'codex'
          }
        ]
      })
      .expect(201);
    GatewayAuthFileBatchUploadResponseSchema.parse(authUpload.body);

    const oauth = await agent
      .post('/api/agent-gateway/oauth/anthropic/start')
      .set(authHeader())
      .send({ isWebui: true, projectId: 'project-1' })
      .expect(201);
    GatewayProviderOAuthStartResponseSchema.parse(oauth.body);

    const quotaRefresh = await agent
      .post('/api/agent-gateway/quotas/details/codex/refresh')
      .set(authHeader())
      .expect(201);
    GatewayQuotaDetailListResponseSchema.parse(quotaRefresh.body);

    const clearLogs = await agent.delete('/api/agent-gateway/logs').set(authHeader()).expect(200);
    GatewayClearLogsResponseSchema.parse(clearLogs.body);

    const providerConfigsReadback = await agent
      .get('/api/agent-gateway/provider-configs')
      .set(authHeader())
      .expect(200);
    GatewayProviderSpecificConfigListResponseSchema.parse(providerConfigsReadback.body);

    const authFilesReadback = await agent
      .get('/api/agent-gateway/auth-files?query=codex-http-mutation')
      .set(authHeader())
      .expect(200);
    GatewayAuthFileListResponseSchema.parse(authFilesReadback.body);

    for (const body of [
      rawConfig.body,
      providerConfig.body,
      authUpload.body,
      oauth.body,
      quotaRefresh.body,
      clearLogs.body,
      providerConfigsReadback.body,
      authFilesReadback.body
    ]) {
      expectSensitiveKeysAbsent(body);
    }
  });

  it('serves the Agent Gateway management read surface through HTTP', async () => {
    const agent = request(app.getHttpServer());

    const dashboard = await agent.get('/api/agent-gateway/dashboard').set(authHeader()).expect(200);
    expect(dashboard.body).toMatchObject({
      connection: expect.objectContaining({ status: expect.any(String) }),
      counts: expect.objectContaining({
        providerCredentials: expect.any(Number),
        availableModels: expect.any(Number)
      })
    });

    const systemModels = await agent.get('/api/agent-gateway/system/models').set(authHeader()).expect(200);
    expect(systemModels.body).toMatchObject({
      groups: expect.any(Array)
    });

    const quotaRefresh = await agent
      .post('/api/agent-gateway/quotas/details/codex/refresh')
      .set(authHeader())
      .expect(201);
    expect(quotaRefresh.body).toMatchObject({
      items: expect.any(Array)
    });

    const authUpload = await agent
      .post('/api/agent-gateway/auth-files')
      .set(authHeader())
      .send({
        files: [
          {
            fileName: 'codex-http-smoke.json',
            contentBase64: Buffer.from(JSON.stringify({ status: 'valid', models: ['gpt-5.4'] })).toString('base64'),
            providerKind: 'codex'
          }
        ]
      })
      .expect(201);
    expect(authUpload.body.accepted).toEqual([
      expect.objectContaining({ fileName: 'codex-http-smoke.json', providerKind: 'codex' })
    ]);

    const authFiles = await agent.get('/api/agent-gateway/auth-files?limit=10').set(authHeader()).expect(200);
    expect(authFiles.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ fileName: 'codex-http-smoke.json' })])
    );
  });

  it('creates a runtime client and one-time API key through HTTP', async () => {
    const agent = request(app.getHttpServer());
    const client = await agent
      .post('/api/agent-gateway/clients')
      .set(authHeader())
      .send({ name: 'HTTP Smoke Client', ownerEmail: 'smoke@example.com', tags: ['http-smoke'] })
      .expect(201);
    expect(client.body).toMatchObject({
      id: expect.any(String),
      name: 'HTTP Smoke Client',
      status: 'active'
    });

    const key = await agent
      .post(`/api/agent-gateway/clients/${client.body.id}/api-keys`)
      .set(authHeader())
      .send({ name: 'HTTP smoke key', scopes: ['models.read', 'chat.completions'] })
      .expect(201);
    expect(key.body).toMatchObject({
      apiKey: expect.objectContaining({ clientId: client.body.id, status: 'active' }),
      secret: expect.stringMatching(/^agp_/)
    });

    const quota = await agent.get(`/api/agent-gateway/clients/${client.body.id}/quota`).set(authHeader()).expect(200);
    expect(quota.body).toMatchObject({
      clientId: client.body.id,
      status: 'normal',
      tokenLimit: expect.any(Number),
      requestLimit: expect.any(Number)
    });
  });

  function authHeader(): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }
});

function expectSensitiveKeysAbsent(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/"accessToken"\s*:/);
  expect(serialized).not.toMatch(/"refreshToken"\s*:/);
  expect(serialized).not.toMatch(/"authorization"\s*:/i);
  expect(serialized).not.toMatch(/"apiKey"\s*:/);
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
