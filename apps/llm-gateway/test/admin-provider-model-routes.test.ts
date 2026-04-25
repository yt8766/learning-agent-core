import { beforeEach, describe, expect, it } from 'vitest';

import { GET as listModels, POST as createModel } from '../app/api/admin/models/route.js';
import { DELETE as deleteModel, PATCH as patchModel } from '../app/api/admin/models/[id]/route.js';
import { GET as listProviders, POST as createProvider } from '../app/api/admin/providers/route.js';
import { DELETE as deleteProvider, PATCH as patchProvider } from '../app/api/admin/providers/[id]/route.js';
import { POST as rotateCredential } from '../app/api/admin/providers/[id]/credentials/rotate/route.js';
import { createAdminAuthService, setAdminAuthServiceForRoutes } from '../src/auth/admin-auth.js';
import {
  createAdminProviderModelRouteService,
  createMemoryAdminProviderModelStore,
  setAdminProviderModelRouteServiceForRoutes
} from '../src/admin/admin-provider-model-routes.js';
import { createMemoryAdminAuthRepository } from '../src/repositories/admin-auth.js';
import { ProviderSecretVault } from '../src/secrets/provider-secret-vault.js';

const now = '2026-04-25T00:00:00.000Z';

async function seedRoutes() {
  const auth = createAdminAuthService({
    repository: createMemoryAdminAuthRepository(),
    jwtSecret: 'provider-model-route-secret',
    now: () => new Date(now)
  });
  await auth.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
  const tokenPair = await auth.login({ username: 'Owner', password: 'correct-password' });

  setAdminAuthServiceForRoutes(auth);
  setAdminProviderModelRouteServiceForRoutes(
    createAdminProviderModelRouteService({
      store: createMemoryAdminProviderModelStore(),
      vault: new ProviderSecretVault({
        key: 'provider-model-route-test-key-32-bytes',
        keyVersion: 'test-v1'
      }),
      now: () => new Date(now)
    })
  );

  return `Bearer ${tokenPair.accessToken}`;
}

function jsonRequest(path: string, body: unknown, authorization?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {})
    },
    body: JSON.stringify(body)
  });
}

function getRequest(path: string, authorization?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: authorization ? { authorization } : undefined
  });
}

describe('admin provider and model routes', () => {
  beforeEach(() => {
    setAdminProviderModelRouteServiceForRoutes(null);
  });

  it('requires an admin access token before listing providers', async () => {
    await seedRoutes();

    const response = await listProviders(getRequest('/api/admin/providers'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('admin_access_token_missing');
  });

  it('does not require a provider secret unless provider creation includes credentials', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalProviderSecret = process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY;

    try {
      const auth = createAdminAuthService({
        repository: createMemoryAdminAuthRepository(),
        jwtSecret: 'provider-model-route-secret',
        now: () => new Date(now)
      });
      await auth.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
      const tokenPair = await auth.login({ username: 'Owner', password: 'correct-password' });
      const authorization = `Bearer ${tokenPair.accessToken}`;
      setAdminAuthServiceForRoutes(auth);

      const providersResponse = await listProviders(getRequest('/api/admin/providers', authorization));
      expect(providersResponse.status).toBe(200);

      const modelsResponse = await listModels(getRequest('/api/admin/models', authorization));
      expect(modelsResponse.status).toBe(200);

      const providerResponse = await createProvider(
        jsonRequest(
          '/api/admin/providers',
          {
            name: 'OpenAI',
            kind: 'openai',
            status: 'active',
            baseUrl: 'https://api.openai.com/v1',
            timeoutMs: 30000
          },
          authorization
        )
      );
      const providerBody = await providerResponse.json();
      expect(providerResponse.status).toBe(200);

      const credentialResponse = await createProvider(
        jsonRequest(
          '/api/admin/providers',
          {
            name: 'Minimax',
            kind: 'minimax',
            status: 'active',
            baseUrl: 'https://api.minimax.io/v1',
            timeoutMs: 30000,
            plaintextApiKey: 'sk-live-secret-123'
          },
          authorization
        )
      );
      const credentialBody = await credentialResponse.json();

      expect(credentialResponse.status).toBe(503);
      expect(credentialBody.error.code).toBe('admin_provider_secret_not_configured');

      const listAfterFailedCredentialResponse = await listProviders(getRequest('/api/admin/providers', authorization));
      const listAfterFailedCredentialBody = await listAfterFailedCredentialResponse.json();
      expect(listAfterFailedCredentialBody.providers).toEqual([
        expect.objectContaining({ id: providerBody.provider.id, name: providerBody.provider.name })
      ]);
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
      if (originalProviderSecret === undefined) {
        delete process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY;
      } else {
        process.env.LLM_GATEWAY_PROVIDER_SECRET_KEY = originalProviderSecret;
      }
    }
  });

  it('creates providers, stores redacted credentials, and rotates active credentials', async () => {
    const authorization = await seedRoutes();

    const providerResponse = await createProvider(
      jsonRequest(
        '/api/admin/providers',
        {
          name: '  OpenAI  ',
          kind: 'openai',
          status: 'active',
          baseUrl: 'https://api.openai.com/v1/',
          timeoutMs: 30000,
          plaintextApiKey: 'sk-live-secret-123'
        },
        authorization
      )
    );
    const providerBody = await providerResponse.json();

    expect(providerResponse.status).toBe(200);
    expect(providerBody.provider).toMatchObject({
      id: 'provider_openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      credentialId: expect.any(String),
      credentialKeyPrefix: 'sk-live',
      credentialKeyVersion: 'test-v1',
      credentialStatus: 'active',
      credentialRotatedAt: null
    });
    expect(providerBody.provider).not.toHaveProperty('credentials');
    expect(JSON.stringify(providerBody)).not.toContain('sk-live-secret-123');
    expect(JSON.stringify(providerBody)).not.toContain('ciphertext');

    const rotateResponse = await rotateCredential(
      jsonRequest(
        `/api/admin/providers/${providerBody.provider.id}/credentials/rotate`,
        {
          plaintextApiKey: 'sk-new-secret-456'
        },
        authorization
      ),
      { params: { id: providerBody.provider.id } }
    );
    const rotateBody = await rotateResponse.json();

    expect(rotateResponse.status).toBe(200);
    expect(rotateBody.credential).toMatchObject({
      providerId: providerBody.provider.id,
      keyPrefix: 'sk-new-',
      keyVersion: 'test-v1',
      status: 'active'
    });
    expect(JSON.stringify(rotateBody)).not.toContain('sk-new-secret-456');

    const listResponse = await listProviders(getRequest('/api/admin/providers', authorization));
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.providers).toHaveLength(1);
    expect(listBody.providers[0]).toMatchObject({
      credentialKeyPrefix: 'sk-new-',
      credentialStatus: 'active',
      credentialRotatedAt: null
    });
    expect(listBody.providers[0]).not.toHaveProperty('credentials');
    expect(JSON.stringify(listBody)).not.toContain('sk-live-secret-123');
    expect(JSON.stringify(listBody)).not.toContain('sk-new-secret-456');
    expect(JSON.stringify(listBody)).not.toContain('ciphertext');
  });

  it('edits providers, rotates credentials through the provider resource, and soft deletes rows', async () => {
    const authorization = await seedRoutes();

    await createProvider(
      jsonRequest(
        '/api/admin/providers',
        {
          name: 'OpenAI',
          kind: 'openai',
          status: 'active',
          baseUrl: 'https://api.openai.com/v1',
          timeoutMs: 30000,
          plaintextApiKey: 'sk-original-secret'
        },
        authorization
      )
    );

    const patchResponse = await patchProvider(
      jsonRequest(
        '/api/admin/providers/provider_openai',
        {
          name: 'OpenAI edited',
          kind: 'openai-compatible',
          status: 'active',
          baseUrl: 'https://proxy.example.com/v1',
          timeoutMs: 45000,
          plaintextApiKey: 'sk-updated-secret'
        },
        authorization
      ),
      { params: { id: 'provider_openai' } }
    );
    const patched = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patched.provider).toMatchObject({
      id: 'provider_openai',
      name: 'OpenAI edited',
      baseUrl: 'https://proxy.example.com/v1',
      credentialKeyPrefix: 'sk-upda',
      credentialStatus: 'active',
      credentialRotatedAt: null
    });
    expect(patched.provider).not.toHaveProperty('credentials');

    const deleteResponse = await deleteProvider(getRequest('/api/admin/providers/provider_openai', authorization), {
      params: { id: 'provider_openai' }
    });
    const deleted = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleted.provider).toMatchObject({
      id: 'provider_openai',
      status: 'disabled',
      credentialKeyPrefix: 'sk-upda',
      credentialStatus: 'active'
    });
    expect(deleted.provider).not.toHaveProperty('credentials');

    const listResponse = await listProviders(getRequest('/api/admin/providers', authorization));
    const listBody = await listResponse.json();
    expect(listBody.providers).toEqual([
      expect.objectContaining({
        id: 'provider_openai',
        status: 'disabled',
        credentialKeyPrefix: 'sk-upda',
        credentialStatus: 'active'
      })
    ]);
  });

  it('creates, lists, and patches models through the admin model contract', async () => {
    const authorization = await seedRoutes();

    await createProvider(
      jsonRequest(
        '/api/admin/providers',
        {
          name: 'OpenAI',
          kind: 'openai',
          status: 'active',
          baseUrl: 'https://api.openai.com/v1',
          timeoutMs: null
        },
        authorization
      )
    );

    const createResponse = await createModel(
      jsonRequest(
        '/api/admin/models',
        {
          alias: ' GPT_Main ',
          providerId: 'provider_openai',
          providerModel: ' gpt-4.1 ',
          enabled: true,
          contextWindow: '128000',
          inputPricePer1mTokens: '2.5',
          outputPricePer1mTokens: null,
          capabilities: ['chat_completions', 'streaming', 'streaming'],
          fallbackAliases: [' GPT_Cheap ', 'gpt-main'],
          adminOnly: false
        },
        authorization
      )
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(created.model).toMatchObject({
      id: 'model_gpt_main',
      alias: 'gpt-main',
      providerId: 'provider_openai',
      providerModel: 'gpt-4.1',
      contextWindow: 128000,
      inputPricePer1mTokens: 2.5,
      outputPricePer1mTokens: null,
      capabilities: ['chat_completions', 'streaming'],
      fallbackAliases: ['gpt-cheap']
    });

    const patchResponse = await patchModel(
      jsonRequest(
        '/api/admin/models/model_gpt_main',
        {
          alias: 'gpt-main',
          providerId: 'provider_openai',
          providerModel: 'gpt-4.1-mini',
          enabled: false,
          contextWindow: 64000,
          inputPricePer1mTokens: null,
          outputPricePer1mTokens: null,
          capabilities: ['chat_completions', 'json_mode'],
          fallbackAliases: [],
          adminOnly: true
        },
        authorization
      ),
      { params: { id: 'model_gpt_main' } }
    );
    const patched = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patched.model).toMatchObject({
      id: 'model_gpt_main',
      providerModel: 'gpt-4.1-mini',
      enabled: false,
      contextWindow: 64000,
      capabilities: ['chat_completions', 'json_mode'],
      adminOnly: true
    });

    const listResponse = await listModels(getRequest('/api/admin/models', authorization));
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.models).toEqual([patched.model]);
  });

  it('resolves model provider ids from provider slugs before saving models', async () => {
    const authorization = await seedRoutes();

    await createProvider(
      jsonRequest(
        '/api/admin/providers',
        {
          name: 'minimax',
          kind: 'minimax',
          status: 'active',
          baseUrl: 'https://api.minimaxi.com/v1',
          timeoutMs: null
        },
        authorization
      )
    );

    const createResponse = await createModel(
      jsonRequest(
        '/api/admin/models',
        {
          alias: 'MiniMax-M2.7',
          providerId: 'minimax',
          providerModel: 'MiniMax-M2.7',
          enabled: true,
          contextWindow: 204800,
          inputPricePer1mTokens: 2.1,
          outputPricePer1mTokens: 8.4,
          capabilities: ['chat_completions', 'streaming'],
          fallbackAliases: [],
          adminOnly: false
        },
        authorization
      )
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(created.model).toMatchObject({
      id: 'model_minimax_m2_7',
      alias: 'minimax-m2-7',
      providerId: 'provider_minimax',
      providerModel: 'MiniMax-M2.7'
    });
  });

  it('returns a clear error when model provider id cannot be resolved', async () => {
    const authorization = await seedRoutes();

    const response = await createModel(
      jsonRequest(
        '/api/admin/models',
        {
          alias: 'unknown-model',
          providerId: 'missing-provider',
          providerModel: 'unknown-model',
          enabled: true,
          contextWindow: 1000,
          inputPricePer1mTokens: null,
          outputPricePer1mTokens: null,
          capabilities: ['chat_completions'],
          fallbackAliases: [],
          adminOnly: false
        },
        authorization
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('admin_model_provider_not_found');
    expect(body.error.message).toContain('provider_missing_provider');
  });

  it('soft deletes models by disabling them without removing the row', async () => {
    const authorization = await seedRoutes();

    await createProvider(
      jsonRequest(
        '/api/admin/providers',
        {
          name: 'OpenAI',
          kind: 'openai',
          status: 'active',
          baseUrl: 'https://api.openai.com/v1',
          timeoutMs: null
        },
        authorization
      )
    );
    await createModel(
      jsonRequest(
        '/api/admin/models',
        {
          alias: 'gpt-main',
          providerId: 'provider_openai',
          providerModel: 'gpt-4.1',
          enabled: true,
          contextWindow: 128000,
          inputPricePer1mTokens: null,
          outputPricePer1mTokens: null,
          capabilities: ['chat_completions'],
          fallbackAliases: [],
          adminOnly: false
        },
        authorization
      )
    );

    const deleteResponse = await deleteModel(getRequest('/api/admin/models/model_gpt_main', authorization), {
      params: { id: 'model_gpt_main' }
    });
    const deleted = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleted.model).toMatchObject({ id: 'model_gpt_main', enabled: false });

    const listResponse = await listModels(getRequest('/api/admin/models', authorization));
    const listBody = await listResponse.json();
    expect(listBody.models).toEqual([expect.objectContaining({ id: 'model_gpt_main', enabled: false })]);
  });

  it('rejects model create payloads that do not parse through the contract', async () => {
    const authorization = await seedRoutes();

    const response = await createModel(
      jsonRequest(
        '/api/admin/models',
        {
          alias: 'bad alias',
          providerId: '',
          providerModel: '',
          enabled: true,
          contextWindow: 0,
          inputPricePer1mTokens: null,
          outputPricePer1mTokens: null,
          capabilities: ['not_real'],
          fallbackAliases: [],
          adminOnly: false
        },
        authorization
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.type).toBe('admin_provider_model_error');
  });
});
