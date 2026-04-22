import { describe, expect, it, vi } from 'vitest';

import {
  loadConnectorCenterProjection,
  loadConnectorProjectionById
} from '../src/centers/runtime-connectors-center-loader';

describe('runtime connectors center loader', () => {
  it('loads connector projections with optional discovery refresh and knowledge overview', async () => {
    const sweepIdleSessions = vi.fn(async () => []);
    const refreshAllServerDiscovery = vi.fn(async () => undefined);
    const describeServers = vi.fn(() => [
      {
        id: 'github-mcp',
        displayName: 'GitHub MCP',
        transport: 'stdio',
        enabled: true,
        source: 'configured',
        trustClass: 'official',
        dataScope: 'repos',
        writeScope: 'issues',
        installationMode: 'configured',
        allowedProfiles: ['platform'],
        capabilityCount: 0,
        implementedCapabilityCount: 0,
        discoveredCapabilityCount: 0,
        capabilities: []
      }
    ]);
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        governance: {
          configuredConnectors: [],
          connectorDiscoveryHistory: [],
          connectorPolicyOverrides: [],
          capabilityPolicyOverrides: []
        },
        governanceAudit: []
      }))
    };
    const orchestrator = {
      listTasks: vi.fn(() => [])
    };

    const result = await loadConnectorCenterProjection({
      settings: {
        profile: 'platform',
        mcp: { stdioSessionIdleTtlMs: 1000 }
      },
      runtimeStateRepository,
      orchestrator,
      mcpClientManager: {
        sweepIdleSessions,
        refreshAllServerDiscovery,
        describeServers
      },
      refreshDiscovery: true,
      includeStdioInRefresh: false,
      loadKnowledgeOverview: async () =>
        ({
          sourceCount: 1,
          searchableDocumentCount: 1,
          blockedDocumentCount: 0,
          latestReceipts: [{ id: 'receipt-1' }]
        }) as never
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'github-mcp',
        knowledgeIngestion: expect.objectContaining({
          latestReceiptIds: ['receipt-1']
        })
      })
    ]);
    expect(sweepIdleSessions).toHaveBeenCalledWith(1000);
    expect(refreshAllServerDiscovery).toHaveBeenCalledWith({ includeStdio: false });
  });

  it('loads a single connector projection by id and returns undefined when missing', async () => {
    const projection = await loadConnectorProjectionById({
      settings: {
        profile: 'platform',
        mcp: { stdioSessionIdleTtlMs: 1000 }
      },
      runtimeStateRepository: {
        load: async () => ({
          governance: {
            configuredConnectors: [],
            connectorDiscoveryHistory: [],
            connectorPolicyOverrides: [],
            capabilityPolicyOverrides: []
          },
          governanceAudit: []
        })
      },
      orchestrator: {
        listTasks: () => []
      },
      mcpClientManager: {
        sweepIdleSessions: async () => [],
        describeServers: () => [
          {
            id: 'github-mcp',
            displayName: 'GitHub MCP',
            transport: 'stdio',
            enabled: true,
            source: 'configured',
            trustClass: 'official',
            dataScope: 'repos',
            writeScope: 'issues',
            installationMode: 'configured',
            allowedProfiles: ['platform'],
            capabilityCount: 0,
            implementedCapabilityCount: 0,
            discoveredCapabilityCount: 0,
            capabilities: []
          }
        ]
      },
      connectorId: 'github-mcp'
    });

    expect(projection).toEqual(expect.objectContaining({ id: 'github-mcp' }));
  });
});
