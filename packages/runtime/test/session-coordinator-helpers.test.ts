import { describe, expect, it } from 'vitest';

import { ActionIntent, ApprovalDecision, type ApprovalScopePolicyRecord, type ChatCheckpointRecord } from '@agent/core';
import { buildApprovalScopeMatchKey } from '@agent/runtime';

import {
  resolveApprovalEventType,
  resolveSessionAutoApprovalPolicy
} from '../src/session/coordinator/session-coordinator-approvals';
import {
  buildApprovalScopeMatchInput,
  upsertRuntimeApprovalPolicy,
  upsertSessionApprovalPolicy
} from '../src/session/coordinator/session-coordinator-approval-policy';
import { dedupeById, finalizeInlineCapabilityCheckpoint } from '../src/session/coordinator/session-coordinator-inline';

describe('session coordinator helpers', () => {
  it('dedupes capability records by id while keeping the latest entry', () => {
    expect(
      dedupeById([
        { id: 'cap-1', value: 1 },
        { id: 'cap-2', value: 2 },
        { id: 'cap-1', value: 3 }
      ])
    ).toEqual([
      { id: 'cap-1', value: 3 },
      { id: 'cap-2', value: 2 }
    ]);
  });

  it('finalizes inline capability checkpoint into a completed and cleared state', () => {
    const checkpoint: ChatCheckpointRecord = {
      sessionId: 'session-1',
      taskId: 'inline-capability:session-1',
      checkpointId: 'checkpoint-1',
      checkpointCursor: 0,
      recoverability: 'partial',
      updatedAt: '2026-04-16T00:00:00.000Z',
      pendingApprovals: [{ intent: ActionIntent.WRITE_FILE }],
      pendingApproval: {
        toolName: 'filesystem',
        intent: ActionIntent.WRITE_FILE
      },
      activeInterrupt: {
        id: 'interrupt-1',
        status: 'pending',
        source: 'graph',
        createdAt: '2026-04-16T00:00:00.000Z'
      } as never,
      pendingAction: {
        intent: ActionIntent.WRITE_FILE
      } as never,
      graphState: {
        status: 'running'
      } as never,
      thinkState: {
        loading: true,
        blink: true
      } as never,
      streamStatus: {
        messageId: 'msg-1',
        mode: 'streaming'
      } as never
    };

    finalizeInlineCapabilityCheckpoint(checkpoint, '2026-04-16T08:00:00.000Z');

    expect(checkpoint.updatedAt).toBe('2026-04-16T08:00:00.000Z');
    expect(checkpoint.graphState).toMatchObject({ status: 'completed' });
    expect(checkpoint.pendingApprovals).toEqual([]);
    expect(checkpoint.pendingApproval).toBeUndefined();
    expect(checkpoint.activeInterrupt).toBeUndefined();
    expect(checkpoint.pendingAction).toBeUndefined();
    expect(checkpoint.streamStatus).toBeUndefined();
    expect(checkpoint.thinkState).toMatchObject({ loading: false, blink: false });
  });

  it('builds approval scope match input from pending approval and interrupt payload', () => {
    const input = buildApprovalScopeMatchInput({
      id: 'task-1',
      pendingApproval: {
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        requestedBy: 'gongbu-code',
        reasonCode: 'requires_approval_write'
      },
      activeInterrupt: {
        id: 'interrupt-1',
        status: 'pending',
        source: 'graph',
        payload: {
          commandPreview: 'write apps/frontend/agent-chat/src/App.tsx'
        },
        createdAt: '2026-04-16T00:00:00.000Z'
      },
      currentMinistry: 'gongbu-code'
    } as never);

    expect(input).toMatchObject({
      intent: ActionIntent.WRITE_FILE,
      toolName: 'filesystem',
      riskCode: 'requires_approval_write',
      requestedBy: 'gongbu-code',
      commandPreview: 'write apps/frontend/agent-chat/src/App.tsx'
    });
  });

  it('upserts approval policies by match key without duplicating active entries', () => {
    const existing: ApprovalScopePolicyRecord = {
      id: 'policy-1',
      scope: 'session',
      approvalScope: 'session',
      status: 'active',
      matchKey: 'write-file',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      matchCount: 0
    };
    const replacement: ApprovalScopePolicyRecord = {
      ...existing,
      id: 'policy-2',
      updatedAt: '2026-04-16T08:00:00.000Z',
      actor: 'agent-chat-user'
    };

    const sessionPolicies = upsertSessionApprovalPolicy([existing], replacement);
    const runtimePolicies = upsertRuntimeApprovalPolicy([], {
      ...replacement,
      scope: 'always',
      approvalScope: 'always'
    });

    expect(sessionPolicies).toHaveLength(1);
    expect(sessionPolicies[0]).toMatchObject({
      id: 'policy-1',
      actor: 'agent-chat-user'
    });
    expect(runtimePolicies).toHaveLength(1);
    expect(runtimePolicies[0]).toMatchObject({
      scope: 'always'
    });
  });

  it('derives approval event type from decision and interrupt context', () => {
    expect(
      resolveApprovalEventType(
        ApprovalDecision.APPROVED,
        { status: 'cancelled' } as never,
        {
          intent: ActionIntent.WRITE_FILE
        } as never
      )
    ).toBe('run_cancelled');

    expect(
      resolveApprovalEventType(
        ApprovalDecision.REJECTED,
        { activeInterrupt: { id: 'interrupt-1' } } as never,
        {
          intent: ActionIntent.WRITE_FILE,
          feedback: 'need safer path'
        } as never
      )
    ).toBe('interrupt_rejected_with_feedback');
  });

  it('prefers session approval policy before default auto approve', async () => {
    const pendingTask = {
      id: 'task-1',
      status: 'waiting_approval',
      pendingApproval: {
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        requestedBy: 'gongbu-code'
      }
    } as never;
    const sessionPolicy: ApprovalScopePolicyRecord = {
      id: 'policy-session',
      scope: 'session',
      approvalScope: 'session',
      status: 'active',
      matchKey: buildApprovalScopeMatchKey(buildApprovalScopeMatchInput(pendingTask)),
      intent: ActionIntent.WRITE_FILE,
      toolName: 'filesystem',
      requestedBy: 'gongbu-code',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      matchCount: 0
    };
    const runtimeStateRepository = {
      load: async () => ({ governance: { approvalScopePolicies: [] } }),
      save: async () => undefined
    };

    const policy = await resolveSessionAutoApprovalPolicy(
      runtimeStateRepository as never,
      {
        id: 'session-1',
        title: 'demo',
        status: 'running',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        approvalPolicies: {
          sessionAllowRules: [sessionPolicy]
        }
      } as never,
      pendingTask
    );

    expect(policy).toMatchObject({
      actor: 'agent-chat-session-policy',
      source: 'session'
    });
  });
});
