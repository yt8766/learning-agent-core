import { describe, expect, it } from 'vitest';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewaySystemService', () => {
  it('checks latest version, toggles request log, and exposes clear-login-storage command projection', async () => {
    const service = new AgentGatewaySystemService(new MemoryAgentGatewayManagementClient());

    await expect(service.latestVersion()).resolves.toMatchObject({ latestVersion: expect.any(String) });
    await expect(service.setRequestLogEnabled(true)).resolves.toMatchObject({ requestLog: true });
    await expect(service.clearLoginStorage()).resolves.toMatchObject({ cleared: true });
  });
});
