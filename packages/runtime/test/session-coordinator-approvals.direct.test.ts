import { describe, expect, it } from 'vitest';

import { ApprovalDecision, TaskStatus } from '@agent/core';

import {
  resolveApprovalEventType,
  resolveApprovalInteractionKind
} from '../src/session/coordinator/session-coordinator-approvals';

describe('session-coordinator-approvals (direct)', () => {
  describe('resolveApprovalEventType', () => {
    it('returns run_cancelled when approved with abort action', () => {
      const result = resolveApprovalEventType(ApprovalDecision.APPROVED, undefined, {
        interrupt: { action: 'abort' }
      } as any);
      expect(result).toBe('run_cancelled');
    });

    it('returns run_cancelled when approved and task is cancelled', () => {
      const result = resolveApprovalEventType(
        ApprovalDecision.APPROVED,
        { status: TaskStatus.CANCELLED } as any,
        {} as any
      );
      expect(result).toBe('run_cancelled');
    });

    it('returns interrupt_resumed when approved with active interrupt', () => {
      const result = resolveApprovalEventType(
        ApprovalDecision.APPROVED,
        { activeInterrupt: { id: 'int-1' } } as any,
        {} as any
      );
      expect(result).toBe('interrupt_resumed');
    });

    it('returns approval_resumed when approved without active interrupt', () => {
      const result = resolveApprovalEventType(ApprovalDecision.APPROVED, {} as any, {} as any);
      expect(result).toBe('approval_resolved');
    });

    it('returns run_cancelled when rejected with abort action', () => {
      const result = resolveApprovalEventType(ApprovalDecision.REJECTED, undefined, {
        interrupt: { action: 'abort' }
      } as any);
      expect(result).toBe('run_cancelled');
    });

    it('returns interrupt_rejected_with_feedback when has active interrupt and feedback', () => {
      const result = resolveApprovalEventType(
        ApprovalDecision.REJECTED,
        { activeInterrupt: { id: 'int-1' } } as any,
        { feedback: 'not good' } as any
      );
      expect(result).toBe('interrupt_rejected_with_feedback');
    });

    it('returns approval_rejected_with_feedback when has feedback but no active interrupt', () => {
      const result = resolveApprovalEventType(ApprovalDecision.REJECTED, {} as any, { feedback: 'not good' } as any);
      expect(result).toBe('approval_rejected_with_feedback');
    });

    it('returns interrupt_resumed when rejected with active interrupt and no feedback', () => {
      const result = resolveApprovalEventType(
        ApprovalDecision.REJECTED,
        { activeInterrupt: { id: 'int-1' } } as any,
        {} as any
      );
      expect(result).toBe('interrupt_resumed');
    });

    it('returns approval_resolved when rejected without active interrupt or feedback', () => {
      const result = resolveApprovalEventType(ApprovalDecision.REJECTED, {} as any, {} as any);
      expect(result).toBe('approval_resolved');
    });
  });

  describe('resolveApprovalInteractionKind', () => {
    it('returns interactionKind from task activeInterrupt payload', () => {
      const result = resolveApprovalInteractionKind(
        { activeInterrupt: { payload: { interactionKind: 'user-input' } } } as any,
        {} as any
      );
      expect(result).toBe('user-input');
    });

    it('returns interactionKind from dto interrupt payload', () => {
      const result = resolveApprovalInteractionKind(
        { activeInterrupt: undefined } as any,
        { interrupt: { payload: { interactionKind: 'tool-approval' } } } as any
      );
      expect(result).toBe('tool-approval');
    });

    it('returns undefined when no payload', () => {
      const result = resolveApprovalInteractionKind({ activeInterrupt: undefined } as any, {} as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined when payload is not an object', () => {
      const result = resolveApprovalInteractionKind({ activeInterrupt: { payload: 'string' } } as any, {} as any);
      expect(result).toBeUndefined();
    });

    it('prefers task activeInterrupt over dto interrupt', () => {
      const result = resolveApprovalInteractionKind(
        { activeInterrupt: { payload: { interactionKind: 'from-task' } } } as any,
        { interrupt: { payload: { interactionKind: 'from-dto' } } } as any
      );
      expect(result).toBe('from-task');
    });

    it('returns undefined when activeInterrupt payload has no interactionKind', () => {
      const result = resolveApprovalInteractionKind(
        { activeInterrupt: { payload: { other: 'field' } } } as any,
        {} as any
      );
      expect(result).toBeUndefined();
    });
  });
});
