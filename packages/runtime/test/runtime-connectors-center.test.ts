import { describe, expect, it } from 'vitest';

import { buildConnectorsCenter } from '../src/runtime/runtime-connectors-center';

describe('buildConnectorsCenter', () => {
  it('projects connector governance, capability usage, and global knowledge ingestion summary', () => {
    const result = buildConnectorsCenter({
      profile: 'personal' as any,
      snapshot: {
        governance: {
          configuredConnectors: [{ connectorId: 'github-mcp', configuredAt: '2026-04-01T08:00:00.000Z' }],
          connectorDiscoveryHistory: [
            {
              connectorId: 'github-mcp',
              discoveredAt: '2026-04-01T09:00:00.000Z',
              error: 'stale capability cache'
            }
          ],
          connectorPolicyOverrides: [
            {
              connectorId: 'github-mcp',
              effect: 'observe',
              reason: 'connector override'
            }
          ],
          capabilityPolicyOverrides: [
            {
              capabilityId: 'github-mcp:create_issue',
              effect: 'require-approval',
              reason: 'capability override'
            }
          ]
        },
        governanceAudit: [
          {
            scope: 'connector',
            targetId: 'github-mcp',
            action: 'connector.policy.updated'
          }
        ]
      } as any,
      tasks: [
        {
          id: 'task-1',
          goal: 'Open incident ticket',
          status: 'completed',
          connectorRefs: ['github-mcp'],
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          approvals: [{ id: 'approval-1' }],
          trace: [{ summary: 'create_issue finished', node: 'create_issue', data: { toolName: 'create_issue' } }]
        },
        {
          id: 'task-2',
          goal: 'Retry failed issue sync',
          status: 'failed',
          connectorRefs: ['github-mcp'],
          createdAt: '2026-04-01T11:00:00.000Z',
          updatedAt: '2026-04-01T12:00:00.000Z',
          result: 'provider timeout',
          approvals: [],
          trace: [{ summary: 'create_issue failed', node: 'create_issue', data: { toolName: 'create_issue' } }]
        }
      ] as any,
      connectors: [
        {
          id: 'github-mcp',
          displayName: 'GitHub MCP',
          transport: 'stdio',
          enabled: true,
          healthState: 'healthy',
          healthReason: 'ready',
          source: 'configured',
          trustClass: 'official',
          dataScope: 'repos',
          writeScope: 'issues',
          installationMode: 'configured',
          allowedProfiles: ['personal'],
          capabilityCount: 1,
          implementedCapabilityCount: 1,
          discoveredCapabilityCount: 1,
          lastDiscoveredAt: '2026-04-01T07:00:00.000Z',
          lastDiscoveryError: 'old error',
          capabilities: [
            {
              id: 'github-mcp:create_issue',
              toolName: 'create_issue',
              riskLevel: 'high',
              requiresApproval: true
            }
          ]
        }
      ] as any,
      knowledgeOverview: {
        sourceCount: 6,
        searchableDocumentCount: 4,
        blockedDocumentCount: 2,
        latestReceipts: [{ id: 'receipt-1' }, { id: 'receipt-2' }]
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'github-mcp',
        configuredAt: '2026-04-01T08:00:00.000Z',
        successRate: 0.5,
        recentFailureReason: 'provider timeout',
        lastDiscoveredAt: '2026-04-01T09:00:00.000Z',
        lastDiscoveryError: 'stale capability cache',
        knowledgeIngestion: {
          sourceCount: 6,
          searchableDocumentCount: 4,
          blockedDocumentCount: 2,
          latestReceiptIds: ['receipt-1', 'receipt-2']
        },
        recentGovernanceAudits: [expect.objectContaining({ action: 'connector.policy.updated' })]
      })
    );
    expect(result[0]?.approvalPolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: 'github-mcp',
          targetId: 'github-mcp',
          reason: 'connector override'
        }),
        expect.objectContaining({
          connectorId: 'github-mcp',
          capabilityId: 'github-mcp:create_issue',
          reason: 'capability override'
        })
      ])
    );
    expect(result[0]?.capabilities).toEqual([
      expect.objectContaining({
        id: 'github-mcp:create_issue',
        effectiveApprovalMode: 'require-approval',
        usageCount: 2,
        recentTaskGoals: ['Retry failed issue sync', 'Open incident ticket'],
        recentTasks: [
          expect.objectContaining({ taskId: 'task-2', latestTraceSummary: 'create_issue failed' }),
          expect.objectContaining({ taskId: 'task-1', latestTraceSummary: 'create_issue finished' })
        ]
      })
    ]);
  });
});
