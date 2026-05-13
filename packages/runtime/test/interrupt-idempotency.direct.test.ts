import { describe, expect, it } from 'vitest';

import { recordPendingInterruptOnce, recordPendingApprovalOnce } from '../src/flows/approval/interrupt-idempotency';

describe('interrupt-idempotency (direct)', () => {
  describe('recordPendingInterruptOnce', () => {
    it('adds interrupt to history when no existing entry', () => {
      const task = {} as any;
      const interrupt = { id: 'int-1', status: 'pending' };
      const result = recordPendingInterruptOnce(task, interrupt);
      expect(result).toBe(true);
      expect(task.interruptHistory).toHaveLength(1);
      expect(task.interruptHistory[0].id).toBe('int-1');
    });

    it('returns false when interrupt already exists with same id and pending status', () => {
      const task = {
        interruptHistory: [{ id: 'int-1', status: 'pending' }]
      } as any;
      const interrupt = { id: 'int-1', status: 'pending', updatedAt: 'now' };
      const result = recordPendingInterruptOnce(task, interrupt);
      expect(result).toBe(false);
      expect(task.interruptHistory).toHaveLength(1);
    });

    it('updates existing pending interrupt with new data', () => {
      const task = {
        interruptHistory: [{ id: 'int-1', status: 'pending', old: true }]
      } as any;
      const interrupt = { id: 'int-1', status: 'pending', new: true };
      recordPendingInterruptOnce(task, interrupt);
      expect(task.interruptHistory[0]).toBe(interrupt);
      expect((task.interruptHistory[0] as any).old).toBeUndefined();
    });

    it('adds new interrupt when existing has different id', () => {
      const task = {
        interruptHistory: [{ id: 'int-1', status: 'pending' }]
      } as any;
      const result = recordPendingInterruptOnce(task, { id: 'int-2', status: 'pending' });
      expect(result).toBe(true);
      expect(task.interruptHistory).toHaveLength(2);
    });

    it('adds new interrupt when existing has non-pending status', () => {
      const task = {
        interruptHistory: [{ id: 'int-1', status: 'resolved' }]
      } as any;
      const result = recordPendingInterruptOnce(task, { id: 'int-1', status: 'pending' });
      expect(result).toBe(true);
      expect(task.interruptHistory).toHaveLength(2);
    });

    it('creates interruptHistory array when undefined', () => {
      const task = {} as any;
      recordPendingInterruptOnce(task, { id: 'int-1', status: 'pending' });
      expect(task.interruptHistory).toBeDefined();
      expect(Array.isArray(task.interruptHistory)).toBe(true);
    });
  });

  describe('recordPendingApprovalOnce', () => {
    it('adds approval when no existing entry', () => {
      const task = { approvals: [] } as any;
      const approval = { taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'pending' };
      const result = recordPendingApprovalOnce(task, approval);
      expect(result).toBe(true);
      expect(task.approvals).toHaveLength(1);
    });

    it('returns false when matching pending approval exists', () => {
      const task = {
        approvals: [{ taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'pending' }]
      } as any;
      const result = recordPendingApprovalOnce(task, {
        taskId: 't1',
        intent: 'tool_approval',
        actor: 'user',
        decision: 'pending'
      });
      expect(result).toBe(false);
      expect(task.approvals).toHaveLength(1);
    });

    it('adds when existing approval has different intent', () => {
      const task = {
        approvals: [{ taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'pending' }]
      } as any;
      const result = recordPendingApprovalOnce(task, {
        taskId: 't1',
        intent: 'install_skill',
        actor: 'user',
        decision: 'pending'
      });
      expect(result).toBe(true);
      expect(task.approvals).toHaveLength(2);
    });

    it('adds when existing approval has different actor', () => {
      const task = {
        approvals: [{ taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'pending' }]
      } as any;
      const result = recordPendingApprovalOnce(task, {
        taskId: 't1',
        intent: 'tool_approval',
        actor: 'agent',
        decision: 'pending'
      });
      expect(result).toBe(true);
      expect(task.approvals).toHaveLength(2);
    });

    it('adds when existing approval has non-pending decision', () => {
      const task = {
        approvals: [{ taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'approved' }]
      } as any;
      const result = recordPendingApprovalOnce(task, {
        taskId: 't1',
        intent: 'tool_approval',
        actor: 'user',
        decision: 'pending'
      });
      expect(result).toBe(true);
      expect(task.approvals).toHaveLength(2);
    });

    it('adds when existing approval has different taskId', () => {
      const task = {
        approvals: [{ taskId: 't1', intent: 'tool_approval', actor: 'user', decision: 'pending' }]
      } as any;
      const result = recordPendingApprovalOnce(task, {
        taskId: 't2',
        intent: 'tool_approval',
        actor: 'user',
        decision: 'pending'
      });
      expect(result).toBe(true);
      expect(task.approvals).toHaveLength(2);
    });
  });
});
