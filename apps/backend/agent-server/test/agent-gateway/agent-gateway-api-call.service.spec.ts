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
});
