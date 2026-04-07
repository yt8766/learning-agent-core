import { describe, expect, it, vi } from 'vitest';

import { RuntimeToolsService } from '../../../src/runtime/services/runtime-tools.service';

describe('RuntimeToolsService', () => {
  function createService() {
    let snapshot = {
      governance: {
        configuredConnectors: []
      }
    };
    const connectors = [
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
        discoveredCapabilities: [],
        discoveryMode: 'remote',
        sessionState: 'connected',
        approvalRequiredCount: 0,
        highRiskCount: 0,
        healthState: 'healthy',
        capabilities: []
      }
    ];

    return {
      service: new RuntimeToolsService(() => ({
        settings: { profile: 'platform', mcp: { stdioSessionIdleTtlMs: 1000 } },
        toolRegistry: {
          list: () => [{ name: 'read_local_file', family: 'filesystem', capabilityType: 'local-tool' }],
          listFamilies: () => [
            {
              id: 'filesystem',
              displayName: 'Filesystem',
              description: 'fs',
              capabilityType: 'local-tool',
              ownerType: 'shared'
            }
          ]
        },
        orchestrator: {
          listTasks: () => []
        },
        runtimeStateRepository: {
          load: vi.fn(async () => snapshot),
          save: vi.fn(async next => {
            snapshot = next;
          })
        },
        mcpServerRegistry: {
          get: vi.fn((id: string) => connectors.find(item => item.id === id)),
          setEnabled: vi.fn()
        },
        mcpCapabilityRegistry: {
          setServerApprovalOverride: vi.fn()
        },
        mcpClientManager: {
          sweepIdleSessions: vi.fn(async () => []),
          refreshAllServerDiscovery: vi.fn(async () => undefined),
          refreshServerDiscovery: vi.fn(async () => undefined),
          describeServers: vi.fn(() => connectors)
        },
        describeConnectorProfilePolicy: vi.fn(() => ({ enabledByProfile: true })),
        getConnectorRegistryContext: () => ({
          settings: {
            workspaceRoot: process.cwd(),
            skillsRoot: '',
            skillSourcesRoot: '',
            profile: 'platform',
            policy: { sourcePolicyMode: 'controlled-first' }
          },
          mcpServerRegistry: {
            register: vi.fn(),
            setEnabled: vi.fn()
          },
          mcpCapabilityRegistry: {
            register: vi.fn(),
            listByServer: vi.fn(() => []),
            setServerApprovalOverride: vi.fn(),
            setCapabilityApprovalOverride: vi.fn()
          },
          mcpClientManager: {
            describeServers: vi.fn(() => connectors)
          },
          orchestrator: {
            setWorkerEnabled: vi.fn(),
            listWorkers: vi.fn(() => []),
            registerWorker: vi.fn()
          }
        })
      })),
      getSnapshot: () => snapshot
    };
  }

  it('builds tool catalog from the unified facade', () => {
    const { service } = createService();

    expect(service.getToolsCenter()).toEqual(
      expect.objectContaining({
        totalTools: 1,
        families: [expect.objectContaining({ id: 'filesystem' })]
      })
    );
  });

  it('creates connector drafts through the unified facade', async () => {
    const { service, getSnapshot } = createService();

    await service.createConnectorDraft({
      templateId: 'github-mcp-template',
      displayName: 'GitHub MCP'
    });

    expect(getSnapshot().governance.configuredConnectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: 'github-mcp',
          templateId: 'github-mcp-template',
          enabled: false
        })
      ])
    );
  });
});
