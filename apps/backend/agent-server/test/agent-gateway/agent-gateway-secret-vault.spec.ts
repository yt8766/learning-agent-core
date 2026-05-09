import { describe, expect, it } from 'vitest';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { MemoryAgentGatewaySecretVault } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';
import { AgentGatewayService } from '../../src/domains/agent-gateway/services/agent-gateway.service';

describe('agent gateway secret boundary', () => {
  it('stores credential file content in the vault and returns only stable projections', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const secretVault = new MemoryAgentGatewaySecretVault();
    const service = new AgentGatewayService(repository, secretVault);

    const projection = await service.upsertCredentialFile({
      id: 'local-env',
      provider: 'Local OpenAI',
      path: 'apps/backend/agent-server/.env.local',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z',
      content: 'OPENAI_API_KEY=sk-secret'
    });

    expect(projection).not.toHaveProperty('content');
    expect(await secretVault.readCredentialFileContent('local-env')).toBe('OPENAI_API_KEY=sk-secret');
  });

  it('removes credential file content from the vault when the projection is deleted', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const secretVault = new MemoryAgentGatewaySecretVault();
    const service = new AgentGatewayService(repository, secretVault);

    await service.upsertCredentialFile({
      id: 'local-env',
      provider: 'Local OpenAI',
      path: 'apps/backend/agent-server/.env.local',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z',
      content: 'OPENAI_API_KEY=sk-secret'
    });
    await service.deleteCredentialFile({ credentialFileId: 'local-env' });

    expect(await secretVault.readCredentialFileContent('local-env')).toBeUndefined();
    expect((await repository.listCredentialFiles()).some(file => file.id === 'local-env')).toBe(false);
  });
});
