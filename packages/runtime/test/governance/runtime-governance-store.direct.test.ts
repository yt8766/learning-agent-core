import { describe, expect, it, vi } from 'vitest';

import {
  toConnectorDiscoveryHistoryRecord,
  persistConnectorDiscoverySnapshot,
  appendGovernanceAudit
} from '../../src/governance/runtime-governance-store';

describe('runtime-governance-store (direct)', () => {
  describe('toConnectorDiscoveryHistoryRecord', () => {
    it('creates record from connector info', () => {
      const connector = {
        lastDiscoveredAt: '2026-01-01T00:00:00Z',
        discoveredCapabilities: ['tool-a', 'tool-b'],
        discoveryMode: 'active' as const,
        sessionState: 'connected' as const,
        transport: 'http'
      };
      const result = toConnectorDiscoveryHistoryRecord('github-mcp', connector as any);
      expect(result.connectorId).toBe('github-mcp');
      expect(result.discoveredCapabilities).toEqual(['tool-a', 'tool-b']);
      expect(result.discoveryMode).toBe('active');
      expect(result.sessionState).toBe('connected');
    });

    it('creates record when connector is undefined', () => {
      const result = toConnectorDiscoveryHistoryRecord('unknown-mcp', undefined);
      expect(result.connectorId).toBe('unknown-mcp');
      expect(result.discoveryMode).toBe('registered');
      expect(result.discoveredCapabilities).toEqual([]);
    });

    it('includes error message', () => {
      const result = toConnectorDiscoveryHistoryRecord('test-mcp', undefined, 'connection failed');
      expect(result.error).toBe('connection failed');
    });

    it('uses connector lastDiscoveryError when no explicit error', () => {
      const connector = { lastDiscoveryError: 'timeout' };
      const result = toConnectorDiscoveryHistoryRecord('test-mcp', connector as any);
      expect(result.error).toBe('timeout');
    });

    it('defaults sessionState to disconnected for stdio transport', () => {
      const connector = { transport: 'stdio' };
      const result = toConnectorDiscoveryHistoryRecord('test-mcp', connector as any);
      expect(result.sessionState).toBe('disconnected');
    });

    it('defaults sessionState to stateless for http transport', () => {
      const connector = { transport: 'http' };
      const result = toConnectorDiscoveryHistoryRecord('test-mcp', connector as any);
      expect(result.sessionState).toBe('stateless');
    });

    it('uses capabilities fallback when discoveredCapabilities missing', () => {
      const connector = {
        capabilities: [{ toolName: 'cap-1' }, { toolName: 'cap-2' }]
      };
      const result = toConnectorDiscoveryHistoryRecord('test-mcp', connector as any);
      expect(result.discoveredCapabilities).toEqual(['cap-1', 'cap-2']);
    });
  });

  describe('persistConnectorDiscoverySnapshot', () => {
    it('persists discovery snapshot', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governance: { connectorDiscoveryHistory: [] } }),
        save
      };
      const mcp = {
        describeServers: vi.fn().mockReturnValue([{ id: 'github-mcp', transport: 'http' }])
      };
      await persistConnectorDiscoverySnapshot(repo as any, mcp as any, 'github-mcp');
      expect(save).toHaveBeenCalled();
    });

    it('handles error parameter', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governance: {} }),
        save
      };
      const mcp = { describeServers: vi.fn().mockReturnValue([]) };
      await persistConnectorDiscoverySnapshot(repo as any, mcp as any, 'test-mcp', new Error('test error'));
      expect(save).toHaveBeenCalled();
    });

    it('handles string error', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governance: {} }),
        save
      };
      const mcp = { describeServers: vi.fn().mockReturnValue([]) };
      await persistConnectorDiscoverySnapshot(repo as any, mcp as any, 'test-mcp', 'string error');
      expect(save).toHaveBeenCalled();
    });

    it('limits history to 40 entries', async () => {
      const existingHistory = Array.from({ length: 45 }, (_, i) => ({
        connectorId: 'other',
        discoveredAt: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`
      }));
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governance: { connectorDiscoveryHistory: existingHistory } }),
        save
      };
      const mcp = { describeServers: vi.fn().mockReturnValue([]) };
      await persistConnectorDiscoverySnapshot(repo as any, mcp as any, 'test-mcp');
      const savedSnapshot = save.mock.calls[0][0];
      expect(savedSnapshot.governance.connectorDiscoveryHistory.length).toBeLessThanOrEqual(40);
    });
  });

  describe('appendGovernanceAudit', () => {
    it('appends audit entry', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governanceAudit: [] }),
        save
      };
      await appendGovernanceAudit(repo as any, {
        actor: 'admin',
        action: 'enable_connector',
        scope: 'connector',
        targetId: 'github-mcp',
        outcome: 'success'
      });
      expect(save).toHaveBeenCalled();
      const savedSnapshot = save.mock.calls[0][0];
      expect(savedSnapshot.governanceAudit).toHaveLength(1);
      expect(savedSnapshot.governanceAudit[0].actor).toBe('admin');
    });

    it('limits audit entries to 50', async () => {
      const existingAudit = Array.from({ length: 55 }, (_, i) => ({
        id: `audit-${i}`,
        at: '2026-01-01T00:00:00Z',
        actor: 'admin',
        action: 'test',
        scope: 'connector' as const,
        targetId: 'test',
        outcome: 'success' as const
      }));
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({ governanceAudit: existingAudit }),
        save
      };
      await appendGovernanceAudit(repo as any, {
        actor: 'admin',
        action: 'new_entry',
        scope: 'connector',
        targetId: 'test',
        outcome: 'success'
      });
      const savedSnapshot = save.mock.calls[0][0];
      expect(savedSnapshot.governanceAudit.length).toBeLessThanOrEqual(50);
      expect(savedSnapshot.governanceAudit[0].action).toBe('new_entry');
    });

    it('handles undefined governanceAudit', async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const repo = {
        load: vi.fn().mockResolvedValue({}),
        save
      };
      await appendGovernanceAudit(repo as any, {
        actor: 'admin',
        action: 'test',
        scope: 'connector',
        targetId: 'test',
        outcome: 'success'
      });
      expect(save).toHaveBeenCalled();
    });
  });
});
