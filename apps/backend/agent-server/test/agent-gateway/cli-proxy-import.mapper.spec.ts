import { describe, expect, it } from 'vitest';

import {
  mapProviderConfigToLocalProvider,
  mapAuthFileToCredentialFile,
  mapQuotaDetailToLocalQuota,
  mapRequestLogToLocalLog,
  mapApiKeyToImportedClientApiKey,
  parseRawConfigPatch
} from '../../src/domains/agent-gateway/migration/cli-proxy-import.mapper';

describe('mapProviderConfigToLocalProvider', () => {
  it('maps enabled config to healthy status', () => {
    const result = mapProviderConfigToLocalProvider({
      id: 'gemini',
      displayName: 'Gemini',
      enabled: true,
      models: [{ name: 'gemini-pro', alias: 'Gemini Pro' }, { name: 'gemini-flash' }],
      priority: 10,
      baseUrl: 'https://api.gemini.com',
      providerType: 'gemini'
    } as any);
    expect(result.id).toBe('gemini');
    expect(result.provider).toBe('Gemini');
    expect(result.modelFamilies).toEqual(['Gemini Pro', 'gemini-flash']);
    expect(result.status).toBe('healthy');
    expect(result.priority).toBe(10);
    expect(result.baseUrl).toBe('https://api.gemini.com');
    expect(result.timeoutMs).toBe(60000);
  });

  it('maps disabled config to disabled status', () => {
    const result = mapProviderConfigToLocalProvider({
      id: 'p1',
      displayName: 'P1',
      enabled: false,
      models: [{ name: 'm1' }],
      providerType: 'gemini'
    } as any);
    expect(result.status).toBe('disabled');
  });

  it('defaults priority to 50', () => {
    const result = mapProviderConfigToLocalProvider({
      id: 'p1',
      displayName: 'P1',
      enabled: true,
      models: [{ name: 'm1' }],
      providerType: 'gemini'
    } as any);
    expect(result.priority).toBe(50);
  });

  it('uses model name when alias is missing', () => {
    const result = mapProviderConfigToLocalProvider({
      id: 'p1',
      displayName: 'P1',
      enabled: true,
      models: [{ name: 'gpt-4' }],
      providerType: 'gemini'
    } as any);
    expect(result.modelFamilies).toEqual(['gpt-4']);
  });
});

describe('mapAuthFileToCredentialFile', () => {
  it('maps valid auth file to valid status', () => {
    const result = mapAuthFileToCredentialFile({
      id: 'auth-1',
      providerKind: 'gemini',
      path: '/auth/gemini.json',
      status: 'valid',
      updatedAt: '2026-05-01T00:00:00.000Z',
      providerId: 'gemini',
      fileName: 'gemini.json',
      modelCount: 3,
      metadata: {}
    });
    expect(result.id).toBe('auth-1');
    expect(result.provider).toBe('gemini');
    expect(result.path).toBe('/auth/gemini.json');
    expect(result.status).toBe('valid');
    expect(result.lastCheckedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('maps non-valid auth file to missing status', () => {
    const result = mapAuthFileToCredentialFile({
      id: 'auth-2',
      providerKind: 'codex',
      path: '/auth/codex.json',
      status: 'expired',
      updatedAt: '2026-05-01T00:00:00.000Z',
      providerId: 'codex',
      fileName: 'codex.json',
      modelCount: 0,
      metadata: {}
    });
    expect(result.status).toBe('missing');
  });
});

describe('mapQuotaDetailToLocalQuota', () => {
  it('maps quota with non-unknown window', () => {
    const result = mapQuotaDetailToLocalQuota({
      id: 'q1',
      providerId: 'gemini',
      scope: 'requests',
      window: 'daily',
      used: 100,
      limit: 1000,
      resetAt: '2026-05-02T00:00:00.000Z',
      refreshedAt: '2026-05-01T00:00:00.000Z',
      status: 'ok'
    });
    expect(result.id).toBe('q1');
    expect(result.provider).toBe('gemini');
    expect(result.scope).toBe('requests:daily');
    expect(result.usedTokens).toBe(100);
    expect(result.limitTokens).toBe(1000);
    expect(result.resetAt).toBe('2026-05-02T00:00:00.000Z');
    expect(result.status).toBe('ok');
  });

  it('maps quota with unknown window to just scope', () => {
    const result = mapQuotaDetailToLocalQuota({
      id: 'q2',
      providerId: 'codex',
      scope: 'tokens',
      window: 'unknown',
      used: 50,
      limit: 500,
      refreshedAt: '2026-05-01T00:00:00.000Z',
      status: 'ok'
    });
    expect(result.scope).toBe('tokens');
  });

  it('falls back to refreshedAt when resetAt is missing', () => {
    const result = mapQuotaDetailToLocalQuota({
      id: 'q3',
      providerId: 'gemini',
      scope: 'requests',
      window: 'daily',
      used: 0,
      limit: 100,
      refreshedAt: '2026-05-01T12:00:00.000Z',
      status: 'ok'
    });
    expect(result.resetAt).toBe('2026-05-01T12:00:00.000Z');
  });
});

describe('mapRequestLogToLocalLog', () => {
  it('maps 5xx to error level', () => {
    const result = mapRequestLogToLocalLog({
      id: 'log-1',
      occurredAt: '2026-05-01T00:00:00.000Z',
      statusCode: 500,
      providerId: 'gemini',
      message: 'Internal error',
      path: '/v1/chat'
    });
    expect(result.level).toBe('error');
    expect(result.provider).toBe('gemini');
    expect(result.message).toBe('Internal error');
    expect(result.stage).toBe('proxy');
  });

  it('maps 4xx to warn level', () => {
    const result = mapRequestLogToLocalLog({
      id: 'log-2',
      occurredAt: '2026-05-01T00:00:00.000Z',
      statusCode: 404,
      path: '/v1/models'
    });
    expect(result.level).toBe('warn');
    expect(result.provider).toBe('cli-proxy');
    expect(result.message).toBe('/v1/models');
  });

  it('maps 2xx to info level', () => {
    const result = mapRequestLogToLocalLog({
      id: 'log-3',
      occurredAt: '2026-05-01T00:00:00.000Z',
      statusCode: 200,
      path: '/v1/chat'
    });
    expect(result.level).toBe('info');
  });
});

describe('mapApiKeyToImportedClientApiKey', () => {
  it('maps API key with lastUsedAt', () => {
    const result = mapApiKeyToImportedClientApiKey(
      {
        id: 'key-1',
        name: 'My Key',
        prefix: 'sk-abc',
        status: 'active',
        scopes: ['chat.completions', 'models.read'],
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: '2026-05-01T00:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z',
        usage: { requestCount: 10, lastRequestAt: null }
      },
      '2026-05-10T00:00:00.000Z'
    );
    expect(result.id).toBe('key-1');
    expect(result.clientId).toBe('cli-proxy-import');
    expect(result.status).toBe('disabled');
    expect(result.scopes).toEqual(['chat.completions', 'models.read']);
    expect(result.lastUsedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('falls back to importedAt when lastUsedAt is missing', () => {
    const result = mapApiKeyToImportedClientApiKey(
      {
        id: 'key-2',
        name: 'Key 2',
        prefix: 'sk-xyz',
        status: 'active',
        scopes: ['proxy:invoke'],
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
        expiresAt: null,
        usage: { requestCount: 0, lastRequestAt: null }
      },
      '2026-05-10T00:00:00.000Z'
    );
    expect(result.lastUsedAt).toBe('2026-05-10T00:00:00.000Z');
    // proxy:invoke is not in allowed scopes, so falls back to defaults
    expect(result.scopes).toEqual(['models.read', 'chat.completions']);
  });
});

describe('parseRawConfigPatch', () => {
  it('parses retryLimit', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-1',
      content: 'request-retry: 3\nauditEnabled: true',
      providerId: 'gemini'
    } as any);
    expect(result).toEqual({ retryLimit: 3, auditEnabled: true });
  });

  it('parses circuitBreakerEnabled', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-2',
      content: 'circuit-breaker-enabled: false',
      providerId: 'gemini'
    } as any);
    expect(result).toEqual({ circuitBreakerEnabled: false });
  });

  it('returns null when no recognized fields', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-3',
      content: 'unknown: value',
      providerId: 'gemini'
    } as any);
    expect(result).toBeNull();
  });

  it('ignores negative retry limit', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-4',
      content: 'retryLimit: -1',
      providerId: 'gemini'
    } as any);
    expect(result).toBeNull();
  });

  it('parses retryLimit from decimal by capturing integer part', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-5',
      content: 'retryLimit: 3.5',
      providerId: 'gemini'
    } as any);
    // regex \d+ captures "3" from "3.5", which is a valid integer
    expect(result).toEqual({ retryLimit: 3 });
  });

  it('parses retryLimit with alternate pattern', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-6',
      content: 'retryLimit: 5',
      providerId: 'gemini'
    } as any);
    expect(result).toEqual({ retryLimit: 5 });
  });

  it('parses auditEnabled false', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-7',
      content: 'audit: false',
      providerId: 'gemini'
    } as any);
    expect(result).toEqual({ auditEnabled: false });
  });

  it('handles case-insensitive boolean matching', () => {
    const result = parseRawConfigPatch({
      id: 'cfg-8',
      content: 'auditEnabled: TRUE',
      providerId: 'gemini'
    } as any);
    expect(result).toEqual({ auditEnabled: true });
  });
});
