import { describe, expect, it } from 'vitest';
import { AgentGatewayOAuthService } from '../../src/domains/agent-gateway/oauth/agent-gateway-oauth.service';
import {
  createDefaultGatewayOAuthProviders,
  type GatewayOAuthHttpClient,
  type GatewayOAuthHttpDeviceTokenRequest,
  type GatewayOAuthHttpExchangeRequest
} from '../../src/domains/agent-gateway/runtime-engine/oauth';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { MemoryAgentGatewaySecretVault } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';

describe('Agent Gateway real OAuth adapter lifecycle', () => {
  it('routes Codex OAuth start/status/callback through provider adapters and stores secrets outside projections', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const vault = new MemoryAgentGatewaySecretVault();
    const service = new AgentGatewayOAuthService(
      repository,
      vault,
      createDefaultGatewayOAuthProviders({
        now: () => new Date('2026-05-11T10:00:00.000Z'),
        publicBaseUrl: 'http://localhost:3000'
      }),
      () => new Date('2026-05-11T10:00:00.000Z')
    );

    const start = await service.start({
      providerId: 'codex',
      credentialFileId: 'codex-auth.json'
    });

    expect(start).toMatchObject({
      flowId: 'oauth-codex-codex-auth.json',
      providerId: 'codex',
      credentialFileId: 'codex-auth.json',
      verificationUri: expect.stringContaining('https://auth.openai.com/oauth/authorize'),
      userCode: 'CODE-codex-codex-auth.json'
    });
    expect(start.verificationUri).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback');
    expect(start.verificationUri).not.toContain('/api/agent-gateway/oauth/callback');
    expect(start.verificationUri).not.toContain('api%2Fagent-gateway%2Foauth%2Fcallback');
    await expect(service.status(start.flowId)).resolves.toMatchObject({ state: start.flowId, status: 'pending' });

    const callback = await service.completeCallback({
      providerId: 'codex',
      state: start.flowId,
      code: 'provider-code-1',
      redirectUrl: `http://localhost:3000/api/agent-gateway/oauth/callback?provider=codex&code=provider-code-1&state=${start.flowId}`
    });

    expect(callback).toMatchObject({
      flowId: start.flowId,
      providerId: 'codex',
      credentialFileId: 'codex-auth.json',
      status: 'valid',
      credentialFile: {
        id: 'codex-auth.json',
        provider: 'codex',
        path: '/agent-gateway/auth-files/codex-auth.json',
        status: 'valid',
        lastCheckedAt: '2026-05-11T10:00:00.000Z'
      }
    });
    await expect(service.status(start.flowId)).resolves.toMatchObject({ state: start.flowId, status: 'completed' });

    const secret = await vault.readCredentialFileContent('codex-auth.json');
    expect(secret).toContain('provider-code-1');
    expect(secret).toContain('refresh_token');
    expect(await vault.readProviderSecretRef('codex')).toBe('vault://agent-gateway/oauth/codex-auth.json');
    expect(JSON.stringify(await repository.listCredentialFiles())).not.toContain('provider-code-1');
    expect(JSON.stringify(callback)).not.toContain('refresh_token');
    expect(JSON.stringify(callback)).not.toContain('access_token');
  });

  it('uses provider-specific status values for expired and error callback outcomes', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const vault = new MemoryAgentGatewaySecretVault();
    const service = new AgentGatewayOAuthService(
      repository,
      vault,
      createDefaultGatewayOAuthProviders({
        now: () => new Date('2026-05-11T10:00:00.000Z'),
        publicBaseUrl: 'http://localhost:3000'
      }),
      () => new Date('2026-05-11T10:16:00.000Z')
    );

    const start = await service.start({ providerId: 'claude', credentialFileId: 'claude-auth.json' });

    await expect(service.status(start.flowId)).resolves.toMatchObject({ state: start.flowId, status: 'expired' });
    await expect(
      service.completeCallback({
        providerId: 'claude',
        state: start.flowId,
        error: 'access_denied',
        redirectUrl: `http://localhost:3000/api/agent-gateway/oauth/callback?provider=claude&error=access_denied&state=${start.flowId}`
      })
    ).resolves.toMatchObject({ status: 'error' });
  });

  it('starts Kimi as a device flow without requiring callback URL input', async () => {
    const service = new AgentGatewayOAuthService(
      new MemoryAgentGatewayRepository(),
      new MemoryAgentGatewaySecretVault(),
      createDefaultGatewayOAuthProviders({
        now: () => new Date('2026-05-11T10:00:00.000Z'),
        publicBaseUrl: 'http://localhost:3000'
      }),
      () => new Date('2026-05-11T10:00:00.000Z')
    );

    const start = await service.start({ providerId: 'kimi', credentialFileId: 'kimi-device.json' });

    expect(start).toMatchObject({
      flowId: 'oauth-kimi-kimi-device.json',
      verificationUri: 'https://kimi.local/device',
      userCode: 'KIMI-kimi-device.json'
    });
  });

  it('exchanges authorization-code callback through the configured OAuth HTTP client without returning raw tokens', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const vault = new MemoryAgentGatewaySecretVault();
    const exchangeRequests: GatewayOAuthHttpExchangeRequest[] = [];
    const httpClient: GatewayOAuthHttpClient = {
      async exchangeAuthorizationCode(request) {
        exchangeRequests.push(request);
        return {
          accessToken: 'real-codex-access',
          refreshToken: 'real-codex-refresh',
          tokenType: 'Bearer',
          expiresIn: 3600,
          scope: 'openid profile codex.gateway',
          accountEmail: 'codex-user@example.com',
          projectId: 'codex-project'
        };
      },
      async startDeviceAuthorization() {
        throw new Error('device start should not be used for Codex authorization-code flow');
      },
      async pollDeviceToken() {
        throw new Error('device poll should not be used for Codex authorization-code flow');
      }
    };
    const service = new AgentGatewayOAuthService(
      repository,
      vault,
      createDefaultGatewayOAuthProviders({
        now: () => new Date('2026-05-11T10:00:00.000Z'),
        publicBaseUrl: 'https://gateway.example.com',
        httpClient,
        providerConfigs: {
          codex: {
            clientId: 'codex-client',
            clientSecret: 'codex-secret',
            authUrl: 'https://login.codex.example/oauth/authorize',
            tokenUrl: 'https://login.codex.example/oauth/token',
            scopes: ['openid', 'profile', 'codex.gateway'],
            publicBaseUrl: 'https://gateway.example.com'
          }
        }
      }),
      () => new Date('2026-05-11T10:00:00.000Z')
    );

    const start = await service.start({ providerId: 'codex', credentialFileId: 'codex-real.json' });

    expect(start.verificationUri).toContain('https://login.codex.example/oauth/authorize');
    expect(start.verificationUri).toContain('client_id=codex-client');
    expect(start.verificationUri).toContain('scope=openid+profile+codex.gateway');
    expect(start.verificationUri).toContain(
      encodeURIComponent('https://gateway.example.com/api/agent-gateway/oauth/callback')
    );

    const callback = await service.completeCallback({
      providerId: 'codex',
      state: start.flowId,
      code: 'real-auth-code',
      redirectUrl: `https://gateway.example.com/api/agent-gateway/oauth/callback?provider=codex&code=real-auth-code&state=${start.flowId}`
    });

    expect(exchangeRequests).toEqual([
      {
        providerId: 'codex',
        tokenUrl: 'https://login.codex.example/oauth/token',
        clientId: 'codex-client',
        clientSecret: 'codex-secret',
        code: 'real-auth-code',
        redirectUri: 'https://gateway.example.com/api/agent-gateway/oauth/callback',
        scopes: ['openid', 'profile', 'codex.gateway']
      }
    ]);
    expect(callback.credentialFile).toMatchObject({
      id: 'codex-real.json',
      provider: 'codex',
      status: 'valid'
    });
    expect(JSON.stringify(callback)).not.toContain('real-codex-access');
    expect(JSON.stringify(callback)).not.toContain('real-codex-refresh');
    expect(JSON.stringify(await repository.listCredentialFiles())).not.toContain('real-codex-access');
    expect(await vault.readCredentialFileContent('codex-real.json')).toContain('real-codex-refresh');
  });

  it('polls Kimi device flow through the configured OAuth HTTP client and stores completed tokens in the vault', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const vault = new MemoryAgentGatewaySecretVault();
    const pollRequests: GatewayOAuthHttpDeviceTokenRequest[] = [];
    const httpClient: GatewayOAuthHttpClient = {
      async exchangeAuthorizationCode() {
        throw new Error('callback exchange should not be used for Kimi device flow');
      },
      async startDeviceAuthorization() {
        return {
          deviceCode: 'kimi-device-code',
          userCode: 'KIMI-999',
          verificationUri: 'https://kimi.example/device',
          expiresIn: 900,
          interval: 5
        };
      },
      async pollDeviceToken(request) {
        pollRequests.push(request);
        return {
          accessToken: 'real-kimi-access',
          refreshToken: 'real-kimi-refresh',
          tokenType: 'Bearer',
          expiresIn: 7200,
          scope: 'openid profile kimi.gateway',
          accountEmail: 'kimi-user@example.com'
        };
      }
    };
    const service = new AgentGatewayOAuthService(
      repository,
      vault,
      createDefaultGatewayOAuthProviders({
        now: () => new Date('2026-05-11T10:00:00.000Z'),
        httpClient,
        providerConfigs: {
          kimi: {
            clientId: 'kimi-client',
            deviceUrl: 'https://kimi.example/oauth/device/code',
            tokenUrl: 'https://kimi.example/oauth/token',
            scopes: ['openid', 'profile', 'kimi.gateway'],
            publicBaseUrl: 'https://gateway.example.com',
            flow: 'device'
          }
        }
      }),
      () => new Date('2026-05-11T10:00:02.000Z')
    );

    const start = await service.start({ providerId: 'kimi', credentialFileId: 'kimi-real.json' });
    expect(start).toMatchObject({
      verificationUri: 'https://kimi.example/device',
      userCode: 'KIMI-999'
    });

    const status = await service.status(start.flowId);

    expect(status).toMatchObject({ state: start.flowId, status: 'completed' });
    expect(pollRequests).toEqual([
      {
        providerId: 'kimi',
        tokenUrl: 'https://kimi.example/oauth/token',
        clientId: 'kimi-client',
        clientSecret: undefined,
        deviceCode: 'kimi-device-code',
        scopes: ['openid', 'profile', 'kimi.gateway']
      }
    ]);
    expect(JSON.stringify(status)).not.toContain('real-kimi-access');
    expect(JSON.stringify(await repository.listCredentialFiles())).not.toContain('real-kimi-access');
    expect(await vault.readCredentialFileContent('kimi-real.json')).toContain('real-kimi-refresh');
  });

  it('keeps provider-specific OAuth flow differences configurable across Codex, Claude, Gemini CLI, Antigravity, and Kimi', async () => {
    const httpClient: GatewayOAuthHttpClient = {
      async exchangeAuthorizationCode() {
        throw new Error('callback exchange is not part of provider start');
      },
      async startDeviceAuthorization(request) {
        return {
          deviceCode: `${request.providerId}-device-code`,
          userCode: `${request.providerId}-user-code`,
          verificationUri: `https://${request.providerId}.example/device`,
          expiresIn: 900
        };
      },
      async pollDeviceToken() {
        throw new Error('device poll is not part of provider start');
      }
    };
    const providers = createDefaultGatewayOAuthProviders({
      now: () => new Date('2026-05-11T10:00:00.000Z'),
      publicBaseUrl: 'https://gateway.example.com',
      httpClient,
      providerConfigs: {
        codex: {
          clientId: 'codex-client',
          authUrl: 'https://codex.example/authorize',
          tokenUrl: 'https://codex.example/token',
          scopes: ['openid', 'offline_access', 'codex.gateway']
        },
        claude: {
          clientId: 'claude-client',
          authUrl: 'https://claude.example/authorize',
          tokenUrl: 'https://claude.example/token',
          scopes: ['openid', 'offline_access', 'claude.gateway']
        },
        'gemini-cli': {
          clientId: 'gemini-client',
          authUrl: 'https://gemini.example/authorize',
          tokenUrl: 'https://gemini.example/token',
          scopes: ['openid', 'offline_access', 'gemini.gateway']
        },
        antigravity: {
          clientId: 'antigravity-client',
          authUrl: 'https://antigravity.example/authorize',
          tokenUrl: 'https://antigravity.example/token',
          scopes: ['openid', 'offline_access', 'antigravity.gateway']
        },
        kimi: {
          clientId: 'kimi-client',
          deviceUrl: 'https://kimi.example/device/code',
          tokenUrl: 'https://kimi.example/token',
          scopes: ['openid', 'offline_access', 'kimi.gateway'],
          flow: 'device'
        }
      }
    });

    for (const providerId of ['codex', 'claude', 'gemini-cli', 'antigravity']) {
      const authHost = providerId === 'gemini-cli' ? 'gemini' : providerId;
      const start = await providers
        .find(provider => provider.providerId === providerId)
        ?.start({ providerId, credentialFileId: `${providerId}.json` });
      expect(start?.verificationUri).toContain(`https://${authHost}.example/authorize`);
      expect(start?.verificationUri).toContain(
        'redirect_uri=https%3A%2F%2Fgateway.example.com%2Fapi%2Fagent-gateway%2Foauth%2Fcallback'
      );
      expect(start?.verificationUri).toContain(`${providerId.replace('-cli', '')}.gateway`);
    }

    const kimiStart = await providers
      .find(provider => provider.providerId === 'kimi')
      ?.start({ providerId: 'kimi', credentialFileId: 'kimi.json' });
    expect(kimiStart?.verificationUri).toBe('https://kimi.example/device');
    expect(kimiStart?.userCode).toBe('kimi-user-code');
    expect(kimiStart?.verificationUri).not.toContain('callback');
  });
});
