import { describe, expect, it } from 'vitest';
import { AgentGatewayProviderConfigService } from '../../src/domains/agent-gateway/providers/agent-gateway-provider-config.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import type { GatewayProviderSpecificConfigRecord } from '@agent/core';

function createConfig(
  overrides: Partial<GatewayProviderSpecificConfigRecord> = {}
): GatewayProviderSpecificConfigRecord {
  return {
    providerType: 'openaiCompatible',
    id: 'openai-router',
    displayName: 'OpenAI Router',
    enabled: true,
    baseUrl: 'https://router.example.com/v1',
    models: [{ name: 'gpt-5.4', testModel: 'gpt-5.4' }],
    excludedModels: [],
    credentials: [],
    rawSource: 'adapter',
    ...overrides
  };
}

describe('AgentGatewayProviderConfigService', () => {
  it('lists and saves provider-specific configs through the management boundary', async () => {
    const service = new AgentGatewayProviderConfigService(new MemoryAgentGatewayManagementClient());

    await expect(service.list()).resolves.toMatchObject({
      items: expect.any(Array)
    });
    await expect(service.save(createConfig())).resolves.toMatchObject({
      id: 'openai-router',
      providerType: 'openaiCompatible'
    });
  });

  describe('fallback paths (no delegate methods)', () => {
    function createServiceWithFallbackDelegate() {
      return new AgentGatewayProviderConfigService({
        discoverModels: () => Promise.resolve({ groups: [] })
      } as never);
    }

    it('list returns empty items initially', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.list();

      expect(result.items).toEqual([]);
    });

    it('save stores config and list returns it', async () => {
      const service = createServiceWithFallbackDelegate();
      const config = createConfig({ id: 'gemini-1', displayName: 'Gemini' });

      await service.save(config);
      const result = await service.list();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('gemini-1');
    });

    it('save clones config to avoid mutation', async () => {
      const service = createServiceWithFallbackDelegate();
      const config = createConfig({
        id: 'test-1',
        credentials: [{ credentialId: 'c1', headers: { 'X-Custom': 'value' }, status: 'valid' }],
        excludedModels: ['model-a'],
        headers: { 'X-Custom': 'value' },
        cloakPolicy: { strictMode: true, sensitiveWords: ['secret'] }
      });

      const result = await service.save(config);

      expect(result.credentials[0].headers).toEqual({ 'X-Custom': 'value' });
      expect(result.excludedModels).toEqual(['model-a']);
      expect(result.headers).toEqual({ 'X-Custom': 'value' });
      expect(result.cloakPolicy?.sensitiveWords).toEqual(['secret']);
    });

    it('save overwrites existing config with same id', async () => {
      const service = createServiceWithFallbackDelegate();

      await service.save(createConfig({ id: 'cfg-1', displayName: 'First' }));
      await service.save(createConfig({ id: 'cfg-1', displayName: 'Second' }));
      const result = await service.list();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].displayName).toBe('Second');
    });

    it('discoverModels delegates to managementClient.discoverModels', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.discoverModels('openai-router');

      expect(result).toEqual({ groups: [] });
    });

    it('testModel returns pending message for fallback', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.testModel('provider-1', 'gpt-4');

      expect(result.ok).toBe(true);
      expect(result.providerId).toBe('provider-1');
      expect(result.message).toContain('pending');
    });
  });
});
