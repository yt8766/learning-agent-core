import { describe, expect, it } from 'vitest';
import { AgentGatewayOAuthPolicyService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayOAuthPolicyService', () => {
  it('manages aliases, callback polling, Gemini project id, and Vertex import', async () => {
    const service = new AgentGatewayOAuthPolicyService(new MemoryAgentGatewayManagementClient());

    await expect(service.listAliases('gemini')).resolves.toMatchObject({ providerId: 'gemini' });
    await expect(
      service.saveAliases({
        providerId: 'gemini',
        modelAliases: [{ channel: 'gemini-cli', sourceModel: 'gemini-2.5-pro', alias: 'gemini-pro', fork: true }]
      })
    ).resolves.toMatchObject({ modelAliases: [{ fork: true }] });
    await expect(service.status('oauth-state-1')).resolves.toMatchObject({ state: 'oauth-state-1' });
    await expect(
      service.submitCallback({ provider: 'gemini', redirectUrl: 'http://localhost/callback?code=abc' })
    ).resolves.toMatchObject({ accepted: true });
    await expect(service.startGeminiCli({ projectId: 'ALL' })).resolves.toHaveProperty('verificationUri');
    await expect(
      service.importVertexCredential({
        fileName: 'vertex.json',
        contentBase64: 'e30=',
        location: 'us-central1'
      })
    ).resolves.toMatchObject({ imported: true });
  });
});
