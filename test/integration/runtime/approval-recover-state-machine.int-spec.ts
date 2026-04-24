import { describe, expect, it } from 'vitest';

import { ActionIntent, ApprovalDecision, RecoverToCheckpointDtoSchema, SessionApprovalDtoSchema } from '@agent/core';
import { createApprovalRecoveryGraph } from '@agent/runtime';

describe('approval recover state machine integration', () => {
  it('covers approve -> execute -> finish with stable approval DTO contracts', async () => {
    const approval = SessionApprovalDtoSchema.parse({
      sessionId: 'session-approval-1',
      actor: 'human',
      intent: ActionIntent.WRITE_FILE,
      approvalScope: 'session'
    });
    const steps: string[] = [];
    const graph = createApprovalRecoveryGraph({
      async executeApproved(state) {
        steps.push('execute_approved');
        return {
          ...state,
          approvalStatus: ApprovalDecision.APPROVED,
          executionSummary: `approved:${approval.intent}`,
          executionResult: {
            ok: true,
            summary: 'file write completed after approval'
          }
        };
      },
      async finish(state) {
        steps.push('finish');
        return {
          ...state,
          executionSummary: `${state.executionSummary}:finished`
        };
      }
    }).compile();

    const result = await graph.invoke({
      taskId: 'task-approval-1',
      goal: 'write a guarded file',
      pending: {
        taskId: 'task-approval-1',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        researchSummary: 'Human approval is required before filesystem mutation.'
      }
    });

    expect(steps).toEqual(['execute_approved', 'finish']);
    expect(result).toMatchObject({
      approvalStatus: ApprovalDecision.APPROVED,
      executionSummary: 'approved:write_file:finished',
      executionResult: { ok: true }
    });
  });

  it('keeps reject-with-feedback recover input parseable for checkpoint-based resume', () => {
    expect(() =>
      SessionApprovalDtoSchema.parse({
        sessionId: 'session-approval-2',
        actor: 'human',
        feedback: '收敛执行范围后再继续',
        interrupt: {
          action: 'feedback',
          feedback: '收敛执行范围后再继续'
        }
      })
    ).not.toThrow();

    expect(
      RecoverToCheckpointDtoSchema.parse({
        sessionId: 'session-approval-2',
        checkpointId: 'checkpoint-safe-1',
        checkpointCursor: 3,
        reason: 'resume after reject_with_feedback'
      })
    ).toMatchObject({
      sessionId: 'session-approval-2',
      checkpointId: 'checkpoint-safe-1',
      checkpointCursor: 3
    });
  });
});
