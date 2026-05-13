import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayLogService } from '../../src/domains/agent-gateway/logs/agent-gateway-log.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('AgentGatewayLogService extended coverage', () => {
  describe('downloadRequestLog', () => {
    it('delegates to managementClient.downloadRequestLog when available', async () => {
      const mockDownload = vi.fn().mockResolvedValue('{"id":"log-1","method":"GET"}');
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn(),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn(),
        clearLogs: vi.fn(),
        downloadRequestLog: mockDownload
      } as any);

      const result = await service.downloadRequestLog('log-1');

      expect(mockDownload).toHaveBeenCalledWith('log-1');
      expect(result).toBe('{"id":"log-1","method":"GET"}');
    });

    it('falls back to tailLogs when downloadRequestLog is not available', async () => {
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn().mockResolvedValue({
          items: [{ id: 'log-proxy-1', method: 'GET', url: '/test' }],
          nextCursor: null
        }),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn(),
        clearLogs: vi.fn()
        // no downloadRequestLog
      } as any);

      const result = await service.downloadRequestLog('log-proxy-1');

      expect(result).toContain('log-proxy-1');
    });

    it('throws when log entry not found in fallback', async () => {
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn(),
        clearLogs: vi.fn()
        // no downloadRequestLog method
      } as any);

      await expect(service.downloadRequestLog('nonexistent-log-id')).rejects.toThrow(
        'Gateway request log not found: nonexistent-log-id'
      );
    });
  });

  describe('downloadRequestErrorFile', () => {
    it('delegates to managementClient.downloadRequestErrorFile when available', async () => {
      const mockDownload = vi.fn().mockResolvedValue('error file content');
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn(),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn(),
        clearLogs: vi.fn(),
        downloadRequestErrorFile: mockDownload
      } as any);

      const result = await service.downloadRequestErrorFile('error-1.log');

      expect(mockDownload).toHaveBeenCalledWith('error-1.log');
      expect(result).toBe('error file content');
    });

    it('falls back to listing error files when downloadRequestErrorFile not available', async () => {
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn(),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn().mockResolvedValue({
          items: [
            {
              fileName: 'request-error-1.log',
              path: '/logs/request-error-1.log',
              sizeBytes: 42,
              modifiedAt: '2026-05-01'
            }
          ]
        }),
        clearLogs: vi.fn()
        // no downloadRequestErrorFile
      } as any);

      const result = await service.downloadRequestErrorFile('request-error-1.log');

      expect(result).toContain('request-error-1.log');
    });

    it('throws when error file not found in fallback', async () => {
      const service = new AgentGatewayLogService({
        tailLogs: vi.fn(),
        searchLogs: vi.fn(),
        listRequestErrorFiles: vi.fn().mockResolvedValue({ items: [] }),
        clearLogs: vi.fn()
        // no downloadRequestErrorFile method
      } as any);

      await expect(service.downloadRequestErrorFile('nonexistent.log')).rejects.toThrow(
        'Gateway request error file not found: nonexistent.log'
      );
    });
  });

  describe('clear', () => {
    it('delegates to managementClient.clearLogs', async () => {
      const service = new AgentGatewayLogService(new MemoryAgentGatewayManagementClient());

      const result = await service.clear();

      expect(result.cleared).toBe(true);
    });
  });

  describe('listRequestErrorFiles', () => {
    it('delegates to managementClient.listRequestErrorFiles', async () => {
      const service = new AgentGatewayLogService(new MemoryAgentGatewayManagementClient());

      const result = await service.listRequestErrorFiles();

      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });
  });
});
