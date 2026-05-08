import { describe, expect, it } from 'vitest';
import {
  GatewayAccountingResponseSchema,
  GatewayAuthErrorSchema,
  GatewayLoginResponseSchema,
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
});
