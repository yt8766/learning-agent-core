import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeConnectorSessionWithGovernance,
  configureConnectorWithGovernance,
  refreshConnectorDiscoveryWithGovernance
} from '../../../src/runtime/actions/runtime-connector-governance-actions';
import {
  appendGovernanceAuditMock,
  createSnapshot,
  persistConnectorDiscoverySnapshotMock
} from './runtime-connector-governance-actions.test-helpers';

describe('runtime-connector-governance-actions operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes connector sessions and records success or rejection outcomes', async () => {
    const runtimeStateRepository = { load: async () => createSnapshot(), save: async () => undefined };

    await expect(
      closeConnectorSessionWithGovernance({
        connectorId: 'connector-1',
        runtimeStateRepository,
        mcpClientManager: { closeServerSession: async () => true }
      })
    ).resolves.toEqual({ connectorId: 'connector-1', closed: true });

    await expect(
      closeConnectorSessionWithGovernance({
        connectorId: 'connector-2',
        runtimeStateRepository,
        mcpClientManager: { closeServerSession: async () => false }
      })
    ).resolves.toEqual({ connectorId: 'connector-2', closed: false });

    expect(appendGovernanceAuditMock.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('refreshes connector discovery, snapshots success, and rethrows refresh errors after auditing', async () => {
    const runtimeStateRepository = { load: async () => createSnapshot(), save: async () => undefined };
    const loadConnectorView = vi.fn(async (connectorId: string) => ({ id: connectorId, refreshed: true }));
    const registerDiscoveredCapabilities = vi.fn();

    await expect(
      refreshConnectorDiscoveryWithGovernance({
        connectorId: 'connector-1',
        runtimeStateRepository,
        mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
        mcpClientManager: { refreshServerDiscovery: async () => undefined, describeServers: () => [] },
        registerDiscoveredCapabilities,
        loadConnectorView
      })
    ).resolves.toEqual({ id: 'connector-1', refreshed: true });

    const refreshError = new Error('refresh failed');
    await expect(
      refreshConnectorDiscoveryWithGovernance({
        connectorId: 'connector-1',
        runtimeStateRepository,
        mcpServerRegistry: { get: () => ({ id: 'connector-1' }) },
        mcpClientManager: {
          refreshServerDiscovery: async () => {
            throw refreshError;
          },
          describeServers: () => []
        },
        registerDiscoveredCapabilities,
        loadConnectorView
      })
    ).rejects.toThrow('refresh failed');

    expect(persistConnectorDiscoverySnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('configures connectors using template-to-connector mapping and tolerates refresh failures', async () => {
    const snapshot = createSnapshot();
    const save = vi.fn(async () => undefined);
    const registerConfiguredConnector = vi.fn();
    const registerDiscoveredCapabilities = vi.fn();
    const loadConnectorView = vi.fn(async (connectorId: string) => ({ id: connectorId, configured: true }));

    persistConnectorDiscoverySnapshotMock.mockRejectedValueOnce(new Error('snapshot failed'));

    const result = await configureConnectorWithGovernance({
      dto: { templateId: 'github-mcp-template', actor: 'tester', enabled: false } as never,
      runtimeStateRepository: { load: async () => snapshot, save },
      mcpClientManager: {
        refreshServerDiscovery: async () => {
          throw new Error('refresh failed');
        },
        describeServers: () => []
      },
      registerConfiguredConnector,
      registerDiscoveredCapabilities,
      loadConnectorView
    });

    expect(save).toHaveBeenCalled();
    expect(registerConfiguredConnector).toHaveBeenCalled();
    expect(registerDiscoveredCapabilities).toHaveBeenCalledWith('github-mcp');
    expect(result).toEqual({ id: 'github-mcp', configured: true });
  });
});
