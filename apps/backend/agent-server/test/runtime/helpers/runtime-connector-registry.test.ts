import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyGovernanceOverrides,
  getDisabledCompanyWorkerIds,
  registerConfiguredConnector,
  registerDiscoveredCapabilities
} from '../../../src/runtime/helpers/runtime-connector-registry';

describe('runtime-connector-registry', () => {
  let context: any;

  beforeEach(() => {
    context = {
      settings: {
        workspaceRoot: '/workspace',
        skillsRoot: '/skills',
        skillSourcesRoot: '/skill-sources',
        profile: 'personal',
        policy: { sourcePolicyMode: 'allowlist' },
        zhipuModels: {
          research: 'glm-research',
          reviewer: 'glm-reviewer',
          executor: 'glm-executor',
          manager: 'glm-manager'
        }
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
        describeServers: vi.fn(() => [])
      },
      orchestrator: {
        setWorkerEnabled: vi.fn(),
        listWorkers: vi.fn(() => []),
        isWorkerEnabled: vi.fn(() => true),
        registerWorker: vi.fn()
      }
    };
  });

  it('applies governance overrides across configured connectors, workers and approval policies', () => {
    applyGovernanceOverrides(context, {
      governance: {
        configuredConnectors: [
          {
            connectorId: 'github-mcp',
            templateId: 'github-mcp-template',
            transport: 'http',
            endpoint: 'https://example.test/mcp',
            apiKey: 'secret'
          } as any
        ],
        disabledCompanyWorkerIds: ['worker-disabled'],
        disabledConnectorIds: ['browser-mcp'],
        connectorPolicyOverrides: [{ connectorId: 'github-mcp', effect: 'observe' }],
        capabilityPolicyOverrides: [{ capabilityId: 'github-mcp:github.create_issue_comment', effect: 'deny' }]
      }
    });

    expect(context.mcpServerRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'github-mcp',
        source: 'github-configured',
        headers: { Authorization: 'Bearer secret' }
      })
    );
    expect(context.orchestrator.setWorkerEnabled).toHaveBeenCalledWith('worker-disabled', false);
    expect(context.mcpServerRegistry.setEnabled).toHaveBeenCalledWith('browser-mcp', false);
    expect(context.mcpCapabilityRegistry.setServerApprovalOverride).toHaveBeenCalledWith('github-mcp', 'observe');
    expect(context.mcpCapabilityRegistry.setCapabilityApprovalOverride).toHaveBeenCalledWith(
      'github-mcp:github.create_issue_comment',
      'deny'
    );
  });

  it('registers configured github, lark and browser connectors with their expected capabilities', () => {
    registerConfiguredConnector(context, {
      connectorId: 'github-mcp',
      templateId: 'github-mcp-template',
      transport: 'http',
      endpoint: 'https://example.test/github',
      apiKey: 'gh-secret',
      displayName: 'Custom GitHub MCP'
    } as any);
    registerConfiguredConnector(context, {
      connectorId: 'lark-mcp',
      templateId: 'lark-mcp-template',
      transport: 'stdio',
      command: 'npx',
      args: ['lark-mcp'],
      apiKey: 'lark-secret'
    } as any);
    registerConfiguredConnector(context, {
      connectorId: 'browser-mcp',
      templateId: 'browser-mcp-template',
      transport: 'stdio',
      command: 'npx',
      args: ['browser-mcp']
    } as any);

    expect(context.mcpServerRegistry.register).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'github-mcp',
        displayName: 'Custom GitHub MCP',
        source: 'github-configured',
        dataScope: 'repos, pull requests, issues and workflows',
        writeScope: 'repository operations after approval',
        headers: { Authorization: 'Bearer gh-secret' }
      })
    );
    expect(context.mcpServerRegistry.register).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'lark-mcp',
        source: 'lark-configured',
        env: {
          GITHUB_TOKEN: 'lark-secret',
          BROWSER_API_KEY: 'lark-secret',
          LARK_MCP_TOKEN: 'lark-secret'
        }
      })
    );
    expect(context.mcpServerRegistry.register).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        id: 'browser-mcp',
        source: 'browser-configured',
        writeScope: 'browser actions after approval'
      })
    );

    expect(context.mcpCapabilityRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'github-mcp:github.create_issue_comment',
        category: 'action',
        requiresApproval: true,
        riskLevel: 'high'
      })
    );
    expect(context.mcpCapabilityRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lark-mcp:lark.search_docs',
        category: 'knowledge',
        requiresApproval: false
      })
    );
    expect(context.mcpCapabilityRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'browser-mcp:browser.open_page',
        category: 'action',
        writeScope: 'browser navigation'
      })
    );
  });

  it('registers only newly discovered capabilities and derives display and approval metadata', () => {
    context.mcpClientManager.describeServers.mockReturnValue([
      {
        id: 'browser-mcp',
        dataScope: 'browser session data',
        writeScope: 'browser actions',
        discoveredCapabilities: ['browser.capture_screenshot', 'browser.open_page', 'browser.capture_screenshot']
      }
    ]);
    context.mcpCapabilityRegistry.listByServer.mockReturnValue([{ toolName: 'browser.capture_screenshot' }]);

    registerDiscoveredCapabilities(context, 'browser-mcp');

    expect(context.mcpCapabilityRegistry.register).toHaveBeenCalledTimes(1);
    expect(context.mcpCapabilityRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'browser-mcp:browser.open_page',
        displayName: 'Browser Open Page',
        riskLevel: 'high',
        requiresApproval: true,
        category: 'action',
        dataScope: 'browser session data',
        writeScope: 'browser actions'
      })
    );
  });

  it('returns disabled company workers based on orchestrator enabled state', () => {
    context.orchestrator.listWorkers.mockReturnValue([
      { id: 'worker-enabled', kind: 'company' },
      { id: 'worker-disabled', kind: 'company' },
      { id: 'worker-personal', kind: 'personal' }
    ]);
    context.orchestrator.isWorkerEnabled.mockImplementation((workerId: string) => workerId !== 'worker-disabled');

    expect(getDisabledCompanyWorkerIds(context)).toEqual(['worker-disabled']);
  });
});
