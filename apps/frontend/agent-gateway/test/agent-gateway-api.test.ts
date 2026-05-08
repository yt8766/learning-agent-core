import { describe, expect, it, vi } from 'vitest';
import { AgentGatewayApiClient } from '../src/api/agent-gateway-api';
const snapshot = {
  observedAt: '2026-05-07T00:00:00.000Z',
  runtime: {
    mode: 'proxy',
    status: 'healthy',
    activeProviderCount: 1,
    degradedProviderCount: 0,
    requestPerMinute: 1,
    p95LatencyMs: 100
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
};
describe('AgentGatewayApiClient', () => {
  it('refreshes once when access token expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'ACCESS_TOKEN_EXPIRED' } })
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => snapshot });
    vi.stubGlobal('fetch', fetchMock);
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });
    await expect(client.snapshot()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
