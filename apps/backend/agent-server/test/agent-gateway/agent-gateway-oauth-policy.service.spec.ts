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
    await expect(service.startProviderAuth({ provider: 'codex', isWebui: true })).resolves.toMatchObject({
      state: 'codex-state',
      verificationUri: expect.stringContaining('https://auth.openai.com/oauth/authorize')
    });
    const delegatedServiceForCodex = new AgentGatewayOAuthPolicyService({
      startProviderOAuth: async () => ({
        state: 'codex-state',
        verificationUri:
          'http://localhost:3000/api/agent-gateway/oauth/callback?provider=codex&state=codex-state&is_webui=true'
      })
    } as never);
    await expect(
      delegatedServiceForCodex.startProviderAuth({ provider: 'codex', isWebui: true })
    ).resolves.toMatchObject({
      state: 'codex-state',
      verificationUri: expect.stringContaining('https://auth.openai.com/oauth/authorize')
    });

    const delegatedServiceForAnthropic = new AgentGatewayOAuthPolicyService({
      startProviderOAuth: async () => ({
        state: 'anthropic-state',
        verificationUri:
          'http://localhost:3000/api/agent-gateway/oauth/callback?provider=anthropic&state=anthropic-state&is_webui=true'
      })
    } as never);
    await expect(
      delegatedServiceForAnthropic.startProviderAuth({ provider: 'anthropic', isWebui: true })
    ).resolves.toMatchObject({
      state: 'anthropic-state',
      verificationUri: expect.stringContaining('https://claude.ai/oauth/authorize')
    });
    await expect(service.startGeminiCli({ projectId: 'ALL' })).resolves.toHaveProperty('verificationUri');
    await expect(
      service.importVertexCredential({
        fileName: 'vertex.json',
        contentBase64: 'e30=',
        location: 'us-central1'
      })
    ).resolves.toMatchObject({ imported: true });
  });

  describe('fallback paths (no delegate methods)', () => {
    function createServiceWithFallbackDelegate() {
      const service = new AgentGatewayOAuthPolicyService({} as never);
      return service;
    }

    it('listAliases returns empty aliases for unknown provider', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.listAliases('unknown-provider');

      expect(result.providerId).toBe('unknown-provider');
      expect(result.modelAliases).toEqual([]);
    });

    it('listAliases returns saved aliases after saveAliases', async () => {
      const service = createServiceWithFallbackDelegate();

      await service.saveAliases({
        providerId: 'test-provider',
        modelAliases: [{ channel: 'ch-1', sourceModel: 'model-a', alias: 'alias-a', fork: false }]
      });
      const result = await service.listAliases('test-provider');

      expect(result.modelAliases).toHaveLength(1);
      expect(result.modelAliases[0].alias).toBe('alias-a');
    });

    it('saveAliases clones aliases to avoid mutation', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.saveAliases({
        providerId: 'p1',
        modelAliases: [{ channel: 'ch', sourceModel: 'm1', alias: 'a1', fork: true }]
      });

      expect(result.modelAliases[0].fork).toBe(true);
    });

    it('status returns pending for fallback', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.status('state-123');

      expect(result.state).toBe('state-123');
      expect(result.status).toBe('pending');
    });

    it('submitCallback returns accepted for fallback', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.submitCallback({ provider: 'gemini', redirectUrl: 'http://cb' });

      expect(result.accepted).toBe(true);
      expect(result.provider).toBe('gemini');
    });

    it('startProviderAuth builds fallback provider-native authorization URI with isWebui=false', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.startProviderAuth({ provider: 'claude', isWebui: false });

      expect(result.state).toBe('claude-state');
      expect(result.verificationUri).toContain('https://claude.ai/oauth/authorize');
      expect(result.verificationUri).toContain('client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e');
      expect(result.verificationUri).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback');
      expect(result.verificationUri).not.toContain('/api/agent-gateway/oauth/callback');
      expect(result.verificationUri).not.toContain('api%2Fagent-gateway%2Foauth%2Fcallback');
      expect(result.userCode).toBe('CODE-claude');
    });

    it('startProviderAuth builds fallback Codex URI with isWebui=true', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.startProviderAuth({ provider: 'codex', isWebui: true });

      expect(result.verificationUri).toContain('codex_cli_simplified_flow=true');
      expect(result.verificationUri).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback');
      expect(result.verificationUri).not.toContain('/api/agent-gateway/oauth/callback');
    });

    it('startProviderAuth builds fallback Antigravity URI with Google OAuth redirect', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.startProviderAuth({ provider: 'antigravity', isWebui: true });

      expect(result.verificationUri).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.verificationUri).toContain(
        'client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
      );
      expect(result.verificationUri).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A51121%2Foauth-callback');
      expect(result.verificationUri).not.toContain('/api/agent-gateway/oauth/callback');
    });

    it('startGeminiCli builds fallback URI with project id', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.startGeminiCli({ projectId: 'my-project' });

      expect(result.state).toBe('gemini-cli-my-project');
      expect(result.verificationUri).toContain('my-project');
    });

    it('startGeminiCli uses default project when none provided', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.startGeminiCli({});

      expect(result.state).toBe('gemini-cli-default');
    });

    it('importVertexCredential returns imported true for fallback', async () => {
      const service = createServiceWithFallbackDelegate();

      const result = await service.importVertexCredential({
        fileName: 'cred.json',
        contentBase64: 'e30=',
        location: 'us-east1'
      });

      expect(result.imported).toBe(true);
      expect(result.location).toBe('us-east1');
      expect(result.authFile).toBe('cred.json');
    });
  });
});
