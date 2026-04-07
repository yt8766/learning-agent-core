import { describe, expect, it, vi } from 'vitest';

import { ConnectorsCenterItem, collaborators, createService } from './runtime.service.test-helpers';

describe('RuntimeService connectors', () => {
  it('支持关闭 connector session', async () => {
    const service = createService();
    collaborators(service).mcpClientManager = {
      closeServerSession: vi.fn(async () => true)
    };

    await expect(service.closeConnectorSession('vision')).resolves.toEqual({
      connectorId: 'vision',
      closed: true
    });
  });

  it('会持久化 connector discovery 历史并在控制台返回配置详情', async () => {
    const service = createService();
    const c = collaborators(service);
    let snapshot = {
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      governance: {
        disabledSkillSourceIds: [],
        disabledCompanyWorkerIds: [],
        disabledConnectorIds: [],
        configuredConnectors: [
          {
            connectorId: 'github-mcp',
            templateId: 'github-mcp-template',
            transport: 'stdio',
            displayName: 'GitHub MCP',
            command: 'npx',
            args: ['-y', 'github-mcp-server'],
            enabled: true,
            configuredAt: '2026-03-26T09:00:00.000Z'
          }
        ],
        connectorDiscoveryHistory: [],
        connectorPolicyOverrides: [],
        capabilityPolicyOverrides: []
      },
      governanceAudit: [
        {
          id: 'audit-github-configured',
          at: '2026-03-26T09:06:00.000Z',
          actor: 'agent-admin-user',
          action: 'connector.configured',
          scope: 'connector',
          targetId: 'github-mcp',
          outcome: 'success',
          reason: 'github-mcp-template'
        }
      ]
    };
    const registeredCapabilities: Array<{ serverId: string; toolName: string }> = [];
    const registeredServers = new Map([
      [
        'github-mcp',
        {
          id: 'github-mcp',
          displayName: 'GitHub MCP',
          transport: 'stdio',
          enabled: true,
          command: 'npx',
          args: ['-y', 'github-mcp-server'],
          source: 'github-configured',
          trustClass: 'official',
          dataScope: 'repos',
          writeScope: 'issue comments',
          installationMode: 'configured',
          allowedProfiles: ['platform', 'company', 'personal', 'cli']
        }
      ]
    ]);

    c.runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async nextSnapshot => {
        snapshot = nextSnapshot;
      })
    };
    c.mcpServerRegistry = {
      get: vi.fn((id: string) => registeredServers.get(id)),
      register: vi.fn((server: any) => {
        registeredServers.set(server.id, server);
      }),
      list: vi.fn(() => Array.from(registeredServers.values())),
      setEnabled: vi.fn()
    };
    c.mcpCapabilityRegistry = {
      register: vi.fn((capability: { serverId: string; toolName: string }) => {
        registeredCapabilities.push(capability);
      }),
      listByServer: vi.fn((serverId: string) =>
        registeredCapabilities.filter(capability => capability.serverId === serverId)
      ),
      get: vi.fn((capabilityId: string) =>
        capabilityId === 'github-mcp:github.search_repos'
          ? {
              id: capabilityId,
              serverId: 'github-mcp',
              toolName: 'github.search_repos',
              displayName: 'GitHub Search Repos',
              riskLevel: 'low',
              requiresApproval: false,
              category: 'knowledge'
            }
          : undefined
      ),
      setServerApprovalOverride: vi.fn(),
      setCapabilityApprovalOverride: vi.fn()
    };
    c.mcpClientManager = {
      sweepIdleSessions: vi.fn(async () => []),
      refreshAllServerDiscovery: vi.fn(async () => undefined),
      refreshServerDiscovery: vi.fn(async () => undefined),
      describeServers: vi.fn(() => [
        {
          id: 'github-mcp',
          displayName: 'GitHub MCP',
          transport: 'stdio',
          enabled: true,
          source: 'github-configured',
          trustClass: 'official',
          dataScope: 'repos',
          writeScope: 'issue comments',
          installationMode: 'configured',
          allowedProfiles: ['platform', 'company', 'personal', 'cli'],
          command: 'npx',
          args: ['-y', 'github-mcp-server'],
          endpoint: undefined,
          capabilityCount: 1,
          implementedCapabilityCount: 1,
          discoveredCapabilityCount: 2,
          discoveredCapabilities: ['github.search_repos', 'github.create_issue_comment'],
          discoveryMode: 'remote',
          sessionState: 'connected',
          lastDiscoveredAt: '2026-03-26T09:05:00.000Z',
          lastDiscoveryError: undefined,
          approvalRequiredCount: 1,
          highRiskCount: 1,
          healthState: 'healthy',
          healthReason: undefined,
          capabilities: [
            {
              id: 'github-mcp:github.search_repos',
              serverId: 'github-mcp',
              toolName: 'github.search_repos',
              displayName: 'GitHub Search Repos',
              riskLevel: 'low',
              requiresApproval: false,
              category: 'knowledge'
            }
          ]
        }
      ])
    };
    c.orchestrator.listTasks = vi.fn(() => [
      {
        id: 'task-capability-1',
        goal: 'review repository pull requests',
        connectorRefs: ['github-mcp'],
        trace: [
          {
            node: 'tool_called',
            at: '2026-03-26T09:10:00.000Z',
            summary: 'called github.search_repos',
            data: { toolName: 'github.search_repos' }
          }
        ],
        updatedAt: '2026-03-26T09:10:00.000Z',
        createdAt: '2026-03-26T09:09:00.000Z',
        status: 'completed'
      }
    ]);

    await service.refreshConnectorDiscovery('github-mcp');
    await service.setCapabilityApprovalPolicy('github-mcp', 'github-mcp:github.search_repos', 'require-approval');
    const connectors = await service.getConnectorsCenter();
    const github = connectors.find((item: ConnectorsCenterItem) => item.id === 'github-mcp');

    expect(snapshot.governance.connectorDiscoveryHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: 'github-mcp',
          discoveryMode: 'remote',
          sessionState: 'connected',
          discoveredCapabilities: ['github.search_repos', 'github.create_issue_comment']
        })
      ])
    );
    expect(github).toEqual(
      expect.objectContaining({
        id: 'github-mcp',
        command: 'npx',
        args: ['-y', 'github-mcp-server'],
        configuredAt: '2026-03-26T09:00:00.000Z',
        configurationTemplateId: 'github-mcp-template',
        recentGovernanceAudits: expect.arrayContaining([
          expect.objectContaining({ action: 'connector.configured', targetId: 'github-mcp' })
        ]),
        discoveryHistory: expect.arrayContaining([
          expect.objectContaining({ connectorId: 'github-mcp', discoveryMode: 'remote' })
        ]),
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            toolName: 'github.search_repos',
            effectiveApprovalMode: 'require-approval',
            usageCount: 1,
            recentTaskGoals: ['review repository pull requests'],
            recentTasks: [
              expect.objectContaining({
                taskId: 'task-capability-1',
                goal: 'review repository pull requests',
                approvalCount: 0,
                latestTraceSummary: 'called github.search_repos'
              })
            ]
          })
        ])
      })
    );
    expect(c.mcpCapabilityRegistry.setCapabilityApprovalOverride).toHaveBeenCalledWith(
      'github-mcp:github.search_repos',
      'require-approval'
    );
    expect(snapshot.governance.capabilityPolicyOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: 'github-mcp',
          capabilityId: 'github-mcp:github.search_repos',
          effect: 'require-approval'
        })
      ])
    );
  });
});
