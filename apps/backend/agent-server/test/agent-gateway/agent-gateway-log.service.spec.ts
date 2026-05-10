import { describe, expect, it } from 'vitest';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayLogService', () => {
  it('supports incremental tail, structured filters, by-id download, and error file download', async () => {
    const service = new AgentGatewayLogService(new MemoryAgentGatewayManagementClient());

    await expect(service.tail({ after: '2026-05-08T00:00:00.000Z', limit: 10 })).resolves.toHaveProperty('nextCursor');
    await expect(service.search({ query: 'POST', hideManagementTraffic: true, limit: 10 })).resolves.toMatchObject({
      items: [{ method: 'POST' }]
    });
    await expect(service.downloadRequestLog('log-proxy-1')).resolves.toContain('log-proxy-1');
    await expect(service.downloadRequestErrorFile('request-error-1.log')).resolves.toContain('request-error-1.log');
  });
});
