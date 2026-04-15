import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: React.ReactNode; onClick?: () => void }> = [];

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button onClick={onClick}>{children}</button>;
  }
}));

import { ConnectorCard } from '@/features/connectors-center/connector-card';

describe('ConnectorCard', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('renders connector metadata, feeds, and capability details', () => {
    const html = renderToStaticMarkup(
      <ConnectorCard
        connector={
          {
            id: 'remote-research',
            displayName: 'Remote Research MCP',
            healthState: 'healthy',
            transport: 'http',
            installationMode: 'configured',
            trustClass: 'curated',
            profilePolicy: { enabledByProfile: true, reason: 'allowed' },
            sessionState: 'connected',
            discoveryMode: 'remote',
            capabilityCount: 2,
            approvalRequiredCount: 1,
            highRiskCount: 0,
            successRate: 0.92,
            totalTaskCount: 3,
            activeTaskCount: 1,
            implementedCapabilityCount: 2,
            discoveredCapabilityCount: 2,
            healthReason: 'http_transport_ready',
            source: 'workspace-configured',
            authMode: 'header',
            dataScope: 'research source summaries',
            writeScope: 'none',
            allowedProfiles: ['platform', 'cli'],
            configurationTemplateId: 'browser-mcp-template',
            configuredAt: '2026-04-08T10:00:00.000Z',
            endpoint: 'https://mcp.example.com/research',
            command: 'npx',
            args: ['-y', 'mcp-server'],
            firstUsedAt: '2026-04-08T10:01:00.000Z',
            lastUsedAt: '2026-04-08T10:02:00.000Z',
            recentFailureReason: 'temporary timeout',
            recentTaskGoals: ['Collect research'],
            lastDiscoveredAt: '2026-04-08T10:03:00.000Z',
            sessionCreatedAt: '2026-04-08T10:04:00.000Z',
            sessionLastActivityAt: '2026-04-08T10:05:00.000Z',
            sessionRequestCount: 6,
            sessionIdleMs: 1200,
            lastDiscoveryError: 'fetch failed',
            approvalPolicies: [
              { id: 'policy-1', targetId: 'collect_research_source', mode: 'all-actions', reason: 'must review' }
            ],
            healthChecks: [
              { checkedAt: '2026-04-08T10:06:00.000Z', healthState: 'healthy', reason: 'http_transport_ready' }
            ],
            discoveryHistory: [
              {
                discoveredAt: '2026-04-08T10:07:00.000Z',
                discoveryMode: 'remote',
                sessionState: 'connected',
                discoveredCapabilities: ['collect_research_source'],
                error: 'none'
              }
            ],
            recentGovernanceAudits: [
              {
                id: 'audit-1',
                action: 'connector.configured',
                outcome: 'success',
                at: '2026-04-08',
                actor: 'admin',
                reason: 'bootstrapped'
              }
            ],
            discoveredCapabilities: ['collect_research_source'],
            capabilities: [
              {
                id: 'cap-1',
                toolName: 'collect_research_source',
                displayName: 'Collect research source',
                riskLevel: 'low',
                isPrimaryForTool: true,
                fallbackAvailable: true,
                requiresApproval: true,
                effectiveApprovalMode: 'require-approval',
                approvalPolicy: 'manual',
                trustClass: 'curated',
                dataScope: 'research',
                writeScope: 'none',
                usageCount: 4,
                policyReason: 'manual review',
                recentTaskGoals: ['Collect research'],
                recentTasks: [
                  {
                    taskId: 'task-1',
                    goal: 'Collect research',
                    status: 'completed',
                    approvalCount: 1,
                    latestTraceSummary: 'finished'
                  }
                ]
              }
            ]
          } as any
        }
        onSelectTask={vi.fn()}
        onCloseSession={vi.fn()}
        onRefreshConnectorDiscovery={vi.fn()}
        onEnableConnector={vi.fn()}
        onDisableConnector={vi.fn()}
        onSetConnectorPolicy={vi.fn()}
        onClearConnectorPolicy={vi.fn()}
        onSetCapabilityPolicy={vi.fn()}
        onClearCapabilityPolicy={vi.fn()}
        onOpenTemplateForm={vi.fn()}
      />
    );

    expect(html).toContain('Remote Research MCP');
    expect(html).toContain('profile allowed');
    expect(html).toContain('Configuration');
    expect(html).toContain('Recent Goals');
    expect(html).toContain('Approval Policies');
    expect(html).toContain('Health Checks');
    expect(html).toContain('Discovery History');
    expect(html).toContain('Governance Timeline');
    expect(html).toContain('Discovered Capabilities');
    expect(html).toContain('Task Drill-down');
    expect(html).toContain('collect_research_source');
  });

  it('routes connector, capability, task, template and session actions through callbacks', () => {
    const onSelectTask = vi.fn();
    const onCloseSession = vi.fn();
    const onRefreshConnectorDiscovery = vi.fn();
    const onEnableConnector = vi.fn();
    const onDisableConnector = vi.fn();
    const onSetConnectorPolicy = vi.fn();
    const onClearConnectorPolicy = vi.fn();
    const onSetCapabilityPolicy = vi.fn();
    const onClearCapabilityPolicy = vi.fn();
    const onOpenTemplateForm = vi.fn();

    renderToStaticMarkup(
      <ConnectorCard
        connector={
          {
            id: 'remote-research',
            displayName: 'Remote Research MCP',
            healthState: 'healthy',
            enabled: true,
            transport: 'stdio',
            installationMode: 'configured',
            sessionState: 'connected',
            capabilityCount: 1,
            approvalRequiredCount: 1,
            highRiskCount: 0,
            configurationTemplateId: 'browser-mcp-template',
            capabilities: [
              {
                id: 'cap-1',
                toolName: 'collect_research_source',
                displayName: 'Collect research source',
                riskLevel: 'low',
                recentTasks: [
                  {
                    taskId: 'task-1',
                    goal: 'Collect research',
                    status: 'completed',
                    approvalCount: 1
                  }
                ]
              }
            ]
          } as any
        }
        onSelectTask={onSelectTask}
        onCloseSession={onCloseSession}
        onRefreshConnectorDiscovery={onRefreshConnectorDiscovery}
        onEnableConnector={onEnableConnector}
        onDisableConnector={onDisableConnector}
        onSetConnectorPolicy={onSetConnectorPolicy}
        onClearConnectorPolicy={onClearConnectorPolicy}
        onSetCapabilityPolicy={onSetCapabilityPolicy}
        onClearCapabilityPolicy={onClearCapabilityPolicy}
        onOpenTemplateForm={onOpenTemplateForm}
      />
    );

    renderedButtons.find(item => item.children === '停用 connector')?.onClick?.();
    renderedButtons.find(item => item.children === '刷新发现')?.onClick?.();
    renderedButtons.find(item => item.children === '编辑配置')?.onClick?.();
    renderedButtons.find(item => item.children === '强制审批')?.onClick?.();
    renderedButtons.find(item => item.children === '允许直通')?.onClick?.();
    renderedButtons.find(item => item.children === '禁止执行')?.onClick?.();
    renderedButtons.find(item => item.children === '清除策略')?.onClick?.();
    renderedButtons.find(item => item.children === '关闭 session')?.onClick?.();
    renderedButtons.filter(item => item.children === '查看任务')[0]?.onClick?.();
    renderedButtons.filter(item => item.children === '审批')[0]?.onClick?.();
    renderedButtons.filter(item => item.children === '允许')[0]?.onClick?.();
    renderedButtons.filter(item => item.children === '禁止')[0]?.onClick?.();
    renderedButtons.filter(item => item.children === '清除')[0]?.onClick?.();

    expect(onDisableConnector).toHaveBeenCalledWith('remote-research');
    expect(onRefreshConnectorDiscovery).toHaveBeenCalledWith('remote-research');
    expect(onOpenTemplateForm).toHaveBeenCalledWith(
      'browser-mcp-template',
      expect.objectContaining({ id: 'remote-research' })
    );
    expect(onSetConnectorPolicy).toHaveBeenNthCalledWith(1, 'remote-research', 'require-approval');
    expect(onSetConnectorPolicy).toHaveBeenNthCalledWith(2, 'remote-research', 'allow');
    expect(onSetConnectorPolicy).toHaveBeenNthCalledWith(3, 'remote-research', 'deny');
    expect(onClearConnectorPolicy).toHaveBeenCalledWith('remote-research');
    expect(onCloseSession).toHaveBeenCalledWith('remote-research');
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
    expect(onSetCapabilityPolicy).toHaveBeenNthCalledWith(1, 'remote-research', 'cap-1', 'require-approval');
    expect(onSetCapabilityPolicy).toHaveBeenNthCalledWith(2, 'remote-research', 'cap-1', 'allow');
    expect(onSetCapabilityPolicy).toHaveBeenNthCalledWith(3, 'remote-research', 'cap-1', 'deny');
    expect(onClearCapabilityPolicy).toHaveBeenCalledWith('remote-research', 'cap-1');
    expect(onEnableConnector).not.toHaveBeenCalled();
  });
});
