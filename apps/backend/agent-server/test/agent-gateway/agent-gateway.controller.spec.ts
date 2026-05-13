import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AgentGatewayController } from '../../src/api/agent-gateway/agent-gateway.controller';
import { AgentGatewayOAuthCallbackController } from '../../src/api/agent-gateway/agent-gateway-oauth-callback.controller';
import { AgentGatewayApiKeyService } from '../../src/domains/agent-gateway/api-keys/agent-gateway-api-key.service';
import { AgentGatewayConfigFileService } from '../../src/domains/agent-gateway/config/agent-gateway-config-file.service';
import { AgentGatewayConnectionService } from '../../src/domains/agent-gateway/management/agent-gateway-connection.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { MockAgentGatewayProvider } from '../../src/domains/agent-gateway/providers/mock-agent-gateway-provider';
import { AgentGatewayQuotaDetailService } from '../../src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { AgentGatewayRelayService } from '../../src/domains/agent-gateway/runtime/agent-gateway-relay.service';
import { MemoryAgentGatewaySecretVault } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';
import { AgentGatewayOAuthService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth.service';
import { AgentGatewayService } from '../../src/domains/agent-gateway/services/agent-gateway.service';
import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { AgentGatewaySystemService } from '../../src/domains/agent-gateway/system/agent-gateway-system.service';

describe('AgentGatewayController', () => {
  const createController = () => {
    const repository = new MemoryAgentGatewayRepository();
    const secretVault = new MemoryAgentGatewaySecretVault();
    const managementClient = new MemoryAgentGatewayManagementClient();
    return new AgentGatewayController(
      new AgentGatewayService(repository, secretVault),
      new AgentGatewayRelayService(repository, [new MockAgentGatewayProvider()]),
      new AgentGatewayOAuthService(repository, () => new Date('2026-05-08T00:00:00.000Z')),
      new AgentGatewayConnectionService(managementClient),
      new AgentGatewayConfigFileService(managementClient),
      new AgentGatewayApiKeyService(managementClient),
      new AgentGatewayLogService(managementClient),
      new AgentGatewayQuotaDetailService(managementClient),
      new AgentGatewaySystemService(managementClient)
    );
  };

  it('returns gateway snapshot data', async () => {
    const controller = createController();

    expect((await controller.snapshot()).providerCredentialSets.length).toBeGreaterThan(0);
  });

  it('accepts browser OAuth callback redirects without requiring a gateway access token', async () => {
    const service = {
      submitCallback: async (request: { provider: string; redirectUrl: string }) => ({
        accepted: true,
        provider: request.provider,
        completedAt: '2026-05-10T00:00:00.000Z'
      })
    } as never;
    const controller = new AgentGatewayOAuthCallbackController(service);

    await expect(
      controller.handleCallback({ provider: 'codex', code: 'abc', state: 'codex-state' }, {
        protocol: 'http',
        get: () => 'localhost:3000',
        originalUrl: '/api/agent-gateway/oauth/callback?provider=codex&code=abc&state=codex-state'
      } as never)
    ).resolves.toContain('/oauth?oauthProvider=codex&amp;oauthState=codex-state&amp;oauthStatus=submitted');
  });

  it('normalizes logs list limits', async () => {
    const controller = createController();

    expect((await controller.logs({ limit: '1' })).items).toHaveLength(1);
  });

  it('exposes deterministic management connection, config, logs, and system endpoints', async () => {
    const controller = createController();

    await expect(
      controller.saveConnectionProfile({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKey: 'secret',
        timeoutMs: 15000
      })
    ).resolves.toMatchObject({ managementKeyMasked: 'sec***ret' });
    await expect(controller.checkConnection()).resolves.toMatchObject({ status: 'connected' });

    await expect(controller.rawConfig()).resolves.toMatchObject({ version: 'config-1' });
    await expect(controller.diffRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({ changed: true });
    await expect(controller.saveRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({
      version: 'config-2'
    });
    await expect(controller.reloadConfig()).resolves.toMatchObject({ reloaded: true });

    await controller.replaceApiKeys({ keys: ['sk-one'] });
    await expect(controller.apiKeys()).resolves.toMatchObject({ items: [{ prefix: 'sk-***one' }] });
    await expect(controller.quotaDetails()).resolves.toMatchObject({ items: [{ providerId: 'claude' }] });
    await expect(
      controller.searchLogs({ query: 'proxy', hideManagementTraffic: true, limit: 10 })
    ).resolves.toMatchObject({
      items: [{ message: 'proxy request completed' }]
    });
    await expect(controller.requestErrorFiles()).resolves.toMatchObject({
      items: [{ fileName: 'request-error-1.log' }]
    });
    await expect(controller.systemInfo()).resolves.toMatchObject({ version: 'memory-cli-proxy' });
    await expect(controller.systemModels()).resolves.toMatchObject({ groups: [{ providerId: 'openai' }] });
  });

  it('runs preprocess and postprocess token accounting', () => {
    const controller = createController();

    const preprocess = controller.preprocess({ prompt: ' hello   gateway ' });
    const accounting = controller.accounting({ providerId: 'openai-primary', inputText: 'hello', outputText: 'world' });
    expect(preprocess.normalizedPrompt).toBe('hello gateway');
    expect(accounting.totalTokens).toBe(accounting.inputTokens + accounting.outputTokens);
  });

  it('rejects malformed probe requests', () => {
    const controller = createController();

    expect(() => controller.probe({ providerId: '' })).toThrow(BadRequestException);
  });

  it('persists gateway config updates through the repository boundary', async () => {
    const controller = createController();

    await controller.updateConfig({ retryLimit: 4, auditEnabled: false });
    const snapshot = await controller.snapshot();

    expect(snapshot.config.retryLimit).toBe(4);
    expect(snapshot.config.auditEnabled).toBe(false);
  });

  it('relays requests through the configured relay service', async () => {
    const controller = createController();

    const response = await controller.relay({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    });

    expect(response.providerId).toBe('openai-primary');
    expect(response.content).toBe('mock relay response: ping');
  });

  it('upserts and deletes provider credential sets through controller routes', async () => {
    const controller = createController();

    const provider = await controller.upsertProvider('local-openai', {
      id: 'ignored-id',
      provider: 'Local OpenAI',
      modelFamilies: ['gpt-local'],
      status: 'healthy',
      priority: 0,
      baseUrl: 'mock://local',
      timeoutMs: 30000,
      secretRef: 'vault://local-openai'
    });

    expect(provider).toMatchObject({ id: 'local-openai', provider: 'Local OpenAI' });
    expect(await controller.providers()).toContainEqual(provider);

    await controller.deleteProvider('local-openai');

    expect((await controller.providers()).some(item => item.id === 'local-openai')).toBe(false);
  });

  it('upserts credential files without returning raw secret content', async () => {
    const controller = createController();

    const file = await controller.upsertCredentialFile('local-env', {
      id: 'ignored-id',
      provider: 'Local OpenAI',
      path: 'apps/backend/agent-server/.env.local',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z',
      content: 'OPENAI_API_KEY=sk-secret'
    });

    expect(file).toEqual({
      id: 'local-env',
      provider: 'Local OpenAI',
      path: 'apps/backend/agent-server/.env.local',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z'
    });
    expect('content' in file).toBe(false);
  });

  it('deletes credential files through controller routes', async () => {
    const controller = createController();

    await controller.upsertCredentialFile('local-env', {
      id: 'local-env',
      provider: 'Local OpenAI',
      path: 'apps/backend/agent-server/.env.local',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z'
    });
    await controller.deleteCredentialFile('local-env');

    expect((await controller.credentialFiles()).some(file => file.id === 'local-env')).toBe(false);
  });

  it('patches quota limits through controller routes', async () => {
    const controller = createController();

    const quota = await controller.updateQuota('openai-daily', {
      id: 'ignored-id',
      limitTokens: 750000,
      resetAt: '2026-05-09T00:00:00.000Z',
      status: 'warning'
    });

    expect(quota).toMatchObject({
      id: 'openai-daily',
      provider: 'OpenAI 主通道',
      limitTokens: 750000,
      resetAt: '2026-05-09T00:00:00.000Z',
      status: 'warning'
    });
  });

  it('starts and completes OAuth flows to validate credential files', async () => {
    const controller = createController();

    await controller.upsertCredentialFile('codex-auth.json', {
      provider: 'codex',
      path: '/agent-gateway/auth-files/codex-auth.json',
      status: 'missing',
      lastCheckedAt: '2026-05-07T00:00:00.000Z'
    });

    const start = await controller.startOAuth({
      providerId: 'codex',
      credentialFileId: 'codex-auth.json'
    });

    expect(start).toMatchObject({
      flowId: 'oauth-codex-codex-auth.json',
      providerId: 'codex',
      credentialFileId: 'codex-auth.json',
      userCode: 'CODE-codex-codex-auth.json'
    });

    const complete = await controller.completeOAuth({
      flowId: start.flowId,
      userCode: start.userCode
    });

    expect(complete).toMatchObject({
      flowId: start.flowId,
      status: 'valid',
      credentialFile: {
        id: 'codex-auth.json',
        status: 'valid',
        lastCheckedAt: '2026-05-08T00:00:00.000Z'
      }
    });
    expect(await controller.credentialFiles()).toContainEqual(complete.credentialFile);
  });

  it('rejects OAuth completion when the user code does not match the flow', async () => {
    const controller = createController();

    await controller.upsertCredentialFile('codex-auth.json', {
      provider: 'codex',
      path: '/agent-gateway/auth-files/codex-auth.json',
      status: 'missing',
      lastCheckedAt: '2026-05-07T00:00:00.000Z'
    });
    const start = await controller.startOAuth({
      providerId: 'codex',
      credentialFileId: 'codex-auth.json'
    });

    await expect(controller.completeOAuth({ flowId: start.flowId, userCode: 'WRONG-CODE' })).rejects.toThrow(
      'Gateway OAuth flow code mismatch'
    );
  });
});
