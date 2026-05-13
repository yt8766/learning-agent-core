import type { GatewayProviderSpecificConfigRecord } from '@agent/core';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { CliProxyManagementNoStoreInterceptor } from '../../src/api/agent-gateway/cli-proxy-management-cache.interceptor';
import { CliProxyManagementCompatController } from '../../src/api/agent-gateway/cli-proxy-management-compat.controller';
import { CliProxyManagementCompatGuard } from '../../src/api/agent-gateway/cli-proxy-management-compat.guard';
import { CliProxyManagementOperationsCompatController } from '../../src/api/agent-gateway/cli-proxy-management-operations-compat.controller';
import { CliProxyManagementProviderCompatController } from '../../src/api/agent-gateway/cli-proxy-management-provider-compat.controller';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

const createControllers = () => {
  const client = new MemoryAgentGatewayManagementClient();
  return {
    config: new CliProxyManagementCompatController(client),
    operations: new CliProxyManagementOperationsCompatController(client),
    providers: new CliProxyManagementProviderCompatController(client)
  };
};

describe('CliProxyManagementCompatController', () => {
  it('projects the raw config to the CLIProxyAPI management shape used by the web UI', async () => {
    const { config: controller } = createControllers();

    const payload = await controller.getConfig();

    expect(payload).toMatchObject({
      debug: true,
      'request-retry': 2,
      'api-keys': [],
      'request-log': true,
      'logging-to-file': false,
      'quota-exceeded': {
        'switch-project': false,
        'switch-preview-model': false
      }
    });
    expect(Array.isArray(payload['gemini-api-key'])).toBe(true);
  });

  it('implements CLIProxyAPI api-key replacement and deletion semantics', async () => {
    const { config: controller } = createControllers();

    await controller.replaceApiKeys(['sk-one', 'sk-two']);
    expect(await controller.listApiKeys()).toEqual({ 'api-keys': ['sk-***one', 'sk-***two'] });

    await controller.updateApiKey({ index: 1, value: 'sk-three' });
    expect(await controller.listApiKeys()).toEqual({ 'api-keys': ['sk-***one', 'sk-***ree'] });

    await controller.deleteApiKey('0');
    expect(await controller.listApiKeys()).toEqual({ 'api-keys': ['sk-***ree'] });
  });

  it('projects provider configs to the CLIProxyAPI provider endpoint shapes', async () => {
    const { providers: controller } = createControllers();

    expect(await controller.listProviderKeys('gemini-api-key')).toEqual({
      'gemini-api-key': [
        expect.objectContaining({
          'api-key': 'gem***key',
          'base-url': 'https://generativelanguage.googleapis.com/v1beta',
          models: [{ name: 'gemini-2.5-pro', 'test-model': 'gemini-2.5-pro' }]
        })
      ]
    });

    await controller.replaceProviderKeys('claude-api-key', [
      { 'api-key': 'claude-secret', 'base-url': 'https://api.anthropic.com', models: [{ name: 'claude-opus' }] }
    ]);
    const providers = await controller.listProviderKeys('claude-api-key');
    expect(providers['claude-api-key']).toEqual([
      expect.objectContaining({ 'api-key': 'claude-secret', 'base-url': 'https://api.anthropic.com' })
    ]);
  });

  it('projects auth files, logs, and OAuth state to CLIProxyAPI-compatible responses', async () => {
    const { operations: controller } = createControllers();

    const authFiles = await controller.listAuthFiles();
    expect(authFiles.files).toEqual([
      expect.objectContaining({ name: 'memory-gemini.json', provider: 'gemini', status: 'valid' })
    ]);

    const logs = await controller.getLogs();
    expect(logs).toMatchObject({
      'line-count': 2,
      latest_timestamp: expect.any(Number)
    });
    expect(logs.lines[0]).toContain('/v1/chat/completions');

    const authStart = await controller.startProviderOAuth('codex-auth-url', { is_webui: 'true' });
    expect(authStart).toMatchObject({ state: expect.any(String), url: expect.any(String) });

    expect(await controller.getAuthStatus('state-1')).toEqual({
      status: 'wait'
    });
  });

  it('round-trips OpenAI compatibility provider payloads', async () => {
    const { providers: controller } = createControllers();
    const payload: GatewayProviderSpecificConfigRecord[] = [
      {
        providerType: 'openaiCompatible',
        id: 'openai-custom',
        displayName: 'OpenAI Custom',
        enabled: true,
        baseUrl: 'https://api.example.com/v1',
        headers: { 'x-test': 'ok' },
        models: [{ name: 'gpt-custom', alias: 'gpt-custom' }],
        excludedModels: [],
        credentials: [{ credentialId: 'openai-custom-key', apiKeyMasked: 'sk-***tom', status: 'valid' }],
        rawSource: 'config'
      }
    ];

    await controller.replaceOpenAICompatibility(payload);

    expect(await controller.listOpenAICompatibility()).toEqual({
      'openai-compatibility': [
        expect.objectContaining({
          name: 'OpenAI Custom',
          'base-url': 'https://api.example.com/v1',
          'api-key-entries': [{ 'api-key': 'sk-***tom' }]
        })
      ]
    });
  });

  it('can be mounted at the unprefixed /v0/management path used by CLIProxyAPI', async () => {
    let app: INestApplication | undefined;
    try {
      const moduleRef = await Test.createTestingModule({
        controllers: [
          CliProxyManagementCompatController,
          CliProxyManagementOperationsCompatController,
          CliProxyManagementProviderCompatController
        ],
        providers: [
          CliProxyManagementNoStoreInterceptor,
          CliProxyManagementCompatGuard,
          {
            provide: AGENT_GATEWAY_MANAGEMENT_CLIENT,
            useValue: new MemoryAgentGatewayManagementClient()
          }
        ]
      }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api', {
        exclude: [
          { path: 'v0/management', method: RequestMethod.ALL },
          { path: 'v0/management/(.*)', method: RequestMethod.ALL }
        ]
      });
      await app.init();

      const response = await request(app.getHttpServer()).get('/v0/management/config').expect(200);
      expect(response.headers['cache-control']).toContain('no-store');
    } finally {
      await app?.close();
    }
  });
});
