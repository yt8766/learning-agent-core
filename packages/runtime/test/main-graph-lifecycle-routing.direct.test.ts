import { describe, expect, it } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';

import {
  resolveCreatedTaskDispatch,
  isSkillInstallApprovalPending
} from '../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-routing';

describe('main-graph-lifecycle-routing (direct)', () => {
  describe('resolveCreatedTaskDispatch', () => {
    it('returns wait_approval when task is waiting approval', () => {
      const task = { status: TaskStatus.WAITING_APPROVAL } as any;
      expect(resolveCreatedTaskDispatch(task)).toEqual({ kind: 'wait_approval' });
    });

    it('returns session_bootstrap_and_pipeline when task has sessionId', () => {
      const task = { status: TaskStatus.RUNNING, sessionId: 's1' } as any;
      expect(resolveCreatedTaskDispatch(task)).toEqual({ kind: 'session_bootstrap_and_pipeline' });
    });

    it('returns background_queue when task has no sessionId', () => {
      const task = { status: TaskStatus.RUNNING } as any;
      expect(resolveCreatedTaskDispatch(task)).toEqual({ kind: 'background_queue' });
    });

    it('returns wait_approval even with sessionId when status is waiting', () => {
      const task = { status: TaskStatus.WAITING_APPROVAL, sessionId: 's1' } as any;
      expect(resolveCreatedTaskDispatch(task)).toEqual({ kind: 'wait_approval' });
    });
  });

  describe('isSkillInstallApprovalPending', () => {
    it('returns true when waiting approval with install_skill intent', () => {
      const task = {
        status: TaskStatus.WAITING_APPROVAL,
        pendingApproval: { intent: ActionIntent.INSTALL_SKILL }
      } as any;
      expect(isSkillInstallApprovalPending(task)).toBe(true);
    });

    it('returns false when not waiting approval', () => {
      const task = {
        status: TaskStatus.RUNNING,
        pendingApproval: { intent: ActionIntent.INSTALL_SKILL }
      } as any;
      expect(isSkillInstallApprovalPending(task)).toBe(false);
    });

    it('returns false when pending approval has different intent', () => {
      const task = {
        status: TaskStatus.WAITING_APPROVAL,
        pendingApproval: { intent: ActionIntent.WRITE_FILE }
      } as any;
      expect(isSkillInstallApprovalPending(task)).toBe(false);
    });

    it('returns false when no pending approval', () => {
      const task = { status: TaskStatus.WAITING_APPROVAL } as any;
      expect(isSkillInstallApprovalPending(task)).toBe(false);
    });
  });
});
