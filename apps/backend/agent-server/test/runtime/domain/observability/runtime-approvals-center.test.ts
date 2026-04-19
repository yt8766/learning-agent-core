import { describe, expect, it } from 'vitest';

import { buildApprovalsCenterRecords } from '../../../../src/runtime/domain/observability/runtime-approvals-center';

describe('runtime approvals center', () => {
  it('filters approvals by execution mode and interaction kind and maps approval fields', () => {
    const records = buildApprovalsCenterRecords({
      tasks: [
        {
          id: 'task-terminal',
          goal: 'Inspect production logs',
          status: 'waiting_approval',
          sessionId: 'session-1',
          currentMinistry: 'gongbu',
          currentWorker: 'worker-1',
          executionMode: 'plan',
          streamStatus: { updatedAt: '2026-04-01T10:00:00.000Z' },
          contextFilterState: { active: true },
          pendingApproval: { reasonCode: 'policy-match' },
          activeInterrupt: {
            kind: 'tool',
            interactionKind: 'terminal-command',
            payload: {
              commandPreview: 'pnpm test',
              riskReason: 'Writes to disk',
              riskCode: 'destructive-command',
              approvalScope: 'workspace-write'
            }
          },
          entryDecision: { route: 'code' },
          interruptHistory: [{ id: 'interrupt-1' }],
          planDraft: { summary: 'Plan draft' },
          approvals: [{ id: 'approval-1' }]
        },
        {
          id: 'task-approval',
          goal: 'Ship fix',
          status: 'waiting_approval',
          sessionId: 'session-2',
          currentMinistry: 'hubu',
          currentWorker: 'worker-2',
          executionPlan: { mode: 'execute' },
          pendingApproval: { reasonCode: 'manual' },
          activeInterrupt: {
            kind: 'approval',
            payload: {
              interactionKind: 'approval'
            }
          }
        }
      ] as any,
      getMinistryDisplayName: ministry => (ministry === 'gongbu' ? '工部' : ministry),
      filters: {
        executionMode: 'plan',
        interactionKind: 'terminal-command'
      }
    });

    expect(records).toEqual([
      expect.objectContaining({
        taskId: 'task-terminal',
        currentMinistry: '工部',
        executionMode: 'plan',
        commandPreview: 'pnpm test',
        riskReason: 'Writes to disk',
        riskCode: 'destructive-command',
        approvalScope: 'workspace-write',
        policyMatchStatus: 'manual-pending',
        policyMatchSource: 'manual',
        lastStreamStatusAt: '2026-04-01T10:00:00.000Z'
      })
    ]);
  });
});
