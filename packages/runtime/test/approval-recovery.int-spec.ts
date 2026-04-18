import { describe, expect, it } from 'vitest';

import { ActionIntent, ApprovalDecision } from '@agent/core';

import { createApprovalRecoveryGraph } from '../src/graphs/approval/approval-recovery.graph';

describe('@agent/runtime approval recovery integration', () => {
  it('marks pending approval flows as approved by default', async () => {
    const graph = createApprovalRecoveryGraph().compile();

    const result = await graph.invoke({
      taskId: 'task-approval-1',
      goal: '在人工审批后继续执行高风险写文件动作',
      pending: {
        taskId: 'task-approval-1',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        researchSummary: '已确认需要在审批后继续写入目标文件。'
      }
    });

    expect(result).toMatchObject({
      taskId: 'task-approval-1',
      approvalStatus: ApprovalDecision.APPROVED
    });
  });

  it('runs custom execute and finish handlers in order', async () => {
    const steps: string[] = [];
    const graph = createApprovalRecoveryGraph({
      async executeApproved(state) {
        steps.push('execute_approved');
        return {
          ...state,
          approvalStatus: ApprovalDecision.APPROVED,
          executionSummary: `approved:${state.pending.toolName}`
        };
      },
      async finish(state) {
        steps.push('finish');
        return {
          ...state,
          executionSummary: `${state.executionSummary ?? 'approved'}:done`
        };
      }
    }).compile();

    const result = await graph.invoke({
      taskId: 'task-approval-2',
      goal: '审批通过后继续安装 skill',
      pending: {
        taskId: 'task-approval-2',
        intent: ActionIntent.INSTALL_SKILL,
        toolName: 'skill-installer',
        researchSummary: '该 skill 来源可信，等待人工批准后继续安装。'
      }
    });

    expect(steps).toEqual(['execute_approved', 'finish']);
    expect(result).toMatchObject({
      approvalStatus: ApprovalDecision.APPROVED,
      executionSummary: 'approved:skill-installer:done'
    });
  });
});
