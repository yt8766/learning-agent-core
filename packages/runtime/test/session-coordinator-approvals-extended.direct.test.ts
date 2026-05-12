import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ApprovalDecision, TaskStatus } from '@agent/core';

vi.mock('../src/contracts/governance', () => ({
  matchesApprovalScopePolicy: vi.fn().mockReturnValue(false)
}));

vi.mock('../src/session/coordinator/session-coordinator-approval-policy', () => ({
  buildApprovalScopeMatchInput: vi.fn().mockReturnValue({}),
  findRuntimeApprovalScopePolicy: vi.fn().mockResolvedValue(undefined),
  persistApprovalScopePolicy: vi.fn(),
  recordPolicyAutoAllow: vi.fn()
}));

import {
  resolveSessionAutoApprovalPolicy,
  persistSessionApprovalScopePolicy
} from '../src/session/coordinator/session-coordinator-approvals';
import { matchesApprovalScopePolicy } from '../src/contracts/governance';
import { findRuntimeApprovalScopePolicy } from '../src/session/coordinator/session-coordinator-approval-policy';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.WAITING_APPROVAL,
    pendingApproval: { intent: 'write_file' },
    activeInterrupt: undefined,
    ...overrides
  };
}

function makeSession(overrides: Record<string, unknown> = {}): any {
  return { id: 'session-1', approvalPolicies: { sessionAllowRules: [] }, channelIdentity: undefined, ...overrides };
}

describe('session-coordinator-approvals extended (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveSessionAutoApprovalPolicy', () => {
    it('returns undefined when task is not waiting approval', async () => {
      expect(
        await resolveSessionAutoApprovalPolicy({} as any, makeSession(), makeTask({ status: TaskStatus.RUNNING }))
      ).toBeUndefined();
    });

    it('returns undefined when no pending approval intent', async () => {
      expect(
        await resolveSessionAutoApprovalPolicy({} as any, makeSession(), makeTask({ pendingApproval: undefined }))
      ).toBeUndefined();
    });

    it('returns session policy when matched', async () => {
      vi.mocked(matchesApprovalScopePolicy).mockReturnValue(true);
      const session = makeSession({ approvalPolicies: { sessionAllowRules: [{ id: 'policy-1' }] } });
      const result = await resolveSessionAutoApprovalPolicy({} as any, session, makeTask());
      expect(result).toBeDefined();
      expect(result!.source).toBe('session');
    });

    it('returns runtime policy when matched', async () => {
      vi.mocked(findRuntimeApprovalScopePolicy).mockResolvedValue({ id: 'runtime-policy' } as any);
      const result = await resolveSessionAutoApprovalPolicy({} as any, makeSession(), makeTask());
      expect(result).toBeDefined();
      expect(result!.source).toBe('always');
    });

    it('returns auto-approve when no channel identity', async () => {
      vi.mocked(findRuntimeApprovalScopePolicy).mockResolvedValue(undefined);
      const result = await resolveSessionAutoApprovalPolicy(
        {} as any,
        makeSession({ channelIdentity: undefined }),
        makeTask()
      );
      expect(result).toBeDefined();
      expect(result!.actor).toBe('agent-chat-auto-approve');
    });

    it('returns undefined when channel identity exists and no policies match', async () => {
      vi.mocked(findRuntimeApprovalScopePolicy).mockResolvedValue(undefined);
      expect(
        await resolveSessionAutoApprovalPolicy(
          {} as any,
          makeSession({ channelIdentity: { channelId: 'ch-1' } }),
          makeTask()
        )
      ).toBeUndefined();
    });
  });

  describe('persistSessionApprovalScopePolicy', () => {
    it('delegates to persistApprovalScopePolicy', async () => {
      await persistSessionApprovalScopePolicy({
        runtimeStateRepository: {} as any,
        session: makeSession(),
        task: makeTask(),
        dto: { intent: 'write_file' } as any
      });
      const { persistApprovalScopePolicy: persist } =
        await import('../src/session/coordinator/session-coordinator-approval-policy');
      expect(persist).toHaveBeenCalled();
    });
  });
});
