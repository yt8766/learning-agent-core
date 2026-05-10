import { describe, expect, it } from 'vitest';
import {
  GatewayAccountingResponseSchema,
  GatewayAuthErrorSchema,
  GatewayCompleteOAuthRequestSchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayLoginResponseSchema,
  GatewayRefreshResponseSchema,
  GatewayRelayRequestSchema,
  GatewayRelayResponseSchema,
  GatewayStartOAuthRequestSchema,
  GatewayStartOAuthResponseSchema,
  GatewayUpdateConfigRequestSchema,
  GatewayUpsertProviderRequestSchema,
  GatewaySnapshotSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway contracts', () => {
  it('parses dual-token login responses', () => {
    const response = GatewayLoginResponseSchema.parse({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: '2026-05-07T00:15:00.000Z',
      refreshTokenExpiresAt: '2026-05-14T00:00:00.000Z',
      refreshTokenStorage: 'localStorage',
      session: {
        issuedAt: '2026-05-07T00:00:00.000Z',
        user: { id: 'gateway-admin', username: 'admin', displayName: '管理员', role: 'admin' }
      }
    });

    expect(response.session.user.role).toBe('admin');
  });

  it('parses rotated refresh responses with the replacement refresh token', () => {
    const response = GatewayRefreshResponseSchema.parse({
      accessToken: 'new-access',
      accessTokenExpiresAt: '2026-05-07T00:15:00.000Z',
      refreshToken: 'new-refresh',
      refreshTokenExpiresAt: '2026-05-14T00:00:00.000Z',
      refreshTokenStorage: 'localStorage',
      session: {
        issuedAt: '2026-05-07T00:00:00.000Z',
        user: { id: 'gateway-admin', username: 'admin', displayName: '管理员', role: 'admin' }
      }
    });

    expect(response.refreshToken).toBe('new-refresh');
  });

  it('keeps auth errors explicit for refresh handling', () => {
    expect(GatewayAuthErrorSchema.parse({ code: 'ACCESS_TOKEN_EXPIRED', message: '访问令牌已过期' }).code).toBe(
      'ACCESS_TOKEN_EXPIRED'
    );
  });

  it('parses gateway observability snapshots', () => {
    const snapshot = GatewaySnapshotSchema.parse({
      observedAt: '2026-05-07T00:00:00.000Z',
      runtime: {
        mode: 'proxy',
        status: 'healthy',
        activeProviderCount: 2,
        degradedProviderCount: 1,
        requestPerMinute: 42,
        p95LatencyMs: 810
      },
      config: {
        inputTokenStrategy: 'preprocess',
        outputTokenStrategy: 'postprocess',
        retryLimit: 2,
        circuitBreakerEnabled: true,
        auditEnabled: true
      },
      providerCredentialSets: [],
      credentialFiles: [],
      quotas: []
    });

    expect(snapshot.runtime.mode).toBe('proxy');
  });

  it('parses postprocess accounting totals', () => {
    expect(
      GatewayAccountingResponseSchema.parse({
        providerId: 'openai-primary',
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19
      }).totalTokens
    ).toBe(19);
  });

  it('parses gateway command contracts', () => {
    expect(
      GatewayUpdateConfigRequestSchema.parse({
        retryLimit: 3,
        circuitBreakerEnabled: true,
        auditEnabled: true,
        inputTokenStrategy: 'hybrid',
        outputTokenStrategy: 'provider-reported'
      })
    ).toEqual({
      retryLimit: 3,
      circuitBreakerEnabled: true,
      auditEnabled: true,
      inputTokenStrategy: 'hybrid',
      outputTokenStrategy: 'provider-reported'
    });

    expect(
      GatewayUpsertProviderRequestSchema.parse({
        id: 'openai-primary',
        provider: 'OpenAI',
        modelFamilies: ['gpt-5.4'],
        status: 'healthy',
        priority: 1,
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: 60000,
        secretRef: 'secret://agent-gateway/openai-primary'
      })
    ).toMatchObject({ id: 'openai-primary', secretRef: 'secret://agent-gateway/openai-primary' });
  });

  it('parses relay request and response contracts without vendor payload leakage', () => {
    expect(
      GatewayRelayRequestSchema.parse({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        metadata: { traceId: 'trace-1' }
      })
    ).toMatchObject({ model: 'gpt-main', stream: false });

    expect(
      GatewayRelayResponseSchema.parse({
        id: 'relay-1',
        providerId: 'openai-primary',
        model: 'gpt-main',
        content: 'pong',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        logId: 'log-1'
      })
    ).toMatchObject({ providerId: 'openai-primary', content: 'pong' });
  });

  it('parses OAuth start and completion contracts for credential file lifecycle', () => {
    expect(
      GatewayStartOAuthRequestSchema.parse({
        providerId: 'openai-primary',
        credentialFileId: 'openai-env'
      })
    ).toEqual({ providerId: 'openai-primary', credentialFileId: 'openai-env' });

    expect(
      GatewayStartOAuthResponseSchema.parse({
        flowId: 'oauth-openai-primary-openai-env',
        providerId: 'openai-primary',
        credentialFileId: 'openai-env',
        verificationUri: 'https://gateway.local/oauth/verify/oauth-openai-primary-openai-env',
        userCode: 'CODE-openai-primary-openai-env',
        expiresAt: '2026-05-08T00:15:00.000Z'
      })
    ).toMatchObject({
      flowId: 'oauth-openai-primary-openai-env',
      userCode: 'CODE-openai-primary-openai-env'
    });

    expect(
      GatewayCompleteOAuthRequestSchema.parse({
        flowId: 'oauth-openai-primary-openai-env',
        userCode: 'CODE-openai-primary-openai-env'
      })
    ).toEqual({
      flowId: 'oauth-openai-primary-openai-env',
      userCode: 'CODE-openai-primary-openai-env'
    });

    expect(
      GatewayCompleteOAuthResponseSchema.parse({
        flowId: 'oauth-openai-primary-openai-env',
        providerId: 'openai-primary',
        credentialFileId: 'openai-env',
        status: 'valid',
        completedAt: '2026-05-08T00:05:00.000Z',
        credentialFile: {
          id: 'openai-env',
          provider: 'OpenAI 主通道',
          path: 'apps/backend/agent-server/.env',
          status: 'valid',
          lastCheckedAt: '2026-05-08T00:05:00.000Z'
        }
      })
    ).toMatchObject({ status: 'valid', credentialFileId: 'openai-env' });
  });
});
