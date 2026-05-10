import { describe, expect, it } from 'vitest';
import { AgentGatewayClientsController } from '../../src/api/agent-gateway/agent-gateway-clients.controller';
import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';
import { AgentGatewayClientApiKeyService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../src/domains/agent-gateway/clients/agent-gateway-client.service';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';
import { MockAgentGatewayProvider } from '../../src/domains/agent-gateway/providers/mock-agent-gateway-provider';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';
import { AgentGatewayRuntimeAccountingService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { AgentGatewayRelayService } from '../../src/domains/agent-gateway/runtime/agent-gateway-relay.service';

function createClientsController(secretFactory = sequenceSecretFactory()) {
  const repository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
  const apiKeyService = new AgentGatewayClientApiKeyService(repository, secretFactory);
  return {
    controller: new AgentGatewayClientsController(
      new AgentGatewayClientService(repository),
      apiKeyService,
      new AgentGatewayClientQuotaService(repository)
    ),
    apiKeyService,
    repository
  };
}

function sequenceSecretFactory() {
  let sequence = 0;
  return () => {
    sequence += 1;
    return sequence === 1 ? 'agp_live_secret' : `agp_live_secret_${sequence}`;
  };
}

async function createRuntimeController(options: { configureQuota?: boolean } = {}) {
  const { configureQuota = true } = options;
  const clientRepository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
  const clientService = new AgentGatewayClientService(clientRepository, () => new Date('2026-05-10T00:00:00.000Z'));
  const apiKeyService = new AgentGatewayClientApiKeyService(clientRepository, sequenceSecretFactory());
  const quotaService = new AgentGatewayClientQuotaService(clientRepository, () => new Date('2026-05-10T00:00:00.000Z'));
  const client = await clientService.create({ name: 'Runtime App' });
  if (configureQuota) {
    await quotaService.updateQuota(client.id, { tokenLimit: 100, requestLimit: 5, resetAt: '2026-06-01T00:00:00.000Z' });
  }
  const key = await apiKeyService.create(client.id, { name: 'runtime', scopes: ['models.read', 'chat.completions'] });
  const gatewayRepository = new MemoryAgentGatewayRepository();
  return {
    controller: new AgentGatewayOpenAICompatibleController(
      new AgentGatewayRuntimeAuthService(clientRepository),
      new AgentGatewayRelayService(gatewayRepository, [new MockAgentGatewayProvider()]),
      new AgentGatewayRuntimeAccountingService(clientRepository, () => new Date('2026-05-10T00:00:00.000Z'))
    ),
    clientId: client.id,
    repository: clientRepository,
    secret: key.secret
  };
}

describe('AgentGatewayClientsController', () => {
  it('creates clients, creates one-time API keys, and lists only masked key metadata', async () => {
    const { controller } = createClientsController();

    const client = await controller.createClient({
      name: 'Acme App',
      ownerEmail: 'owner@example.com',
      tags: ['internal']
    });

    expect(client).toMatchObject({ id: 'client-acme-app', status: 'active' });

    const createdKey = await controller.createApiKey(client.id, {
      name: 'default',
      scopes: ['models.read', 'chat.completions'],
      expiresAt: null
    });

    expect(createdKey.secret).toBe('agp_live_secret');
    expect(createdKey.apiKey.prefix).toBe('agp_live');
    expect(createdKey.apiKey).not.toHaveProperty('secret');
    expect(createdKey.apiKey).not.toHaveProperty('secretHash');
    expect(JSON.stringify(createdKey).match(/agp_live_secret/g)).toHaveLength(1);

    const listedKey = (await controller.listApiKeys(client.id)).items[0];
    expect(listedKey).not.toHaveProperty('secret');
    expect(listedKey).not.toHaveProperty('secretHash');
  });

  it('keeps same-named API keys isolated across clients', async () => {
    const { controller } = createClientsController();
    const firstClient = await controller.createClient({ name: 'First App' });
    const secondClient = await controller.createClient({ name: 'Second App' });

    const firstKey = await controller.createApiKey(firstClient.id, { name: 'default' });
    const secondKey = await controller.createApiKey(secondClient.id, { name: 'default' });

    expect(firstKey.apiKey.id).not.toBe(secondKey.apiKey.id);
    expect((await controller.listApiKeys(firstClient.id)).items).toHaveLength(1);
    expect((await controller.listApiKeys(secondClient.id)).items).toHaveLength(1);
    expect((await controller.listApiKeys(firstClient.id)).items[0].clientId).toBe(firstClient.id);
    expect((await controller.listApiKeys(secondClient.id)).items[0].clientId).toBe(secondClient.id);
  });

  it('rejects duplicate API key secrets before they can cross client boundaries', async () => {
    const { controller } = createClientsController(() => 'agp_live_duplicate_secret');
    const firstClient = await controller.createClient({ name: 'Duplicate First App' });
    const secondClient = await controller.createClient({ name: 'Duplicate Second App' });

    await expect(controller.createApiKey(firstClient.id, { name: 'default' })).resolves.toMatchObject({
      secret: 'agp_live_duplicate_secret'
    });
    await expect(controller.createApiKey(secondClient.id, { name: 'default' })).rejects.toMatchObject({
      response: { code: 'API_KEY_SECRET_COLLISION' }
    });
  });

  it('enforces API key secret uniqueness at repository write time', async () => {
    const { controller } = createClientsController(() => 'agp_live_concurrent_secret');
    const firstClient = await controller.createClient({ name: 'Concurrent First App' });
    const secondClient = await controller.createClient({ name: 'Concurrent Second App' });

    const results = await Promise.allSettled([
      controller.createApiKey(firstClient.id, { name: 'default' }),
      controller.createApiKey(secondClient.id, { name: 'default' })
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { response: { code: 'API_KEY_SECRET_COLLISION' } } });
    expect((await controller.listApiKeys(firstClient.id)).items.length + (await controller.listApiKeys(secondClient.id)).items.length).toBe(1);
  });

  it('updates client quota and exposes usage defaults', async () => {
    const { controller } = createClientsController();
    const client = await controller.createClient({ name: 'Quota App' });

    const quota = await controller.updateQuota(client.id, {
      tokenLimit: 100,
      requestLimit: 5,
      resetAt: '2026-06-01T00:00:00.000Z'
    });

    expect(quota).toMatchObject({
      clientId: client.id,
      tokenLimit: 100,
      requestLimit: 5,
      status: 'normal'
    });
    expect(await controller.usage(client.id)).toMatchObject({
      clientId: client.id,
      requestCount: 0,
      totalTokens: 0
    });
  });

  it('projects default quota from current usage before explicit quota configuration', async () => {
    const { controller, repository } = createClientsController();
    const client = await controller.createClient({ name: 'Default Quota App' });

    await repository.addUsage(client.id, { requestCount: 10_000, inputTokens: 600_000, outputTokens: 400_000 });

    await expect(controller.quota(client.id)).resolves.toMatchObject({
      clientId: client.id,
      tokenLimit: 1_000_000,
      requestLimit: 10_000,
      usedTokens: 1_000_000,
      usedRequests: 10_000,
      status: 'exceeded'
    });
  });

  it('disables clients and API keys through management routes', async () => {
    const { apiKeyService, controller } = createClientsController();
    const client = await controller.createClient({ name: 'Disable App' });
    const key = await controller.createApiKey(client.id, { name: 'default' });

    expect(await apiKeyService.findActiveBySecret(key.secret)).toMatchObject({ id: key.apiKey.id });
    await expect(controller.disableClient(client.id)).resolves.toMatchObject({ status: 'disabled' });
    await expect(apiKeyService.findActiveBySecret(key.secret)).resolves.toBeNull();
    await controller.enableClient(client.id);
    await expect(controller.updateApiKey(client.id, key.apiKey.id, { status: 'disabled' })).resolves.toMatchObject({
      status: 'disabled'
    });
    await expect(apiKeyService.findActiveBySecret(key.secret)).resolves.toBeNull();
  });

  it('does not rotate disabled or revoked API keys back to active', async () => {
    const { controller } = createClientsController();
    const client = await controller.createClient({ name: 'Rotate App' });
    const disabledKey = await controller.createApiKey(client.id, { name: 'disabled' });
    const revokedKey = await controller.createApiKey(client.id, { name: 'revoked' });

    await controller.updateApiKey(client.id, disabledKey.apiKey.id, { status: 'disabled' });
    await controller.revokeApiKey(client.id, revokedKey.apiKey.id);

    await expect(controller.rotateApiKey(client.id, disabledKey.apiKey.id)).rejects.toMatchObject({
      response: { code: 'API_KEY_NOT_ACTIVE' }
    });
    await expect(controller.rotateApiKey(client.id, revokedKey.apiKey.id)).rejects.toMatchObject({
      response: { code: 'API_KEY_NOT_ACTIVE' }
    });
  });

  it('does not reactivate revoked API keys with the original secret', async () => {
    const { apiKeyService, controller } = createClientsController();
    const client = await controller.createClient({ name: 'Revoked Reactivation App' });
    const key = await controller.createApiKey(client.id, { name: 'default' });

    await controller.revokeApiKey(client.id, key.apiKey.id);

    await expect(controller.updateApiKey(client.id, key.apiKey.id, { status: 'active' })).rejects.toMatchObject({
      response: { code: 'API_KEY_REVOKED' }
    });
    await expect(apiKeyService.findActiveBySecret(key.secret)).resolves.toBeNull();
  });

  it('does not rotate an API key to the same secret', async () => {
    const { controller } = createClientsController(() => 'agp_live_same_secret');
    const client = await controller.createClient({ name: 'Same Secret Rotate App' });
    const key = await controller.createApiKey(client.id, { name: 'default' });

    await expect(controller.rotateApiKey(client.id, key.apiKey.id)).rejects.toMatchObject({
      response: { code: 'API_KEY_SECRET_COLLISION' }
    });
  });

  it('rejects expired API keys and computes quota status from existing usage', async () => {
    const { apiKeyService, controller, repository } = createClientsController();
    const client = await controller.createClient({ name: 'Expired App' });
    const key = await controller.createApiKey(client.id, {
      name: 'expired',
      expiresAt: '2026-05-09T00:00:00.000Z'
    });

    await expect(apiKeyService.findActiveBySecret(key.secret)).resolves.toBeNull();

    await repository.addUsage(client.id, { requestCount: 5, inputTokens: 50, outputTokens: 50 });
    await expect(
      controller.updateQuota(client.id, {
        tokenLimit: 100,
        requestLimit: 10,
        resetAt: '2026-06-01T00:00:00.000Z'
      })
    ).resolves.toMatchObject({ status: 'exceeded', usedTokens: 100, usedRequests: 5 });
  });
});

describe('AgentGatewayOpenAICompatibleController', () => {
  it('lists models through a client API key', async () => {
    const { clientId, controller, repository, secret } = await createRuntimeController();

    await expect(controller.models(`Bearer ${secret}`)).resolves.toMatchObject({
      object: 'list',
      data: [{ id: 'gpt-5.4', object: 'model' }]
    });
    expect(await repository.getUsage(clientId)).toMatchObject({ requestCount: 1 });
    expect(await repository.listRequestLogs(clientId, 10)).toMatchObject([{ endpoint: '/v1/models' }]);
  });

  it('completes chat requests, records usage, and writes request logs', async () => {
    const { clientId, controller, repository, secret } = await createRuntimeController();

    const response = await controller.chatCompletions(`Bearer ${secret}`, {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    });

    expect(response.choices[0].message.content).toContain('mock relay response: ping');
    expect(await repository.getUsage(clientId)).toMatchObject({ requestCount: 1 });
    expect(await repository.listRequestLogs(clientId, 10)).toHaveLength(1);
  });

  it('rejects quota exceeded runtime requests', async () => {
    const { clientId, controller, repository, secret } = await createRuntimeController();
    await repository.addUsage(clientId, { requestCount: 5, inputTokens: 100, outputTokens: 0 });

    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({ status: 429, response: { error: { code: 'quota_exceeded' } } });
  });

  it('enforces default runtime quota before explicit quota configuration', async () => {
    const { clientId, controller, repository, secret } = await createRuntimeController({ configureQuota: false });
    await repository.addUsage(clientId, { requestCount: 10_000, inputTokens: 1_000_000, outputTokens: 0 });

    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({ status: 429, response: { error: { code: 'quota_exceeded' } } });
  });

  it('normalizes relay failures into OpenAI-compatible errors', async () => {
    const { controller, secret } = await createRuntimeController();

    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'unknown-model',
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({
      status: 400,
      response: { error: { code: 'provider_not_found', type: 'invalid_request_error' } }
    });
  });

  it('normalizes raw provider failures into OpenAI-compatible api errors', async () => {
    const clientRepository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
    const clientService = new AgentGatewayClientService(clientRepository, () => new Date('2026-05-10T00:00:00.000Z'));
    const apiKeyService = new AgentGatewayClientApiKeyService(clientRepository, sequenceSecretFactory());
    const client = await clientService.create({ name: 'Raw Error Runtime App' });
    const key = await apiKeyService.create(client.id, { name: 'runtime', scopes: ['chat.completions'] });
    const controller = new AgentGatewayOpenAICompatibleController(
      new AgentGatewayRuntimeAuthService(clientRepository),
      new AgentGatewayRelayService(new MemoryAgentGatewayRepository(), [
        {
          providerId: 'openai-primary',
          complete: async () => {
            throw new Error('vendor timeout');
          }
        }
      ]),
      new AgentGatewayRuntimeAccountingService(clientRepository, () => new Date('2026-05-10T00:00:00.000Z'))
    );

    await expect(
      controller.chatCompletions(`Bearer ${key.secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({
      status: 500,
      response: { error: { code: 'api_error', type: 'api_error', message: 'vendor timeout' } }
    });
  });

  it('rejects streaming explicitly in the first slice', async () => {
    const { controller, secret } = await createRuntimeController();

    await expect(
      controller.chatCompletions(`Bearer ${secret}`, {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'ping' }],
        stream: true
      })
    ).rejects.toMatchObject({ status: 400, response: { error: { code: 'stream_not_supported' } } });
  });
});
