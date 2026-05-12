import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayAuthFileManagementService } from '../../src/domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayAuthFileManagementService extended coverage', () => {
  describe('list', () => {
    it('delegates to managementClient.listAuthFiles when available', async () => {
      const mockList = vi.fn().mockResolvedValue({ items: [authFile('test')], nextCursor: null });
      const service = new AgentGatewayAuthFileManagementService({
        listAuthFiles: mockList
      } as any);

      const result = await service.list({ query: 'test' });

      expect(mockList).toHaveBeenCalledWith({ query: 'test' });
      expect(result.items).toHaveLength(1);
    });

    it('filters by providerKind in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({
        files: [
          { fileName: 'a.json', contentBase64: 'e30=', providerKind: 'gemini' },
          { fileName: 'b.json', contentBase64: 'e30=', providerKind: 'claude' }
        ]
      });

      const result = await service.list({ providerKind: 'gemini' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].providerKind).toBe('gemini');
    });

    it('filters by query string matching fileName or providerId in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({
        files: [{ fileName: 'openai-key.json', contentBase64: 'e30=' }]
      });

      const result = await service.list({ query: 'openai' });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('normalizes limit to fallback when invalid', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({ files: [{ fileName: 'x.json', contentBase64: 'e30=' }] });

      const result = await service.list({ limit: -1 });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('patchFields', () => {
    it('delegates to managementClient.patchAuthFileFields when available', async () => {
      const mockPatch = vi.fn().mockResolvedValue(authFile('f1'));
      const service = new AgentGatewayAuthFileManagementService({
        patchAuthFileFields: mockPatch
      } as any);

      const result = await service.patchFields({ authFileId: 'f1', providerId: 'test' });

      expect(mockPatch).toHaveBeenCalled();
      expect(result.id).toBe('f1');
    });

    it('creates missing auth file when ID does not exist in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);

      const result = await service.patchFields({ authFileId: 'new-file', status: 'valid' });

      expect(result.id).toBe('new-file');
      expect(result.status).toBe('valid');
    });

    it('preserves existing metadata when patching', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({ files: [{ fileName: 'meta.json', contentBase64: 'e30=' }] });

      const result = await service.patchFields({ authFileId: 'meta.json', metadata: { extra: true } });

      expect(result.metadata).toEqual(expect.objectContaining({ extra: true }));
    });
  });

  describe('models', () => {
    it('delegates to managementClient.listAuthFileModels when available', async () => {
      const mockModels = vi.fn().mockResolvedValue({ authFileId: 'f1', models: [] });
      const service = new AgentGatewayAuthFileManagementService({
        listAuthFileModels: mockModels
      } as any);

      await service.models('f1');

      expect(mockModels).toHaveBeenCalledWith('f1');
    });

    it('returns default model for missing auth file in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);

      const result = await service.models('nonexistent');

      expect(result.models.length).toBe(1);
      expect(result.models[0].providerKind).toBe('custom');
    });
  });

  describe('download', () => {
    it('delegates to managementClient.downloadAuthFile when available', async () => {
      const mockDownload = vi.fn().mockResolvedValue('file content');
      const service = new AgentGatewayAuthFileManagementService({
        downloadAuthFile: mockDownload
      } as any);

      const result = await service.download('f1');

      expect(mockDownload).toHaveBeenCalledWith('f1');
      expect(result).toBe('file content');
    });

    it('returns content with id prefix for known file in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({ files: [{ fileName: 'test.json', contentBase64: 'aGVsbG8=' }] });

      const result = await service.download('test.json');

      expect(result).toContain('test.json');
      expect(result).toContain('hello'); // decoded base64
    });

    it('returns just the id when content not found in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);

      const result = await service.download('nonexistent');

      expect(result).toBe('nonexistent');
    });
  });

  describe('delete', () => {
    it('delegates to managementClient.deleteAuthFiles when available', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ deleted: ['f1'], skipped: [] });
      const service = new AgentGatewayAuthFileManagementService({
        deleteAuthFiles: mockDelete
      } as any);

      const result = await service.delete({ names: ['f1'] });

      expect(mockDelete).toHaveBeenCalled();
      expect(result.deleted).toEqual(['f1']);
    });

    it('deletes all files when all=true in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);
      await service.batchUpload({
        files: [
          { fileName: 'a.json', contentBase64: 'e30=' },
          { fileName: 'b.json', contentBase64: 'e30=' }
        ]
      });

      const result = await service.delete({ all: true });

      expect(result.deleted.length).toBe(2);
      expect(result.skipped).toHaveLength(0);
    });

    it('skips files not found when deleting by name in local fallback', async () => {
      const service = new AgentGatewayAuthFileManagementService({} as any);

      const result = await service.delete({ names: ['nonexistent'] });

      expect(result.deleted).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('not_found');
    });
  });
});

function authFile(id: string) {
  return {
    id,
    providerId: 'custom',
    providerKind: 'custom',
    fileName: `${id}.json`,
    path: `/memory/${id}.json`,
    status: 'valid',
    accountEmail: null,
    projectId: null,
    modelCount: 0,
    updatedAt: '2026-05-11T00:00:00.000Z',
    metadata: {}
  };
}
