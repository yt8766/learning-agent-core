import { describe, expect, it } from 'vitest';

import {
  conflictResource,
  hashImportedApiKey,
  normalizeProviderConfigForImport,
  normalizeAuthFileForImport,
  normalizeApiKeyForImport,
  normalizeRequestLogForImport,
  errorMessage
} from '../../src/domains/agent-gateway/migration/cli-proxy-import.normalizers';

describe('conflictResource', () => {
  it('builds conflict resource preview', () => {
    const result = conflictResource('authFile', 'src-1', 'target-1', 'test.json');
    expect(result).toEqual({
      kind: 'authFile',
      sourceId: 'src-1',
      targetId: 'target-1',
      action: 'conflict',
      safe: false,
      summary: 'test.json'
    });
  });
});

describe('hashImportedApiKey', () => {
  it('generates consistent hash', () => {
    const key = { id: 'key-1', prefix: 'sk-abc' } as any;
    const hash1 = hashImportedApiKey(key);
    const hash2 = hashImportedApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // sha256 hex
  });

  it('generates different hash for different keys', () => {
    const key1 = { id: 'key-1', prefix: 'sk-abc' } as any;
    const key2 = { id: 'key-2', prefix: 'sk-xyz' } as any;
    expect(hashImportedApiKey(key1)).not.toBe(hashImportedApiKey(key2));
  });
});

describe('normalizeProviderConfigForImport', () => {
  it('normalizes valid provider config', () => {
    const result = normalizeProviderConfigForImport({
      id: 'openai',
      providerType: 'gemini',
      displayName: 'OpenAI',
      enabled: true,
      models: [{ name: 'gpt-4', alias: 'GPT-4' }]
    });
    expect(result.id).toBe('openai');
    expect(result.displayName).toBe('OpenAI');
    expect(result.models).toHaveLength(1);
  });

  it('falls back to providerId for id', () => {
    const result = normalizeProviderConfigForImport({ providerId: 'my-provider', providerType: 'gemini' });
    expect(result.id).toBe('my-provider');
  });

  it('falls back to providerType string for id', () => {
    const result = normalizeProviderConfigForImport({ providerType: 'openaiCompatible' });
    expect(result.id).toBe('openaiCompatible');
  });

  it('falls back to "provider" when no id or providerType', () => {
    // GatewayProviderSpecificConfigRecordSchema requires providerType so without it the parse throws
    expect(() => normalizeProviderConfigForImport({})).toThrow();
  });

  it('uses name as displayName fallback', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', name: 'My Provider', providerType: 'gemini' });
    expect(result.displayName).toBe('My Provider');
  });

  it('defaults enabled to true', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini' });
    expect(result.enabled).toBe(true);
  });

  it('handles non-object input by throwing', () => {
    expect(() => normalizeProviderConfigForImport(null)).toThrow();
  });

  it('handles array input by throwing', () => {
    expect(() => normalizeProviderConfigForImport([1, 2, 3])).toThrow();
  });

  it('normalizes model list from strings', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', models: ['gpt-4', 'gpt-3.5'] });
    expect(result.models).toHaveLength(2);
    expect(result.models[0].name).toBe('gpt-4');
  });

  it('normalizes model list from objects', () => {
    const result = normalizeProviderConfigForImport({
      id: 'p1',
      providerType: 'gemini',
      models: [{ name: 'gpt-4', alias: 'GPT-4' }, { model: 'gpt-3.5' }]
    });
    expect(result.models).toHaveLength(2);
    expect(result.models[0].alias).toBe('GPT-4');
  });

  it('falls back to id for model name', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', models: [{}] });
    expect(result.models[0].name).toBe('p1');
  });

  it('returns default model when models is empty', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', models: [] });
    expect(result.models).toHaveLength(1);
    expect(result.models[0].name).toBe('p1');
  });

  it('handles string model items', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', models: ['model-a'] });
    expect(result.models[0]).toEqual({ name: 'model-a' });
  });

  it('handles undefined headers', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini' });
    expect(result.headers).toBeUndefined();
  });

  it('handles non-object headers', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', headers: 'invalid' });
    expect(result.headers).toEqual({});
  });

  it('handles cloakPolicy undefined', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini' });
    expect(result.cloakPolicy).toBeUndefined();
  });

  it('handles non-array credentials', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', credentials: 'invalid' });
    expect(result.credentials).toEqual([]);
  });

  it('handles non-array excludedModels', () => {
    const result = normalizeProviderConfigForImport({ id: 'p1', providerType: 'gemini', excludedModels: 'invalid' });
    expect(result.excludedModels).toEqual([]);
  });

  it('uses alternative field names for baseUrl, proxyUrl', () => {
    const result = normalizeProviderConfigForImport({
      id: 'p1',
      providerType: 'gemini',
      base_url: 'http://api.com',
      proxy_url: 'http://proxy.com'
    });
    expect(result.baseUrl).toBe('http://api.com');
    expect(result.proxyUrl).toBe('http://proxy.com');
  });
});

describe('normalizeAuthFileForImport', () => {
  it('passes through valid auth file', () => {
    const valid = {
      id: 'auth-1',
      providerId: 'gemini',
      providerKind: 'gemini',
      fileName: 'gemini-auth.json',
      path: '/auth/gemini-auth.json',
      status: 'valid',
      accountEmail: 'user@example.com',
      projectId: 'proj-1',
      modelCount: 3,
      updatedAt: '2026-05-01T00:00:00.000Z',
      metadata: {}
    };
    const result = normalizeAuthFileForImport(valid);
    expect(result.id).toBe('auth-1');
  });

  it('falls back to fileName when id missing', () => {
    const result = normalizeAuthFileForImport({ fileName: 'test.json', providerKind: 'gemini' });
    expect(result.id).toBe('test.json');
  });

  it('falls back to "auth.json" when fileName missing', () => {
    const result = normalizeAuthFileForImport({});
    expect(result.fileName).toBe('auth.json');
    expect(result.id).toBe('auth.json');
  });

  it('uses name as fileName fallback', () => {
    const result = normalizeAuthFileForImport({ name: 'my-auth.json' });
    expect(result.fileName).toBe('my-auth.json');
  });

  it('uses providerId as providerKind fallback', () => {
    const result = normalizeAuthFileForImport({ providerId: 'codex' });
    expect(result.providerKind).toBe('codex');
  });

  it('defaults providerKind to custom when no providerId', () => {
    const result = normalizeAuthFileForImport({});
    expect(result.providerKind).toBe('custom');
  });

  it('handles non-object input', () => {
    const result = normalizeAuthFileForImport('invalid');
    expect(result.fileName).toBe('auth.json');
  });
});

describe('normalizeApiKeyForImport', () => {
  it('passes through valid API key', () => {
    const valid = {
      id: 'key-1',
      name: 'My Key',
      prefix: 'sk-abc',
      status: 'active',
      scopes: ['proxy:invoke'],
      createdAt: '2026-05-01T00:00:00.000Z',
      lastUsedAt: null,
      expiresAt: null,
      usage: { requestCount: 10, lastRequestAt: null }
    };
    const result = normalizeApiKeyForImport(valid, 0);
    expect(result.id).toBe('key-1');
    expect(result.status).toBe('active');
  });

  it('falls back to generated id and name', () => {
    const result = normalizeApiKeyForImport({}, 2);
    expect(result.id).toBe('proxy-key-2');
    expect(result.name).toBe('Proxy key 3');
  });

  it('uses disabled field to set status', () => {
    const result = normalizeApiKeyForImport({ disabled: true }, 0);
    expect(result.status).toBe('disabled');
  });

  it('falls back to "active" when no status or disabled', () => {
    const result = normalizeApiKeyForImport({}, 0);
    expect(result.status).toBe('active');
  });

  it('uses alternative prefix field names', () => {
    const result1 = normalizeApiKeyForImport({ masked: '***abc' }, 0);
    expect(result1.prefix).toBe('***abc');

    const result2 = normalizeApiKeyForImport({ maskedApiKey: '***xyz' }, 0);
    expect(result2.prefix).toBe('***xyz');

    const result3 = normalizeApiKeyForImport({ masked_api_key: '***123' }, 0);
    expect(result3.prefix).toBe('***123');
  });

  it('defaults prefix to ***', () => {
    const result = normalizeApiKeyForImport({}, 0);
    expect(result.prefix).toBe('***');
  });

  it('handles non-object input', () => {
    const result = normalizeApiKeyForImport(null, 0);
    expect(result.id).toBe('proxy-key-0');
  });

  it('uses alternative date field names', () => {
    const result = normalizeApiKeyForImport(
      {
        created_at: '2026-01-01T00:00:00.000Z',
        last_used_at: '2026-02-01T00:00:00.000Z',
        expires_at: '2027-01-01T00:00:00.000Z'
      },
      0
    );
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('handles non-array scopes', () => {
    const result = normalizeApiKeyForImport({ scopes: 'invalid' }, 0);
    expect(result.scopes).toEqual(['proxy:invoke']);
  });

  it('handles non-object usage', () => {
    const result = normalizeApiKeyForImport({ usage: 'invalid' }, 0);
    expect(result.usage.requestCount).toBe(0);
  });

  it('uses alternative usage field names', () => {
    const result = normalizeApiKeyForImport({ usage: { requests: 5, last_request_at: '2026-05-01' } }, 0);
    expect(result.usage.requestCount).toBe(5);
    expect(result.usage.lastRequestAt).toBe('2026-05-01');
  });

  it('falls back to lastUsedAt for usage.lastRequestAt', () => {
    const result = normalizeApiKeyForImport({ lastUsedAt: '2026-05-01' }, 0);
    expect(result.usage.lastRequestAt).toBe('2026-05-01');
  });
});

describe('normalizeRequestLogForImport', () => {
  it('passes through valid log entry', () => {
    const valid = {
      id: 'log-1',
      occurredAt: '2026-05-01T00:00:00.000Z',
      method: 'POST',
      path: '/v1/chat/completions',
      statusCode: 200,
      durationMs: 150,
      managementTraffic: false,
      providerId: 'openai',
      apiKeyPrefix: 'sk-abc',
      message: 'Request completed'
    };
    const result = normalizeRequestLogForImport(valid);
    expect(result.id).toBe('log-1');
  });

  it('falls back to defaults for missing fields', () => {
    const result = normalizeRequestLogForImport({});
    expect(result.id).toBe('request-log');
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/');
    expect(result.statusCode).toBe(200);
    expect(result.durationMs).toBe(0);
    expect(result.managementTraffic).toBe(false);
  });

  it('handles non-object input', () => {
    const result = normalizeRequestLogForImport(null);
    expect(result.id).toBe('request-log');
  });

  it('uses alternative field names', () => {
    const result = normalizeRequestLogForImport({
      timestamp: '2026-05-01T00:00:00.000Z',
      url: '/api/test',
      status: 404,
      duration_ms: 50,
      management_traffic: true,
      provider_id: 'gemini',
      api_key_prefix: 'key-123'
    });
    expect(result.path).toBe('/api/test');
    expect(result.statusCode).toBe(404);
    expect(result.durationMs).toBe(50);
    expect(result.managementTraffic).toBe(true);
    expect(result.providerId).toBe('gemini');
    expect(result.apiKeyPrefix).toBe('key-123');
  });
});

describe('errorMessage', () => {
  it('extracts message from Error', () => {
    expect(errorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns default for non-Error', () => {
    expect(errorMessage('string')).toBe('import failed');
    expect(errorMessage(null)).toBe('import failed');
    expect(errorMessage(undefined)).toBe('import failed');
    expect(errorMessage(42)).toBe('import failed');
  });
});
