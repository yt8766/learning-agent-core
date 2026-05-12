import { HttpException, UnauthorizedException } from '@nestjs/common';
import { GatewayProviderSpecificConfigListResponseSchema } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import {
  normalizeBaseUrl,
  providerEndpoint,
  createProviderConfigList,
  mapApiKeys,
  mapAuthFile,
  mapModel,
  mapRequestLog,
  mapOAuthAlias,
  mapBatchUploadAuthFiles,
  mapSystemInfo,
  normalizeProviderKind,
  normalizeOAuthStatus,
  queryString,
  asRecord,
  recordOf,
  arrayBody,
  stringField,
  numberField,
  booleanField,
  arrayOfStrings,
  maskSecret,
  now
} from '../../src/domains/agent-gateway/management/cli-proxy-management-client.helpers';

describe('cli-proxy-management-client helpers', () => {
  describe('normalizeBaseUrl', () => {
    it('appends /v0/management when missing', () => {
      expect(normalizeBaseUrl('https://example.com')).toBe('https://example.com/v0/management');
    });

    it('keeps /v0/management when present', () => {
      expect(normalizeBaseUrl('https://example.com/v0/management')).toBe('https://example.com/v0/management');
    });

    it('trims trailing slashes', () => {
      expect(normalizeBaseUrl('https://example.com/')).toBe('https://example.com/v0/management');
    });
  });

  describe('providerEndpoint', () => {
    it('returns /openai-compatibility for openaiCompatible', () => {
      expect(providerEndpoint('openaiCompatible')).toBe('/openai-compatibility');
    });

    it('returns /{type}-api-key for other types', () => {
      expect(providerEndpoint('gemini')).toBe('/gemini-api-key');
      expect(providerEndpoint('claude')).toBe('/claude-api-key');
    });
  });

  describe('createProviderConfigList', () => {
    it('returns all provider types', () => {
      const result = createProviderConfigList();

      expect(result.items).toHaveLength(6);
      expect(result.items.map(i => i.providerType)).toEqual([
        'gemini',
        'codex',
        'claude',
        'vertex',
        'openaiCompatible',
        'ampcode'
      ]);
    });

    it('returns a schema-valid provider config fallback projection', () => {
      const result = createProviderConfigList();

      expect(() => GatewayProviderSpecificConfigListResponseSchema.parse(result)).not.toThrow();
    });
  });

  describe('mapApiKeys', () => {
    it('maps API keys from body', () => {
      const result = mapApiKeys({
        items: [{ id: 'key-1', name: 'Test Key', prefix: 'sk-***', disabled: false, scopes: ['proxy:invoke'] }]
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('key-1');
      expect(result.items[0].name).toBe('Test Key');
    });

    it('handles string items', () => {
      const result = mapApiKeys({ keys: ['sk-test-key-123'] });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].prefix).toContain('***');
    });

    it('returns empty for missing items', () => {
      const result = mapApiKeys({});

      expect(result.items).toHaveLength(0);
    });
  });

  describe('mapAuthFile', () => {
    it('maps auth file from record', () => {
      const result = mapAuthFile({
        id: 'af-1',
        fileName: 'openai.json',
        providerKind: 'openai-compatible',
        path: '/path/to/file'
      });

      expect(result.id).toBe('af-1');
      expect(result.fileName).toBe('openai.json');
    });

    it('uses defaults for missing fields', () => {
      const result = mapAuthFile({});

      expect(result.fileName).toBe('auth.json');
      expect(result.status).toBe('valid');
    });
  });

  describe('mapModel', () => {
    it('maps model from record', () => {
      const result = mapModel({ id: 'gpt-4', displayName: 'GPT-4', available: true }, 'openai-compatible');

      expect(result.id).toBe('gpt-4');
      expect(result.displayName).toBe('GPT-4');
    });

    it('uses fallback provider kind when providerKind not in record', () => {
      const result = mapModel({ id: 'gpt-4' }, 'custom');

      expect(result.providerKind).toBe('custom');
    });
  });

  describe('mapRequestLog', () => {
    it('maps request log from record', () => {
      const result = mapRequestLog({
        id: 'log-1',
        occurredAt: '2026-05-10T00:00:00.000Z',
        method: 'POST',
        path: '/v1/chat',
        statusCode: 200,
        durationMs: 150
      });

      expect(result.id).toBe('log-1');
      expect(result.method).toBe('POST');
    });

    it('uses defaults for missing fields', () => {
      const result = mapRequestLog({});

      expect(result.method).toBe('GET');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('mapOAuthAlias', () => {
    it('maps OAuth alias from record', () => {
      const result = mapOAuthAlias({
        channel: 'default',
        sourceModel: 'gpt-4',
        alias: 'my-gpt4',
        fork: false
      });

      expect(result.channel).toBe('default');
      expect(result.sourceModel).toBe('gpt-4');
    });

    it('uses defaults for missing fields', () => {
      const result = mapOAuthAlias({});

      expect(result.channel).toBe('default');
      expect(result.sourceModel).toBe('');
    });
  });

  describe('mapSystemInfo', () => {
    it('maps system info from connection', () => {
      const result = mapSystemInfo({
        serverVersion: '1.0.0',
        serverBuildDate: '2026-05-01',
        status: 'connected'
      } as never);

      expect(result.version).toBe('1.0.0');
      expect(result.buildDate).toBe('2026-05-01');
    });

    it('uses defaults for missing fields', () => {
      const result = mapSystemInfo({} as never);

      expect(result.version).toBe('unknown');
    });
  });

  describe('normalizeProviderKind', () => {
    it('returns known provider kinds', () => {
      expect(normalizeProviderKind('gemini')).toBe('gemini');
      expect(normalizeProviderKind('codex')).toBe('codex');
      expect(normalizeProviderKind('claude')).toBe('claude');
      expect(normalizeProviderKind('vertex')).toBe('vertex');
      expect(normalizeProviderKind('openai-compatible')).toBe('openai-compatible');
      expect(normalizeProviderKind('ampcode')).toBe('ampcode');
    });

    it('returns custom for unknown values', () => {
      expect(normalizeProviderKind('unknown')).toBe('custom');
      expect(normalizeProviderKind(null)).toBe('custom');
    });
  });

  describe('normalizeOAuthStatus', () => {
    it('normalizes completed statuses', () => {
      expect(normalizeOAuthStatus({ status: 'completed' })).toBe('completed');
      expect(normalizeOAuthStatus({ status: 'ok' })).toBe('completed');
    });

    it('normalizes pending statuses', () => {
      expect(normalizeOAuthStatus({ status: 'wait' })).toBe('pending');
      expect(normalizeOAuthStatus({ status: 'pending' })).toBe('pending');
    });

    it('passes through expired and error', () => {
      expect(normalizeOAuthStatus({ status: 'expired' })).toBe('expired');
      expect(normalizeOAuthStatus({ status: 'error' })).toBe('error');
    });

    it('defaults to pending for unknown', () => {
      expect(normalizeOAuthStatus({})).toBe('pending');
    });
  });

  describe('queryString', () => {
    it('builds query string from params', () => {
      expect(queryString({ key: 'value', num: 42 })).toBe('?key=value&num=42');
    });

    it('skips undefined and null values', () => {
      expect(queryString({ key: 'value', skip: undefined, also: null })).toBe('?key=value');
    });

    it('returns empty string for no params', () => {
      expect(queryString({})).toBe('');
    });
  });

  describe('asRecord', () => {
    it('returns object as record', () => {
      expect(asRecord({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('returns empty object for non-objects', () => {
      expect(asRecord(null)).toEqual({});
      expect(asRecord(undefined)).toEqual({});
      expect(asRecord('string')).toEqual({});
      expect(asRecord([1, 2])).toEqual({});
    });
  });

  describe('recordOf', () => {
    it('returns object as record', () => {
      expect(recordOf({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('returns empty object for non-objects', () => {
      expect(recordOf(null)).toEqual({});
    });
  });

  describe('arrayBody', () => {
    it('returns array from body by key', () => {
      expect(arrayBody({ items: [1, 2] }, 'items')).toEqual([1, 2]);
    });

    it('tries multiple keys', () => {
      expect(arrayBody({ keys: [1, 2] }, 'items', 'keys')).toEqual([1, 2]);
    });

    it('returns empty array when not found', () => {
      expect(arrayBody({}, 'items')).toEqual([]);
    });

    it('returns body directly if it is an array', () => {
      expect(arrayBody([1, 2] as never, 'items')).toEqual([1, 2]);
    });
  });

  describe('stringField', () => {
    it('returns first matching string field', () => {
      expect(stringField({ a: 'hello', b: 'world' }, 'a', 'b')).toBe('hello');
    });

    it('returns null when no match', () => {
      expect(stringField({}, 'missing')).toBeNull();
      expect(stringField({ a: 42 }, 'a')).toBeNull();
    });
  });

  describe('numberField', () => {
    it('returns first matching number field', () => {
      expect(numberField({ a: 42, b: 100 }, 'a', 'b')).toBe(42);
    });

    it('returns null for non-finite numbers', () => {
      expect(numberField({ a: Infinity }, 'a')).toBeNull();
      expect(numberField({ a: NaN }, 'a')).toBeNull();
    });

    it('returns null when no match', () => {
      expect(numberField({}, 'missing')).toBeNull();
    });
  });

  describe('booleanField', () => {
    it('returns first matching boolean field', () => {
      expect(booleanField({ a: true, b: false }, 'a', 'b')).toBe(true);
    });

    it('returns null when no match', () => {
      expect(booleanField({}, 'missing')).toBeNull();
      expect(booleanField({ a: 'true' }, 'a')).toBeNull();
    });
  });

  describe('arrayOfStrings', () => {
    it('returns array of strings', () => {
      expect(arrayOfStrings(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('returns null for non-string arrays', () => {
      expect(arrayOfStrings([1, 2])).toBeNull();
      expect(arrayOfStrings('not-array')).toBeNull();
    });
  });

  describe('maskSecret', () => {
    it('masks long secrets', () => {
      expect(maskSecret('sk-1234567890')).toBe('sk-***890');
    });

    it('returns *** for short secrets', () => {
      expect(maskSecret('abc')).toBe('***');
    });
  });

  describe('now', () => {
    it('returns ISO date string', () => {
      const result = now();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('mapBatchUploadAuthFiles', () => {
    it('handles ok status with uploaded count', () => {
      const result = mapBatchUploadAuthFiles(
        { status: 'ok', uploaded: 2 },
        {
          files: [
            { fileName: 'gemini.json', providerKind: 'gemini' },
            { fileName: 'claude.json', providerKind: 'claude' }
          ]
        }
      );
      expect(result.accepted).toHaveLength(2);
      expect(result.accepted[0].fileName).toBe('gemini.json');
      expect(result.rejected).toEqual([]);
    });

    it('handles ok status without providerKind', () => {
      const result = mapBatchUploadAuthFiles({ status: 'ok', uploaded: 1 }, { files: [{ fileName: 'auth.json' }] });
      expect(result.accepted[0].providerKind).toBe('custom');
    });

    it('maps accepted and rejected from body', () => {
      const result = mapBatchUploadAuthFiles(
        {
          accepted: [{ id: 'af-1', fileName: 'gemini.json' }],
          rejected: [{ fileName: 'bad.json', reason: 'invalid format' }]
        },
        { files: [] }
      );
      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].authFileId).toBe('af-1');
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toBe('invalid format');
    });

    it('handles string items in accepted', () => {
      const result = mapBatchUploadAuthFiles({ accepted: ['gemini.json'] }, { files: [] });
      expect(result.accepted[0].fileName).toBe('gemini.json');
    });

    it('handles missing accepted id with fallback', () => {
      const result = mapBatchUploadAuthFiles({ accepted: [{ fileName: 'test.json' }] }, { files: [] });
      expect(result.accepted[0].authFileId).toBe('test.json');
    });

    it('handles missing accepted fileName with request fallback', () => {
      const result = mapBatchUploadAuthFiles({ accepted: [{}] }, { files: [{ fileName: 'fallback.json' }] });
      expect(result.accepted[0].fileName).toBe('fallback.json');
    });

    it('handles missing rejected fields with defaults', () => {
      const result = mapBatchUploadAuthFiles({ rejected: [{}] }, { files: [] });
      expect(result.rejected[0].fileName).toBe('unknown');
      expect(result.rejected[0].reason).toBe('rejected');
    });
  });

  describe('mapApiKeys - additional branches', () => {
    it('handles api-keys key', () => {
      const result = mapApiKeys({ 'api-keys': [{ id: 'k1', name: 'Key 1' }] });
      expect(result.items).toHaveLength(1);
    });

    it('handles apiKeys key', () => {
      const result = mapApiKeys({ apiKeys: [{ id: 'k1' }] });
      expect(result.items).toHaveLength(1);
    });

    it('handles disabled key', () => {
      const result = mapApiKeys({ items: [{ id: 'k1', disabled: true }] });
      expect(result.items[0].status).toBe('disabled');
    });

    it('handles key with usage data', () => {
      const result = mapApiKeys({
        items: [{ id: 'k1', usage: { requestCount: 42, lastRequestAt: '2026-05-11' } }]
      });
      expect(result.items[0].usage.requestCount).toBe(42);
      expect(result.items[0].usage.lastRequestAt).toBe('2026-05-11');
    });

    it('handles key with expiresAt', () => {
      const result = mapApiKeys({ items: [{ id: 'k1', expiresAt: '2027-01-01' }] });
      expect(result.items[0].expiresAt).toBe('2027-01-01');
    });

    it('handles key with createdAt', () => {
      const result = mapApiKeys({ items: [{ id: 'k1', createdAt: '2026-01-01' }] });
      expect(result.items[0].createdAt).toBe('2026-01-01');
    });

    it('handles key with key/value/apiKey/api_key fields', () => {
      const result = mapApiKeys({ items: [{ key: 'sk-test-123456' }] });
      expect(result.items[0].prefix).toContain('***');
    });

    it('handles key with last_request_at in usage', () => {
      const result = mapApiKeys({
        items: [{ id: 'k1', usage: { last_request_at: '2026-05-11' } }]
      });
      expect(result.items[0].lastUsedAt).toBe('2026-05-11');
    });
  });

  describe('mapAuthFile - additional branches', () => {
    it('uses fileName as providerKind fallback', () => {
      const result = mapAuthFile({ fileName: 'gemini-auth.json' });
      expect(result.providerKind).toBe('custom');
    });

    it('handles accountEmail and projectId', () => {
      const result = mapAuthFile({ accountEmail: 'test@example.com', projectId: 'proj-1' });
      expect(result.accountEmail).toBe('test@example.com');
      expect(result.projectId).toBe('proj-1');
    });

    it('handles modelCount', () => {
      const result = mapAuthFile({ modelCount: 5 });
      expect(result.modelCount).toBe(5);
    });

    it('handles updatedAt', () => {
      const result = mapAuthFile({ updatedAt: '2026-05-11' });
      expect(result.updatedAt).toBe('2026-05-11');
    });
  });

  describe('mapModel - additional branches', () => {
    it('uses model/name fallback for id', () => {
      const result = mapModel({ model: 'gpt-4' }, 'custom');
      expect(result.id).toBe('gpt-4');
    });

    it('uses name fallback for displayName', () => {
      const result = mapModel({ id: 'gpt-4', name: 'GPT-4' }, 'custom');
      expect(result.displayName).toBe('GPT-4');
    });

    it('uses available field', () => {
      const result = mapModel({ id: 'gpt-4', available: false }, 'custom');
      expect(result.available).toBe(false);
    });

    it('defaults available to true', () => {
      const result = mapModel({ id: 'gpt-4' }, 'custom');
      expect(result.available).toBe(true);
    });

    it('normalizes providerKind', () => {
      const result = mapModel({ id: 'gpt-4', providerKind: 'gemini' }, 'custom');
      expect(result.providerKind).toBe('gemini');
    });
  });

  describe('mapRequestLog - additional branches', () => {
    it('uses timestamp fallback for occurredAt', () => {
      const result = mapRequestLog({ timestamp: '2026-05-11' });
      expect(result.occurredAt).toBe('2026-05-11');
    });

    it('uses url fallback for path', () => {
      const result = mapRequestLog({ url: '/api/v1' });
      expect(result.path).toBe('/api/v1');
    });

    it('uses status fallback for statusCode', () => {
      const result = mapRequestLog({ status: 404 });
      expect(result.statusCode).toBe(404);
    });

    it('handles managementTraffic', () => {
      const result = mapRequestLog({ managementTraffic: true });
      expect(result.managementTraffic).toBe(true);
    });

    it('handles providerId and apiKeyPrefix', () => {
      const result = mapRequestLog({ providerId: 'openai', apiKeyPrefix: 'sk-' });
      expect(result.providerId).toBe('openai');
      expect(result.apiKeyPrefix).toBe('sk-');
    });

    it('handles message field', () => {
      const result = mapRequestLog({ message: 'Rate limited' });
      expect(result.message).toBe('Rate limited');
    });
  });

  describe('mapOAuthAlias - additional branches', () => {
    it('uses source_model fallback', () => {
      const result = mapOAuthAlias({ source_model: 'gpt-4' });
      expect(result.sourceModel).toBe('gpt-4');
    });

    it('handles fork field', () => {
      const result = mapOAuthAlias({ fork: true });
      expect(result.fork).toBe(true);
    });
  });

  describe('normalizeOAuthStatus - additional branches', () => {
    it('uses state field fallback', () => {
      expect(normalizeOAuthStatus({ state: 'completed' })).toBe('completed');
      expect(normalizeOAuthStatus({ state: 'wait' })).toBe('pending');
    });
  });

  describe('queryString - additional branches', () => {
    it('skips empty string values', () => {
      expect(queryString({ key: 'value', empty: '' })).toBe('?key=value');
    });
  });

  describe('normalizeBaseUrl - additional branches', () => {
    it('trims whitespace', () => {
      expect(normalizeBaseUrl('  https://example.com  ')).toBe('https://example.com/v0/management');
    });

    it('handles multiple trailing slashes', () => {
      expect(normalizeBaseUrl('https://example.com///')).toBe('https://example.com/v0/management');
    });
  });
});
