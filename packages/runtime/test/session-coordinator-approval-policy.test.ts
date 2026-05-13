import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, type ApprovalScopePolicyRecord } from '@agent/core';
import { buildApprovalScopeMatchKey } from '@agent/runtime';

import {
  buildApprovalScopeMatchInput,
  findRuntimeApprovalScopePolicy,
  persistApprovalScopePolicy,
  recordPolicyAutoAllow,
  upsertRuntimeApprovalPolicy,
  upsertSessionApprovalPolicy
} from '../src/session/coordinator/session-coordinator-approval-policy';

describe('session-coordinator-approval-policy', () => {
  describe('buildApprovalScopeMatchInput', () => {
    it('builds match input from pending approval fields', () => {
      const input = buildApprovalScopeMatchInput({
        pendingApproval: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          requestedBy: 'gongbu-code',
          reasonCode: 'requires_approval_write'
        }
      } as never);

      expect(input).toMatchObject({
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        riskCode: 'requires_approval_write',
        requestedBy: 'gongbu-code',
        commandPreview: undefined
      });
    });

    it('prefers activeInterrupt payload riskCode over pendingApproval reasonCode', () => {
      const input = buildApprovalScopeMatchInput({
        pendingApproval: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          requestedBy: 'gongbu-code',
          reasonCode: 'old_code'
        },
        activeInterrupt: {
          payload: { riskCode: 'new_code', commandPreview: 'rm -rf /' }
        }
      } as never);

      expect(input.riskCode).toBe('new_code');
      expect(input.commandPreview).toBe('rm -rf /');
    });

    it('falls back to currentMinistry when no requestedBy available', () => {
      const input = buildApprovalScopeMatchInput({
        pendingApproval: { intent: ActionIntent.WRITE_FILE },
        currentMinistry: 'hubu-search'
      } as never);

      expect(input.requestedBy).toBe('hubu-search');
    });

    it('handles missing activeInterrupt payload gracefully', () => {
      const input = buildApprovalScopeMatchInput({
        pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' },
        activeInterrupt: { payload: 'not-an-object' }
      } as never);

      expect(input.riskCode).toBeUndefined();
      expect(input.commandPreview).toBeUndefined();
    });

    it('handles undefined task fields', () => {
      const input = buildApprovalScopeMatchInput({} as never);
      expect(input).toMatchObject({
        intent: undefined,
        toolName: undefined,
        riskCode: undefined,
        requestedBy: undefined,
        commandPreview: undefined
      });
    });
  });

  describe('upsertSessionApprovalPolicy', () => {
    it('prepends new policy when no match found', () => {
      const existing: ApprovalScopePolicyRecord = {
        id: 'policy-1',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'other-key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      };
      const newPolicy: ApprovalScopePolicyRecord = {
        id: 'policy-2',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'new-key',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertSessionApprovalPolicy([existing], newPolicy);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('policy-2');
    });

    it('updates existing policy in-place while preserving id', () => {
      const existing: ApprovalScopePolicyRecord = {
        id: 'policy-1',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'same-key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      };
      const replacement: ApprovalScopePolicyRecord = {
        id: 'policy-2',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'same-key',
        actor: 'agent-chat-user',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertSessionApprovalPolicy([existing], replacement);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('policy-1'); // original id preserved
      expect(result[0].actor).toBe('agent-chat-user'); // new fields merged
    });

    it('caps at 50 session policies', () => {
      const policies = Array.from({ length: 50 }, (_, i) => ({
        id: `policy-${i}`,
        scope: 'session' as const,
        approvalScope: 'session' as const,
        status: 'active' as const,
        matchKey: `key-${i}`,
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      }));
      const newPolicy: ApprovalScopePolicyRecord = {
        id: 'policy-new',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'brand-new',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertSessionApprovalPolicy(policies, newPolicy);
      expect(result).toHaveLength(50);
      expect(result[0].id).toBe('policy-new');
    });

    it('only matches against active policies', () => {
      const existing: ApprovalScopePolicyRecord = {
        id: 'policy-1',
        scope: 'session',
        approvalScope: 'session',
        status: 'expired',
        matchKey: 'same-key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      };
      const newPolicy: ApprovalScopePolicyRecord = {
        id: 'policy-2',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'same-key',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertSessionApprovalPolicy([existing], newPolicy);
      expect(result).toHaveLength(2); // not merged since existing is expired
    });
  });

  describe('upsertRuntimeApprovalPolicy', () => {
    it('prepends new policy when no match found', () => {
      const newPolicy: ApprovalScopePolicyRecord = {
        id: 'policy-new',
        scope: 'always',
        approvalScope: 'always',
        status: 'active',
        matchKey: 'new-key',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertRuntimeApprovalPolicy([], newPolicy);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('policy-new');
    });

    it('updates existing policy while preserving original id', () => {
      const existing: ApprovalScopePolicyRecord = {
        id: 'rt-policy-1',
        scope: 'always',
        approvalScope: 'always',
        status: 'active',
        matchKey: 'same-key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      };
      const replacement: ApprovalScopePolicyRecord = {
        id: 'rt-policy-2',
        scope: 'always',
        approvalScope: 'always',
        status: 'active',
        matchKey: 'same-key',
        actor: 'agent-runtime-approval-policy',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 5
      };

      const result = upsertRuntimeApprovalPolicy([existing], replacement);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rt-policy-1');
      expect(result[0].actor).toBe('agent-runtime-approval-policy');
    });

    it('caps at 200 runtime policies', () => {
      const policies = Array.from({ length: 200 }, (_, i) => ({
        id: `rt-policy-${i}`,
        scope: 'always' as const,
        approvalScope: 'always' as const,
        status: 'active' as const,
        matchKey: `key-${i}`,
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      }));
      const newPolicy: ApprovalScopePolicyRecord = {
        id: 'rt-policy-new',
        scope: 'always',
        approvalScope: 'always',
        status: 'active',
        matchKey: 'brand-new',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
        matchCount: 0
      };

      const result = upsertRuntimeApprovalPolicy(policies, newPolicy);
      expect(result).toHaveLength(200);
      expect(result[0].id).toBe('rt-policy-new');
    });
  });

  describe('findRuntimeApprovalScopePolicy', () => {
    it('finds matching policy from runtime state', async () => {
      const matchInput = buildApprovalScopeMatchInput({
        pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' }
      } as never);
      const matchKey = buildApprovalScopeMatchKey(matchInput);

      const runtimeStateRepository = {
        load: async () => ({
          governance: {
            approvalScopePolicies: [
              {
                id: 'policy-1',
                scope: 'always',
                status: 'active',
                matchKey
              }
            ]
          }
        }),
        save: vi.fn()
      };

      const result = await findRuntimeApprovalScopePolicy(
        runtimeStateRepository as never,
        { pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' } } as never
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('policy-1');
    });

    it('returns undefined when no matching policy exists', async () => {
      const runtimeStateRepository = {
        load: async () => ({ governance: { approvalScopePolicies: [] } }),
        save: vi.fn()
      };

      const result = await findRuntimeApprovalScopePolicy(
        runtimeStateRepository as never,
        { pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' } } as never
      );

      expect(result).toBeUndefined();
    });

    it('handles missing governance in snapshot', async () => {
      const runtimeStateRepository = {
        load: async () => ({}),
        save: vi.fn()
      };

      const result = await findRuntimeApprovalScopePolicy(
        runtimeStateRepository as never,
        { pendingApproval: { intent: ActionIntent.WRITE_FILE } } as never
      );

      expect(result).toBeUndefined();
    });
  });

  describe('persistApprovalScopePolicy', () => {
    it('skips persistence for once scope', async () => {
      const runtimeStateRepository = {
        load: vi.fn(),
        save: vi.fn()
      };
      const session = { approvalPolicies: undefined } as any;

      await persistApprovalScopePolicy({
        runtimeStateRepository: runtimeStateRepository as never,
        session,
        task: { currentMinistry: 'gongbu-code', pendingApproval: {} } as never,
        dto: { approvalScope: 'once', actor: 'user' } as never
      });

      expect(runtimeStateRepository.load).not.toHaveBeenCalled();
      expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    });

    it('skips persistence when task is undefined', async () => {
      const runtimeStateRepository = {
        load: vi.fn(),
        save: vi.fn()
      };

      await persistApprovalScopePolicy({
        runtimeStateRepository: runtimeStateRepository as never,
        session: {} as never,
        task: undefined,
        dto: { approvalScope: 'session', actor: 'user' } as never
      });

      expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    });

    it('skips persistence when scope is undefined', async () => {
      const runtimeStateRepository = {
        load: vi.fn(),
        save: vi.fn()
      };

      await persistApprovalScopePolicy({
        runtimeStateRepository: runtimeStateRepository as never,
        session: {} as never,
        task: {} as never,
        dto: { actor: 'user' } as never
      });

      expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    });

    it('persists session-scoped policy to session object without repository save', async () => {
      const runtimeStateRepository = {
        load: vi.fn(),
        save: vi.fn()
      };
      const session: any = { approvalPolicies: undefined };

      await persistApprovalScopePolicy({
        runtimeStateRepository: runtimeStateRepository as never,
        session,
        task: {
          pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' },
          currentMinistry: 'gongbu-code'
        } as never,
        dto: { approvalScope: 'session', actor: 'user' } as never
      });

      expect(session.approvalPolicies).toBeDefined();
      expect(session.approvalPolicies.sessionAllowRules).toHaveLength(1);
      expect(session.approvalPolicies.sessionAllowRules[0].scope).toBe('session');
      expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    });

    it('persists always-scoped policy to runtime state repository', async () => {
      const savedSnapshot: any[] = [];
      const runtimeStateRepository = {
        load: async () => ({ governance: {}, governanceAudit: [] }),
        save: vi.fn(async (snapshot: any) => savedSnapshot.push(snapshot))
      };
      const session: any = {};

      await persistApprovalScopePolicy({
        runtimeStateRepository: runtimeStateRepository as never,
        session,
        task: {
          pendingApproval: { intent: ActionIntent.WRITE_FILE, toolName: 'fs' },
          currentMinistry: 'gongbu-code'
        } as never,
        dto: { approvalScope: 'always', actor: 'user' } as never
      });

      expect(runtimeStateRepository.save).toHaveBeenCalledTimes(1);
      expect(savedSnapshot[0].governance.approvalScopePolicies).toHaveLength(1);
      expect(savedSnapshot[0].governance.approvalScopePolicies[0].scope).toBe('always');
      expect(savedSnapshot[0].governanceAudit).toHaveLength(1);
      expect(savedSnapshot[0].governanceAudit[0].action).toBe('approval-policy.created');
    });
  });

  describe('recordPolicyAutoAllow', () => {
    it('appends audit entry and increments matchCount for always-scoped policy', async () => {
      const policy: ApprovalScopePolicyRecord = {
        id: 'policy-1',
        scope: 'always',
        approvalScope: 'always',
        status: 'active',
        matchKey: 'key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 3
      };
      const session: any = {};
      const snapshot: any = {
        governance: { approvalScopePolicies: [policy] },
        governanceAudit: []
      };
      const runtimeStateRepository = {
        load: async () => snapshot,
        save: vi.fn()
      };

      await recordPolicyAutoAllow({
        runtimeStateRepository: runtimeStateRepository as never,
        session,
        policy,
        task: { pendingApproval: { intent: ActionIntent.WRITE_FILE } } as never
      });

      expect(runtimeStateRepository.save).toHaveBeenCalledTimes(1);
      expect(snapshot.governanceAudit).toHaveLength(1);
      expect(snapshot.governanceAudit[0].action).toBe('approval-policy.auto-allowed');
      expect(snapshot.governance.approvalScopePolicies[0].matchCount).toBe(4);
    });

    it('updates session approval policies for session-scoped policy', async () => {
      const policy: ApprovalScopePolicyRecord = {
        id: 'policy-s1',
        scope: 'session',
        approvalScope: 'session',
        status: 'active',
        matchKey: 'key',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        matchCount: 0
      };
      const session: any = {
        approvalPolicies: {
          sessionAllowRules: [{ ...policy }]
        }
      };
      const snapshot: any = {
        governanceAudit: []
      };
      const runtimeStateRepository = {
        load: async () => snapshot,
        save: vi.fn()
      };

      await recordPolicyAutoAllow({
        runtimeStateRepository: runtimeStateRepository as never,
        session,
        policy,
        task: { activeInterrupt: { intent: ActionIntent.EXECUTE } } as never
      });

      expect(session.approvalPolicies.sessionAllowRules[0].matchCount).toBe(1);
    });
  });
});
