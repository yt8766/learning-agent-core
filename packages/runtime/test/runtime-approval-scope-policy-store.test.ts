import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listActiveApprovalScopePolicies,
  revokeApprovalScopePolicyWithAudit
} from '../src/governance/runtime-approval-scope-policy-store';

describe('runtime-approval-scope-policy-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T10:00:00.000Z'));
  });

  it('lists only active approval scope policies', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        governance: {
          approvalScopePolicies: [
            { id: 'revoked', status: 'revoked', updatedAt: '2026-04-19T08:00:00.000Z' },
            { id: 'active-2', status: 'active', updatedAt: '2026-04-19T09:00:00.000Z' },
            { id: 'active-1', status: 'active', updatedAt: '2026-04-19T07:00:00.000Z' }
          ]
        }
      }))
    };

    await expect(listActiveApprovalScopePolicies(runtimeStateRepository as any)).resolves.toEqual([
      expect.objectContaining({ id: 'active-2', status: 'active' }),
      expect.objectContaining({ id: 'active-1', status: 'active' })
    ]);
  });

  it('revokes approval scope policies and appends governance audit records', async () => {
    let snapshot = {
      governance: {
        approvalScopePolicies: [
          {
            id: 'policy-1',
            status: 'active',
            scope: 'once',
            actor: 'agent-admin-user',
            sourceDomain: 'runtime',
            intent: 'write_file',
            approvalScope: 'once',
            matchKey: 'write_file',
            createdAt: '2026-04-18T10:00:00.000Z',
            updatedAt: '2026-04-18T10:00:00.000Z',
            matchCount: 0
          }
        ]
      },
      governanceAudit: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async nextSnapshot => {
        snapshot = nextSnapshot;
      })
    };

    const revoked = await revokeApprovalScopePolicyWithAudit(runtimeStateRepository as any, 'policy-1', 'reviewer-a');

    expect(revoked).toEqual(
      expect.objectContaining({
        id: 'policy-1',
        status: 'revoked',
        revokedBy: 'reviewer-a',
        revokedAt: '2026-04-19T10:00:00.000Z'
      })
    );
    expect(snapshot.governance.approvalScopePolicies[0]).toEqual(expect.objectContaining({ status: 'revoked' }));
    expect(snapshot.governanceAudit[0]).toEqual(
      expect.objectContaining({
        actor: 'reviewer-a',
        action: 'approval-policy.revoked',
        targetId: 'policy-1',
        outcome: 'success'
      })
    );

    await expect(
      revokeApprovalScopePolicyWithAudit(runtimeStateRepository as any, 'missing-policy', 'reviewer-a')
    ).resolves.toBeUndefined();
    expect(snapshot.governanceAudit[0]).toEqual(
      expect.objectContaining({
        action: 'approval-policy.revoked',
        targetId: 'missing-policy',
        outcome: 'rejected'
      })
    );
  });
});
