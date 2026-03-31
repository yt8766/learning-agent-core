import { describe, expect, it, vi } from 'vitest';

import {
  appendGovernanceAudit,
  getRecentGovernanceAudit,
  listCapabilityGovernanceProfiles,
  listGovernanceProfiles,
  persistConnectorDiscoverySnapshot,
  syncCapabilityGovernanceProfiles,
  toConnectorDiscoveryHistoryRecord
} from '../../../src/runtime/helpers/runtime-governance-store';

describe('runtime-governance-store', () => {
  it('会生成 connector discovery 历史记录', () => {
    const record = toConnectorDiscoveryHistoryRecord('github-mcp', {
      id: 'github-mcp',
      discoveryMode: 'remote',
      transport: 'stdio',
      discoveredCapabilities: ['github.search_repos']
    } as any);

    expect(record).toEqual(
      expect.objectContaining({
        connectorId: 'github-mcp',
        discoveryMode: 'remote',
        sessionState: 'disconnected',
        discoveredCapabilities: ['github.search_repos']
      })
    );
  });

  it('会持久化 discovery history 和 governance audit', async () => {
    let snapshot: any = {
      governance: { connectorDiscoveryHistory: [] },
      governanceAudit: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };

    await persistConnectorDiscoverySnapshot(
      runtimeStateRepository as any,
      {
        describeServers: () => [
          {
            id: 'github-mcp',
            transport: 'stdio',
            discoveryMode: 'remote',
            discoveredCapabilities: ['github.search_repos']
          }
        ]
      } as any,
      'github-mcp'
    );

    await appendGovernanceAudit(runtimeStateRepository as any, {
      actor: 'agent-admin-user',
      action: 'connector.discovery.refreshed',
      scope: 'connector',
      targetId: 'github-mcp',
      outcome: 'success'
    });

    expect(snapshot.governance.connectorDiscoveryHistory).toHaveLength(1);
    expect((await getRecentGovernanceAudit(runtimeStateRepository as any)).length).toBe(1);
  });

  it('会把 task 上的 capability 治理画像同步到独立 runtime governance store', async () => {
    let snapshot: any = {
      governance: {
        connectorDiscoveryHistory: [],
        capabilityGovernanceProfiles: []
      },
      governanceAudit: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };

    const profiles = await syncCapabilityGovernanceProfiles(
      runtimeStateRepository as any,
      [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          currentWorker: 'worker-product-review',
          specialistLead: {
            domain: 'product-strategy',
            displayName: '产品策略'
          },
          governanceReport: {
            summary: '治理链建议继续提升信任。',
            reviewOutcome: {
              decision: 'pass',
              summary: '终审通过。'
            },
            trustAdjustment: 'promote',
            updatedAt: '2026-03-31T00:00:00.000Z'
          },
          capabilityAttachments: [
            {
              id: 'skill-product-review',
              displayName: 'Product Review',
              kind: 'skill',
              owner: { ownerType: 'specialist-owned' },
              capabilityTrust: {
                trustLevel: 'high',
                trustTrend: 'up',
                lastReason: '终审通过。',
                lastGovernanceSummary: '治理链建议提升信任。',
                updatedAt: '2026-03-31T00:00:00.000Z'
              },
              governanceProfile: {
                reportCount: 4,
                promoteCount: 3,
                holdCount: 1,
                downgradeCount: 0,
                passCount: 3,
                reviseRequiredCount: 1,
                blockCount: 0,
                lastTaskId: 'task-1',
                lastReviewDecision: 'pass',
                lastTrustAdjustment: 'promote',
                recentOutcomes: [
                  {
                    taskId: 'task-1',
                    reviewDecision: 'pass',
                    trustAdjustment: 'promote',
                    updatedAt: '2026-03-31T00:00:00.000Z'
                  }
                ],
                updatedAt: '2026-03-31T00:00:00.000Z'
              }
            }
          ]
        }
      ] as any
    );

    expect(profiles).toEqual([
      expect.objectContaining({
        capabilityId: 'skill-product-review',
        reportCount: 4,
        promoteCount: 3,
        trustLevel: 'high'
      })
    ]);
    expect(await listCapabilityGovernanceProfiles(runtimeStateRepository as any)).toEqual([
      expect.objectContaining({
        capabilityId: 'skill-product-review',
        lastTaskId: 'task-1'
      })
    ]);
    expect(await listGovernanceProfiles(runtimeStateRepository as any, 'ministry')).toEqual([
      expect.objectContaining({
        entityId: 'hubu-search',
        entityKind: 'ministry'
      })
    ]);
    expect(await listGovernanceProfiles(runtimeStateRepository as any, 'worker')).toEqual([
      expect.objectContaining({
        entityId: 'worker-product-review',
        entityKind: 'worker'
      })
    ]);
    expect(await listGovernanceProfiles(runtimeStateRepository as any, 'specialist')).toEqual([
      expect.objectContaining({
        entityId: 'product-strategy',
        entityKind: 'specialist'
      })
    ]);
  });
});
