import { describe, expect, it } from 'vitest';
import { AgentGatewayProviderConfigService } from '../../src/domains/agent-gateway/providers/agent-gateway-provider-config.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayProviderConfigService', () => {
  it('lists and saves provider-specific configs through the management boundary', async () => {
    const service = new AgentGatewayProviderConfigService(new MemoryAgentGatewayManagementClient());

    await expect(service.list()).resolves.toMatchObject({
      items: expect.any(Array)
    });
    await expect(
      service.save({
        providerType: 'openaiCompatible',
        id: 'openai-router',
        displayName: 'OpenAI Router',
        enabled: true,
        baseUrl: 'https://router.example.com/v1',
        models: [{ name: 'gpt-5.4', testModel: 'gpt-5.4' }],
        excludedModels: [],
        credentials: [],
        rawSource: 'adapter'
      })
    ).resolves.toMatchObject({ id: 'openai-router', providerType: 'openaiCompatible' });
  });
});
