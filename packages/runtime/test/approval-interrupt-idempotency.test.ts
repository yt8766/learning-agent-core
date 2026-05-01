import { describe, expect, it } from 'vitest';

import { recordPendingApprovalOnce, recordPendingInterruptOnce } from '../src/flows/approval/interrupt-idempotency';

describe('approval interrupt idempotency helpers', () => {
  it('does not append the same pending interrupt or approval twice during LangGraph resume replay', () => {
    const task: any = {
      id: 'task-1',
      interruptHistory: [],
      approvals: []
    };
    const interrupt = {
      id: 'interrupt_task-1_skill_install',
      status: 'pending',
      kind: 'skill-install'
    };
    const approval = {
      taskId: 'task-1',
      intent: 'install_skill',
      actor: 'runtime-auto-pre-execution',
      decision: 'pending',
      decidedAt: '2026-05-01T00:00:00.000Z'
    };

    expect(recordPendingInterruptOnce(task, interrupt)).toBe(true);
    expect(recordPendingApprovalOnce(task, approval)).toBe(true);
    expect(recordPendingInterruptOnce(task, { ...interrupt, reason: 'replayed' })).toBe(false);
    expect(recordPendingApprovalOnce(task, { ...approval, reason: 'replayed' })).toBe(false);

    expect(task.interruptHistory).toEqual([{ ...interrupt, reason: 'replayed' }]);
    expect(task.approvals).toEqual([approval]);
  });
});
