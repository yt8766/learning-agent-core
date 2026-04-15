import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  configureConnectorWithGovernanceMock,
  setConnectorEnabledWithGovernanceMock,
  registerConfiguredConnectorMock,
  registerDiscoveredCapabilitiesMock
} = vi.hoisted(() => ({
  configureConnectorWithGovernanceMock: vi.fn(async (input: any) => input.loadConnectorView('github-mcp')),
  setConnectorEnabledWithGovernanceMock: vi.fn(async () => ({ id: 'github-mcp' })),
  registerConfiguredConnectorMock: vi.fn(),
  registerDiscoveredCapabilitiesMock: vi.fn()
}));

vi.mock('../../../src/runtime/actions/runtime-connector-governance-actions', () => ({
  configureConnectorWithGovernance: configureConnectorWithGovernanceMock,
  setConnectorEnabledWithGovernance: setConnectorEnabledWithGovernanceMock
}));

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  registerConfiguredConnector: registerConfiguredConnectorMock,
  registerDiscoveredCapabilities: registerDiscoveredCapabilitiesMock
}));

import { RuntimeToolsService } from '../../../src/runtime/services/runtime-tools.service';

describe('RuntimeToolsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createService(overrides?: { configuredConnectors?: any[] }) {
    let snapshot = {
      governance: {
        configuredConnectors: overrides?.configuredConnectors ?? []
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
      getSnapshot: () => snapshot,
      updateSnapshot: (next: typeof snapshot) => {
        snapshot = next;
      }
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
    configureConnectorWithGovernanceMock.mockImplementationOnce(async (input: any) => {
      const current = await input.runtimeStateRepository.load();
      current.governance.configuredConnectors.push({
        connectorId: 'github-mcp',
        templateId: input.dto.templateId,
        enabled: input.dto.enabled
      });
      await input.runtimeStateRepository.save(current);
      return input.loadConnectorView('github-mcp');
    });

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

  it('loads connectors, sweeps idle sessions, and throws when a connector is missing', async () => {
    const { service } = createService();

    await expect(service.listConnectors()).resolves.toEqual([
      expect.objectContaining({
        id: 'github-mcp'
      })
    ]);
    await expect(service.getConnector('missing-connector')).rejects.toThrow('Connector missing-connector not found');
  });

  it('enables and disables connectors through governance wrappers', async () => {
    const { service } = createService();

    await expect(service.enableConnector('github-mcp')).resolves.toEqual(expect.objectContaining({ id: 'github-mcp' }));
    await expect(service.disableConnector('github-mcp')).resolves.toEqual(
      expect.objectContaining({ id: 'github-mcp' })
    );

    expect(setConnectorEnabledWithGovernanceMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        connectorId: 'github-mcp',
        enabled: true,
        profile: 'platform'
      })
    );
    expect(setConnectorEnabledWithGovernanceMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        connectorId: 'github-mcp',
        enabled: false,
        profile: 'platform'
      })
    );
  });

  it('updates connector secrets from existing configuration and forwards configure requests', async () => {
    const { service } = createService({
      configuredConnectors: [
        {
          connectorId: 'github-mcp',
          templateId: 'github-mcp-template',
          transport: 'stdio',
          displayName: 'GitHub MCP',
          command: 'npx',
          args: ['-y', 'github-mcp-server'],
          endpoint: undefined,
          enabled: true
        }
      ]
    });

    await expect(service.updateConnectorSecret('github-mcp', 'new-secret', 'tester')).resolves.toEqual(
      expect.objectContaining({ id: 'github-mcp' })
    );

    expect(configureConnectorWithGovernanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dto: expect.objectContaining({
          templateId: 'github-mcp-template',
          apiKey: 'new-secret',
          actor: 'tester'
        })
      })
    );
  });

  it('throws when updating the secret for an unconfigured connector', async () => {
    const { service } = createService();

    await expect(service.updateConnectorSecret('missing', 'new-secret')).rejects.toThrow(
      'Connector missing not configured'
    );
  });
});
