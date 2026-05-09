import { describe, expect, it } from 'vitest';
import { AgentGatewayApiKeyService } from '../../src/domains/agent-gateway/api-keys/agent-gateway-api-key.service';
import { AgentGatewayConfigFileService } from '../../src/domains/agent-gateway/config/agent-gateway-config-file.service';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { AgentGatewayQuotaDetailService } from '../../src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';

describe('Agent Gateway management services', () => {
  it('delegate raw config operations to the management client', async () => {
    const service = new AgentGatewayConfigFileService(new MemoryAgentGatewayManagementClient());

    await expect(service.readRawConfig()).resolves.toMatchObject({ content: 'debug: true\nrequest-retry: 2\n' });
    await expect(service.diffRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({ changed: true });
    await expect(service.saveRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({
      content: 'debug: false\n',
      version: 'config-2'
    });
    await expect(service.reloadConfig()).resolves.toMatchObject({ reloaded: true });
  });

  it('delegates api key, quota, log, system, and model projections', async () => {
    const client = new MemoryAgentGatewayManagementClient();
    const apiKeys = new AgentGatewayApiKeyService(client);
    const quotas = new AgentGatewayQuotaDetailService(client);
    const logs = new AgentGatewayLogService(client);
    const system = new AgentGatewaySystemService(client);

    await apiKeys.replace({ keys: ['sk-one', 'sk-two'] });
    await apiKeys.update({ keyId: '1', name: 'sk-three' });
    await expect(apiKeys.delete({ index: 0 })).resolves.toMatchObject({
      items: [{ id: 'proxy-key-0', prefix: 'sk-***ree' }]
    });

    await expect(quotas.list()).resolves.toMatchObject({ items: [{ providerId: 'claude' }] });
    await expect(logs.search({ query: 'proxy', hideManagementTraffic: true, limit: 10 })).resolves.toMatchObject({
      items: [{ message: 'proxy request completed' }]
    });
    await expect(logs.tail({ limit: 1 })).resolves.toMatchObject({ items: [{ id: 'log-proxy-1' }] });
    await expect(logs.clear()).resolves.toMatchObject({ cleared: true });
    await expect(system.info()).resolves.toMatchObject({ links: { help: 'https://help.router-for.me/' } });
    await expect(system.models()).resolves.toMatchObject({ groups: [{ providerId: 'openai' }] });
  });
});
