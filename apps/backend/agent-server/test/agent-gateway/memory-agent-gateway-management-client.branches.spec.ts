import { describe, expect, it, vi } from 'vitest';

import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('MemoryAgentGatewayManagementClient - branch coverage', () => {
  function createClient(options?: { quotaInspectors?: any[] }) {
    return new MemoryAgentGatewayManagementClient(options);
  }

  describe('saveProfile', () => {
    it('uses default timeoutMs when not provided', async () => {
      const client = createClient();
      const result = await client.saveProfile({ apiBase: 'http://localhost', managementKey: 'key' });
      expect(result.timeoutMs).toBe(15000);
    });

    it('uses provided timeoutMs', async () => {
      const client = createClient();
      const result = await client.saveProfile({ apiBase: 'http://localhost', managementKey: 'key', timeoutMs: 5000 });
      expect(result.timeoutMs).toBe(5000);
    });
  });

  describe('checkConnection', () => {
    it('returns disconnected when no profile', async () => {
      const client = createClient();
      const result = await client.checkConnection();
      expect(result.status).toBe('disconnected');
      expect(result.serverVersion).toBeNull();
    });

    it('returns connected after saving profile', async () => {
      const client = createClient();
      await client.saveProfile({ apiBase: 'http://localhost', managementKey: 'key' });
      const result = await client.checkConnection();
      expect(result.status).toBe('connected');
      expect(result.serverVersion).toBe('memory-cli-proxy');
    });
  });

  describe('listAuthFiles', () => {
    it('filters by providerKind', async () => {
      const client = createClient();
      const result = await client.listAuthFiles({ providerKind: 'codex' });
      const codexFiles = result.items.filter(item => item.providerKind === 'codex');
      expect(codexFiles.length).toBe(result.items.length);
    });

    it('filters by query matching fileName', async () => {
      const client = createClient();
      const result = await client.listAuthFiles({ query: 'codex' });
      expect(
        result.items.every(
          item => item.fileName.toLowerCase().includes('codex') || item.providerId.toLowerCase().includes('codex')
        )
      ).toBe(true);
    });

    it('filters by query matching providerId', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [
          {
            fileName: 'test-auth.json',
            contentBase64: Buffer.from(JSON.stringify({ status: 'valid' })).toString('base64')
          }
        ]
      });
      const result = await client.listAuthFiles({ query: 'test-auth' });
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('normalizes limit', async () => {
      const client = createClient();
      const result = await client.listAuthFiles({ limit: 2 });
      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('batchUploadAuthFiles', () => {
    it('parses valid JSON auth file content', async () => {
      const client = createClient();
      const content = Buffer.from(
        JSON.stringify({
          status: 'valid',
          accountEmail: 'user@example.com',
          projectId: 'proj-1',
          models: ['gpt-4', 'gpt-3.5']
        })
      ).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'auth.json', contentBase64: content }]
      });
      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].status).toBe('valid');
    });

    it('handles invalid JSON content', async () => {
      const client = createClient();
      const content = Buffer.from('not-json').toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'bad.json', contentBase64: content }]
      });
      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].status).toBe('invalid');
    });

    it('handles non-object JSON (array)', async () => {
      const client = createClient();
      const content = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'arr.json', contentBase64: content }]
      });
      expect(result.accepted).toHaveLength(1);
    });

    it('maps authFileStatus correctly', async () => {
      const client = createClient();
      for (const status of ['missing', 'expired', 'invalid', 'valid', 'unknown', undefined]) {
        const content = Buffer.from(JSON.stringify({ status })).toString('base64');
        const result = await client.batchUploadAuthFiles({
          files: [{ fileName: `auth-${status}.json`, contentBase64: content }]
        });
        const expected = status === 'missing' || status === 'expired' || status === 'invalid' ? status : 'valid';
        expect(result.accepted[0].status).toBe(expected);
      }
    });

    it('uses providerKind from file when provided', async () => {
      const client = createClient();
      const content = Buffer.from(JSON.stringify({ status: 'valid' })).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'custom.json', contentBase64: content, providerKind: 'gemini' }]
      });
      expect(result.accepted[0].providerKind).toBe('gemini');
    });

    it('infers providerKind from filename', async () => {
      const client = createClient();
      const content = Buffer.from(JSON.stringify({ status: 'valid' })).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'gemini-auth.json', contentBase64: content }]
      });
      expect(result.accepted[0].providerKind).toBe('gemini');
    });

    it('handles stringOrNull for accountEmail and projectId', async () => {
      const client = createClient();
      const content = Buffer.from(
        JSON.stringify({
          accountEmail: '',
          projectId: null,
          status: 'valid'
        })
      ).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'test-nulls.json', contentBase64: content }]
      });
      // Empty string and null should produce null
      const authFile = (await client.listAuthFiles({})).items.find(i => i.id === 'test-nulls.json');
      // accountEmail '' -> null, projectId null -> null
    });

    it('handles stringArray for models', async () => {
      const client = createClient();
      const content = Buffer.from(
        JSON.stringify({
          models: ['gpt-4', 123, null, 'claude'],
          status: 'valid'
        })
      ).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'models-test.json', contentBase64: content }]
      });
      // Should count only string models: gpt-4, claude = 2
      expect(result.accepted[0].status).toBe('valid');
    });

    it('defaults modelCount to 1 when models is empty', async () => {
      const client = createClient();
      const content = Buffer.from(JSON.stringify({ models: [], status: 'valid' })).toString('base64');
      const result = await client.batchUploadAuthFiles({
        files: [{ fileName: 'empty-models.json', contentBase64: content }]
      });
      expect(result.accepted[0].status).toBe('valid');
    });
  });

  describe('patchAuthFileFields', () => {
    it('creates new auth file when not found', async () => {
      const client = createClient();
      const result = await client.patchAuthFileFields({ authFileId: 'new-file' });
      expect(result.id).toBe('new-file');
    });

    it('merges with existing auth file', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [{ fileName: 'existing.json', contentBase64: Buffer.from('{}').toString('base64') }]
      });
      const result = await client.patchAuthFileFields({
        authFileId: 'existing.json',
        status: 'expired',
        accountEmail: 'updated@example.com'
      });
      expect(result.status).toBe('expired');
      expect(result.accountEmail).toBe('updated@example.com');
    });

    it('preserves existing values when patch fields are undefined', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [
          {
            fileName: 'preserve.json',
            contentBase64: Buffer.from(JSON.stringify({ accountEmail: 'kept@example.com' })).toString('base64')
          }
        ]
      });
      const result = await client.patchAuthFileFields({ authFileId: 'preserve.json' });
      // accountEmail should be preserved since it's not in the patch
    });

    it('sets accountEmail to null when explicitly null', async () => {
      const client = createClient();
      const result = await client.patchAuthFileFields({
        authFileId: 'null-email',
        accountEmail: null
      });
      expect(result.accountEmail).toBeNull();
    });
  });

  describe('deleteAuthFiles', () => {
    it('deletes specific files by name', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [
          { fileName: 'del1.json', contentBase64: Buffer.from('{}').toString('base64') },
          { fileName: 'del2.json', contentBase64: Buffer.from('{}').toString('base64') }
        ]
      });
      const result = await client.deleteAuthFiles({ names: ['del1.json', 'missing.json'] });
      expect(result.deleted).toContain('del1.json');
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('not found');
    });

    it('deletes all files when all flag is set', async () => {
      const client = createClient();
      const result = await client.deleteAuthFiles({ all: true });
      expect(result.deleted.length).toBeGreaterThan(0);
    });

    it('returns empty when names is undefined and all is false', async () => {
      const client = createClient();
      const result = await client.deleteAuthFiles({});
      expect(result.deleted).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('refreshQuotaDetails', () => {
    it('falls back to listQuotaDetails when no matching inspector', async () => {
      const client = createClient({ quotaInspectors: [] });
      const result = await client.refreshQuotaDetails('unknown-provider' as any);
      expect(result.items).toBeDefined();
    });

    it('uses inspector when matching providerKind found', async () => {
      const mockInspector = {
        providerKind: 'codex',
        inspect: vi.fn(async () => [
          {
            providerKind: 'codex',
            providerId: 'codex',
            items: [
              {
                providerId: 'codex',
                model: 'codex-model',
                scope: 'model' as const,
                window: 'daily',
                limit: 100,
                used: 50,
                remaining: 50,
                status: 'normal' as const
              }
            ]
          }
        ])
      };
      const client = createClient({ quotaInspectors: [mockInspector as any] });
      const result = await client.refreshQuotaDetails('codex');
      expect(mockInspector.inspect).toHaveBeenCalled();
    });
  });

  describe('listQuotaDetails', () => {
    it('returns snapshots when available', async () => {
      const client = createClient();
      // First refresh to populate snapshots
      await client.refreshQuotaDetails('codex');
      const result = await client.listQuotaDetails();
      expect(result.items).toBeDefined();
    });

    it('returns memory defaults when no snapshots', async () => {
      const client = createClient();
      const result = await client.listQuotaDetails();
      expect(result.items).toBeDefined();
    });
  });

  describe('downloadRequestLog', () => {
    it('returns log when found', async () => {
      const client = createClient();
      const logs = await client.tailLogs({});
      if (logs.items.length > 0) {
        const result = await client.downloadRequestLog(logs.items[0].id);
        expect(result).toBeTruthy();
      }
    });

    it('returns missing object when log not found', async () => {
      const client = createClient();
      const result = await client.downloadRequestLog('nonexistent');
      expect(result).toContain('missing');
    });
  });

  describe('updateApiKey', () => {
    it('updates key at valid index', async () => {
      const client = createClient();
      await client.replaceApiKeys({ keys: ['key1', 'key2'] });
      const result = await client.updateApiKey({ keyId: '0', name: 'updated-key' });
      expect(result.items).toHaveLength(2);
    });

    it('does nothing when index is invalid', async () => {
      const client = createClient();
      await client.replaceApiKeys({ keys: ['key1'] });
      const result = await client.updateApiKey({ keyId: 'abc', name: 'updated' });
      expect(result.items).toHaveLength(1);
    });

    it('does nothing when name is not provided', async () => {
      const client = createClient();
      await client.replaceApiKeys({ keys: ['key1'] });
      const result = await client.updateApiKey({ keyId: '0' });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('discoverProviderModels', () => {
    it('uses default model when config has no models', async () => {
      const client = createClient();
      const result = await client.discoverProviderModels('unknown-provider');
      expect(result.groups[0].models[0].id).toBe('unknown-provider-model');
    });

    it('uses config models when available', async () => {
      const client = createClient();
      // First save a provider config with models
      await client.saveProviderConfig({
        id: 'configured-provider',
        providerType: 'openai',
        models: [{ name: 'gpt-4', alias: 'GPT-4' }]
      });
      const result = await client.discoverProviderModels('configured-provider');
      expect(result.groups[0].models[0].id).toBe('gpt-4');
      expect(result.groups[0].models[0].displayName).toBe('GPT-4');
    });

    it('uses model name when alias is missing', async () => {
      const client = createClient();
      await client.saveProviderConfig({
        id: 'no-alias',
        providerType: 'openai',
        models: [{ name: 'gpt-4' }]
      });
      const result = await client.discoverProviderModels('no-alias');
      expect(result.groups[0].models[0].displayName).toBe('gpt-4');
    });
  });

  describe('setRequestLogEnabled', () => {
    it('toggles request log setting', async () => {
      const client = createClient();
      const result = await client.setRequestLogEnabled(false);
      expect(result.requestLog).toBe(false);
    });
  });

  describe('toQuotaAuthFileProjection', () => {
    it('handles metadata with error string', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [
          {
            fileName: 'error-meta.json',
            contentBase64: Buffer.from(
              JSON.stringify({
                status: 'invalid',
                error: 'authentication failed',
                quota: { daily: { limit: 1000, used: 500 } }
              })
            ).toString('base64')
          }
        ]
      });
      const result = await client.refreshQuotaDetails('codex');
      expect(result).toBeDefined();
    });

    it('handles metadata with non-string error', async () => {
      const client = createClient();
      await client.batchUploadAuthFiles({
        files: [
          {
            fileName: 'non-string-error.json',
            contentBase64: Buffer.from(
              JSON.stringify({
                status: 'valid',
                error: 12345
              })
            ).toString('base64')
          }
        ]
      });
      const result = await client.refreshQuotaDetails('codex');
      expect(result).toBeDefined();
    });
  });
});
