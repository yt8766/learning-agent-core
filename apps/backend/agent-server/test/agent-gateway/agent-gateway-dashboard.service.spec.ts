import { describe, expect, it } from 'vitest';
import { AgentGatewayDashboardService } from '../../src/domains/agent-gateway/dashboard/agent-gateway-dashboard.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';

describe('AgentGatewayDashboardService', () => {
  it('builds a CLI Proxy style dashboard summary from stable projections', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const management = new MemoryAgentGatewayManagementClient();
    await management.saveProfile({
      apiBase: 'https://router.example.com/v0/management',
      managementKey: 'secret',
      timeoutMs: 15000
    });
    await management.replaceApiKeys({ keys: ['sk-one'] });

    const service = new AgentGatewayDashboardService(repository, management);
    const summary = await service.summary();

    expect(summary.connection).toMatchObject({
      status: 'connected',
      apiBase: 'https://router.example.com/v0/management'
    });
    expect(summary.counts.managementApiKeys).toBe(1);
    expect(summary.counts.authFiles).toBeGreaterThan(0);
    expect(summary.providers[0]).toHaveProperty('providerKind');
    expect(summary.routing.strategy).toBeTruthy();
  });
});
