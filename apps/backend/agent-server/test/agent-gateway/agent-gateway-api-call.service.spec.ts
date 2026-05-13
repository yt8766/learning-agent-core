import { describe, expect, it } from 'vitest';
import { AgentGatewayApiCallService } from '../../src/domains/agent-gateway/quotas/agent-gateway-api-call.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayApiCallService', () => {
  it('normalizes provider quota payloads through the management api-call boundary', async () => {
    const service = new AgentGatewayApiCallService(new MemoryAgentGatewayManagementClient());

    await expect(
      service.call({
        method: 'GET',
        url: 'https://api.anthropic.com/v1/organizations/usage',
        header: {},
        data: undefined
      })
    ).resolves.toMatchObject({
      statusCode: 200,
      bodyText: expect.stringContaining('/v1/organizations/usage')
    });

    await expect(service.refreshQuotaDetails('claude')).resolves.toMatchObject({
      items: [{ providerId: 'claude', status: 'warning' }]
    });
  });

  it('redacts raw secret fields from management api-call responses', async () => {
    const service = new AgentGatewayApiCallService({
      async listQuotaDetails() {
        return { items: [] };
      },
      async managementApiCall() {
        return {
          statusCode: 200,
          header: {},
          bodyText: '',
          body: {
            accessToken: 'raw-access',
            nested: { apiKey: 'raw-key', visible: 'ok' }
          },
          durationMs: 1
        };
      }
    });

    const response = await service.call({ method: 'GET', path: '/secret-test' });

    expect(response.body).toEqual({ nested: { visible: 'ok' } });
    expect(response.bodyText).not.toContain('raw-access');
    expect(response.bodyText).not.toContain('raw-key');
  });
});
