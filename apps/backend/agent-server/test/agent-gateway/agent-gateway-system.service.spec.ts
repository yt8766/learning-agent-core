import { describe, expect, it, vi } from 'vitest';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

describe('AgentGatewaySystemService', () => {
  it('checks latest version, toggles request log, and exposes clear-login-storage command projection', async () => {
    const service = new AgentGatewaySystemService(new MemoryAgentGatewayManagementClient());

    await expect(service.latestVersion()).resolves.toMatchObject({ latestVersion: expect.any(String) });
    await expect(service.setRequestLogEnabled(true)).resolves.toMatchObject({ requestLog: true });
    await expect(service.clearLoginStorage()).resolves.toMatchObject({ cleared: true });
  });

  it('uses runtime engine model discovery for the system model list', async () => {
    const service = new AgentGatewaySystemService(new MemoryAgentGatewayManagementClient(), new RuntimeEngineFacade());

    await expect(service.models()).resolves.toEqual({
      groups: [
        {
          providerId: 'runtime',
          providerKind: 'custom',
          models: [
            {
              id: 'gpt-5.4',
              displayName: 'gpt-5.4',
              providerKind: 'custom',
              available: true
            }
          ]
        }
      ]
    });
  });

  it('uses real management model discovery in cli-proxy management mode', async () => {
    const previousMode = process.env.AGENT_GATEWAY_MANAGEMENT_MODE;
    process.env.AGENT_GATEWAY_MANAGEMENT_MODE = 'cli-proxy';
    const managementModels = {
      groups: [
        {
          providerId: 'cli-proxy-openai',
          providerKind: 'openai-compatible',
          models: [
            {
              id: 'gpt-real-from-cli-proxy',
              displayName: 'gpt-real-from-cli-proxy',
              providerKind: 'openai-compatible',
              available: true
            }
          ]
        }
      ]
    };
    const managementClient = {
      systemInfo: () =>
        Promise.resolve({
          version: 'cli-proxy',
          buildDate: null,
          latestVersion: null,
          updateAvailable: false,
          links: {}
        }),
      discoverModels: vi.fn().mockResolvedValue(managementModels)
    };
    const runtimeEngine = {
      listModels: vi.fn().mockResolvedValue({
        object: 'list',
        data: [{ id: 'gpt-fallback', object: 'model', created: 0, owned_by: 'agent-gateway' }]
      })
    } as unknown as RuntimeEngineFacade;

    try {
      const service = new AgentGatewaySystemService(managementClient, runtimeEngine);

      await expect(service.models()).resolves.toEqual(managementModels);
      expect(managementClient.discoverModels).toHaveBeenCalledTimes(1);
      expect(runtimeEngine.listModels).not.toHaveBeenCalled();
    } finally {
      if (previousMode === undefined) delete process.env.AGENT_GATEWAY_MANAGEMENT_MODE;
      else process.env.AGENT_GATEWAY_MANAGEMENT_MODE = previousMode;
    }
  });
});
