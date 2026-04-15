import { describe, expect, it, vi } from 'vitest';

import {
  appendGovernanceAudit,
  getRecentGovernanceAudit,
  listCapabilityGovernanceProfiles,
  listGovernanceProfiles,
  listApprovalScopePolicies,
  persistConnectorDiscoverySnapshot,
  recordApprovalScopePolicyMatch,
  revokeApprovalScopePolicy,
  syncCapabilityGovernanceProfiles,
  toConnectorDiscoveryHistoryRecord,
  upsertApprovalScopePolicy
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

  it('会新增 更新 排序 撤销并记录 approval scope policy 命中次数', async () => {
    let snapshot: any = {
      governance: {
        approvalScopePolicies: [
          {
            id: 'policy-old',
            status: 'active',
            scope: 'connector',
            approvalScope: 'connector',
            actor: 'agent-admin-user',
            sourceDomain: 'github.com',
            requestedBy: 'user-a',
            matchKey: 'old',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
            matchCount: 1
          },
          {
            id: 'policy-revoked',
            status: 'revoked',
            scope: 'connector',
            approvalScope: 'connector',
            actor: 'agent-admin-user',
            sourceDomain: 'example.com',
            requestedBy: 'user-b',
            matchKey: 'revoked',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            revokedAt: '2026-02-02T00:00:00.000Z',
            revokedBy: 'agent-admin-user',
            matchCount: 0
          }
        ]
      }
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };

    const created = await upsertApprovalScopePolicy(runtimeStateRepository as any, {
      status: 'active',
      scope: 'connector',
      approvalScope: 'connector',
      actor: 'agent-admin-user',
      sourceDomain: 'github.com',
      requestedBy: 'user-c',
      toolName: 'github.create_issue_comment'
    });

    expect(created).toEqual(
      expect.objectContaining({
        status: 'active',
        scope: 'connector',
        toolName: 'github.create_issue_comment',
        matchCount: 0
      })
    );

    const updated = await upsertApprovalScopePolicy(runtimeStateRepository as any, {
      id: created.id,
      status: 'active',
      scope: 'connector',
      approvalScope: 'connector',
      actor: 'agent-admin-user',
      sourceDomain: 'github.com',
      requestedBy: 'user-d',
      toolName: 'github.create_issue_comment',
      riskCode: 'write-risk'
    });

    expect(updated.id).toBe(created.id);
    expect(updated.riskCode).toBe('write-risk');
    expect(Date.parse(updated.createdAt)).not.toBeNaN();
    expect(Date.parse(updated.createdAt)).toBeLessThanOrEqual(Date.parse(updated.updatedAt));

    const matched = await recordApprovalScopePolicyMatch(runtimeStateRepository as any, created.id);
    expect(matched).toEqual(
      expect.objectContaining({
        id: created.id,
        matchCount: 1
      })
    );

    const revoked = await revokeApprovalScopePolicy(runtimeStateRepository as any, created.id, 'reviewer-a');
    expect(revoked).toEqual(
      expect.objectContaining({
        id: created.id,
        status: 'revoked',
        revokedBy: 'reviewer-a'
      })
    );

    expect(
      await revokeApprovalScopePolicy(runtimeStateRepository as any, 'missing-policy', 'reviewer-a')
    ).toBeUndefined();
    expect(await recordApprovalScopePolicyMatch(runtimeStateRepository as any, 'missing-policy')).toBeUndefined();

    snapshot.governance.approvalScopePolicies.push({
      id: 'policy-newer',
      status: 'active',
      scope: 'connector',
      approvalScope: 'connector',
      actor: 'agent-admin-user',
      sourceDomain: 'lark.com',
      requestedBy: 'user-e',
      matchKey: 'newer',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      matchCount: 0
    });

    await expect(listApprovalScopePolicies(runtimeStateRepository as any)).resolves.toEqual([
      expect.objectContaining({ id: created.id }),
      expect.objectContaining({ id: 'policy-newer' }),
      expect.objectContaining({ id: 'policy-old' })
    ]);
  });
});
