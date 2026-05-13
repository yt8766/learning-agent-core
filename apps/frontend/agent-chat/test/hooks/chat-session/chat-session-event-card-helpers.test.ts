import { describe, expect, it } from 'vitest';

import {
  buildEventCard,
  updateApprovalCard,
  updatePlanQuestionCard,
  sanitizeStringArray,
  parsePreviewMessages
} from '@/hooks/chat-session/chat-session-event-card-helpers';

describe('chat-session-event-card-helpers', () => {
  describe('sanitizeStringArray', () => {
    it('returns undefined for non-array input', () => {
      expect(sanitizeStringArray('not-array', 5)).toBeUndefined();
      expect(sanitizeStringArray(null, 5)).toBeUndefined();
      expect(sanitizeStringArray(undefined, 5)).toBeUndefined();
    });

    it('filters non-string items and trims', () => {
      const result = sanitizeStringArray(['  hello  ', 123, ' world ', true, ' test '], 5);
      expect(result).toEqual(['hello', 'world', 'test']);
    });

    it('respects maxItems limit', () => {
      const result = sanitizeStringArray(['a', 'b', 'c', 'd', 'e', 'f'], 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('returns undefined for empty result', () => {
      expect(sanitizeStringArray([123, true], 5)).toBeUndefined();
      expect(sanitizeStringArray(['  '], 5)).toBeUndefined();
    });
  });

  describe('parsePreviewMessages', () => {
    it('returns undefined for non-array input', () => {
      expect(parsePreviewMessages('not-array')).toBeUndefined();
    });

    it('filters invalid items', () => {
      const result = parsePreviewMessages([
        { role: 'user', content: 'hello' },
        { role: 'invalid', content: 'test' },
        { content: 'missing role' },
        { role: 'assistant', content: 'world' }
      ]);
      expect(result).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'world' }
      ]);
    });

    it('returns undefined for empty valid items', () => {
      expect(parsePreviewMessages([123, { role: 'invalid' }])).toBeUndefined();
    });

    it('accepts system role', () => {
      const result = parsePreviewMessages([{ role: 'system', content: 'system msg' }]);
      expect(result).toEqual([{ role: 'system', content: 'system msg' }]);
    });
  });

  describe('buildEventCard', () => {
    it('builds compression_summary card for conversation_compacted', () => {
      const card = buildEventCard({
        id: 'evt-1',
        sessionId: 's1',
        type: 'conversation_compacted',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          summary: 'Summary text',
          condensedMessageCount: 5,
          condensedCharacterCount: 1000,
          totalCharacterCount: 5000,
          previewMessages: [{ role: 'user', content: 'test' }],
          trigger: 'character_count',
          source: 'llm',
          focuses: ['focus1'],
          keyDeliverables: ['deliverable1'],
          risks: ['risk1'],
          nextActions: ['action1'],
          supportingFacts: ['fact1']
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'compression_summary',
          summary: 'Summary text',
          condensedMessageCount: 5,
          condensedCharacterCount: 1000,
          totalCharacterCount: 5000,
          trigger: 'character_count',
          source: 'llm'
        })
      );
    });

    it('builds compression_summary with defaults for missing optional fields', () => {
      const card = buildEventCard({
        id: 'evt-1',
        sessionId: 's1',
        type: 'conversation_compacted',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'compression_summary',
          summary: '',
          trigger: 'message_count',
          source: 'heuristic'
        })
      );
    });

    it('builds plan_question card for approval_required with plan-question interactionKind', () => {
      const card = buildEventCard({
        id: 'evt-2',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          interactionKind: 'plan-question',
          interruptId: 'int-1',
          reason: 'Need clarification',
          questionSet: {
            title: 'Plan Questions',
            summary: 'Please answer'
          },
          questions: [
            {
              id: 'q1',
              question: 'Which approach?',
              questionType: 'direction',
              options: [{ id: 'opt1', label: 'Option A', description: 'First option' }],
              recommendedOptionId: 'opt1',
              allowFreeform: true,
              defaultAssumption: 'Assume A',
              whyAsked: 'To clarify',
              impactOnPlan: 'Changes timeline'
            }
          ]
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'plan_question',
          title: 'Plan Questions',
          summary: 'Please answer',
          status: 'pending',
          interruptId: 'int-1'
        })
      );
    });

    it('builds plan_question with defaults for missing question fields', () => {
      const card = buildEventCard({
        id: 'evt-2',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          interactionKind: 'plan-question',
          questions: [{ id: 'q1' }]
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'plan_question',
          title: '计划问题'
        })
      );
    });

    it('builds approval_request card for approval_required', () => {
      const card = buildEventCard({
        id: 'evt-3',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          intent: 'write_file',
          toolName: 'write_local_file',
          reason: 'Needs approval',
          reasonCode: 'destructive',
          riskLevel: 'high',
          riskCode: 'high_risk',
          riskReason: 'High risk operation',
          commandPreview: 'rm -rf /tmp',
          approvalScope: 'once',
          requestedBy: 'gongbu-code',
          serverId: 'server-1',
          capabilityId: 'cap-1',
          interruptId: 'int-1',
          interruptSource: 'graph',
          interruptMode: 'blocking',
          resumeStrategy: 'command',
          interactionKind: 'approval',
          watchdog: true,
          runtimeGovernanceReasonCode: 'timeout',
          recommendedActions: ['Check logs'],
          preview: [{ label: 'Path', value: '/tmp/test' }]
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'approval_request',
          intent: 'write_file',
          toolName: 'write_local_file',
          status: 'pending',
          displayStatus: 'pending',
          isPrimaryActionAvailable: true,
          approvalScope: 'once',
          interruptSource: 'graph',
          interruptMode: 'blocking',
          resumeStrategy: 'command',
          interactionKind: 'approval',
          watchdog: true
        })
      );
    });

    it('builds approval_request with defaults for missing fields', () => {
      const card = buildEventCard({
        id: 'evt-3',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'approval_request',
          intent: 'unknown',
          status: 'pending',
          watchdog: false
        })
      );
    });

    it('builds approval_request for interrupt_pending event', () => {
      const card = buildEventCard({
        id: 'evt-4',
        sessionId: 's1',
        type: 'interrupt_pending',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          intent: 'run_command',
          approvalScope: 'session',
          interruptSource: 'tool',
          interruptMode: 'non-blocking'
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'approval_request',
          approvalScope: 'session',
          interruptSource: 'tool',
          interruptMode: 'non-blocking'
        })
      );
    });

    it('builds control_notice card for run_cancelled', () => {
      const card = buildEventCard({
        id: 'evt-5',
        sessionId: 's1',
        type: 'run_cancelled',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'warning',
        label: '本轮已终止'
      });
    });

    it('builds control_notice card for run_resumed without skill execution', () => {
      const card = buildEventCard({
        id: 'evt-6',
        sessionId: 's1',
        type: 'run_resumed',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'success',
        label: '已恢复执行'
      });
    });

    it('builds control_notice card for run_resumed with skill execution title', () => {
      const card = buildEventCard({
        id: 'evt-6',
        sessionId: 's1',
        type: 'run_resumed',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          currentSkillExecution: { title: 'Running test suite' }
        }
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'success',
        label: '已恢复到 Running test suite'
      });
    });

    it('builds control_notice for approval_resolved', () => {
      const card = buildEventCard({
        id: 'evt-7',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'success',
        label: '已允许继续'
      });
    });

    it('builds control_notice for interrupt_resumed', () => {
      const card = buildEventCard({
        id: 'evt-8',
        sessionId: 's1',
        type: 'interrupt_resumed',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'success',
        label: '已允许继续'
      });
    });

    it('builds control_notice for approval_rejected_with_feedback', () => {
      const card = buildEventCard({
        id: 'evt-9',
        sessionId: 's1',
        type: 'approval_rejected_with_feedback',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'warning',
        label: '已拒绝并附说明'
      });
    });

    it('builds control_notice for interrupt_rejected_with_feedback', () => {
      const card = buildEventCard({
        id: 'evt-10',
        sessionId: 's1',
        type: 'interrupt_rejected_with_feedback',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'warning',
        label: '已拒绝并附说明'
      });
    });

    it('returns undefined for unknown event types', () => {
      const card = buildEventCard({
        id: 'evt-11',
        sessionId: 's1',
        type: 'unknown_event',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(card).toBeUndefined();
    });

    it('handles approval_request with invalid approvalScope values', () => {
      const card = buildEventCard({
        id: 'evt-12',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          intent: 'test',
          approvalScope: 'invalid',
          interruptSource: 'invalid',
          interruptMode: 'invalid',
          resumeStrategy: 'invalid',
          interactionKind: 'invalid'
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'approval_request',
          approvalScope: undefined,
          interruptSource: undefined,
          interruptMode: undefined,
          resumeStrategy: undefined,
          interactionKind: undefined
        })
      );
    });

    it('handles plan_question with invalid questionType', () => {
      const card = buildEventCard({
        id: 'evt-13',
        sessionId: 's1',
        type: 'approval_required',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          interactionKind: 'plan-question',
          questions: [{ id: 'q1', questionType: 'invalid' }]
        }
      } as any);

      expect(card).toEqual(
        expect.objectContaining({
          type: 'plan_question'
        })
      );
    });

    it('handles run_resumed with invalid currentSkillExecution', () => {
      const card = buildEventCard({
        id: 'evt-14',
        sessionId: 's1',
        type: 'run_resumed',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          currentSkillExecution: 'not-an-object'
        }
      } as any);

      expect(card).toEqual({
        type: 'control_notice',
        tone: 'success',
        label: '已恢复执行'
      });
    });
  });

  describe('updateApprovalCard', () => {
    it('updates pending approval card to approved on approval_resolved', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'write_file',
            status: 'pending' as const
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'write_file' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect(result[0]).toEqual(
        expect.objectContaining({
          card: expect.objectContaining({
            status: 'approved',
            displayStatus: 'allowed',
            isPrimaryActionAvailable: false
          })
        })
      );
    });

    it('updates pending approval card to rejected on approval_rejected_with_feedback', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'run_cmd',
            status: 'pending' as const,
            reason: 'original reason'
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_rejected_with_feedback',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'run_cmd', feedback: "Don't do it" }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect(result[0]).toEqual(
        expect.objectContaining({
          card: expect.objectContaining({
            status: 'rejected',
            displayStatus: 'rejected_with_feedback',
            reason: "Don't do it"
          })
        })
      );
    });

    it('does not update already-handled cards', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'write_file',
            status: 'approved' as const
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'write_file' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect(result[0]).toBe(messages[0]);
    });

    it('skips cards with mismatching intent', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'write_file',
            status: 'pending' as const
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'run_command' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect(result[0]).toBe(messages[0]);
    });

    it('skips cards with mismatching taskId when both are present', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          taskId: 'task-1',
          card: {
            type: 'approval_request' as const,
            intent: 'write_file',
            status: 'pending' as const
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'write_file', taskId: 'task-2' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect(result[0]).toBe(messages[0]);
    });

    it('updates first matching card only', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: { type: 'approval_request' as const, intent: 'cmd', status: 'pending' as const }
        },
        {
          id: 'msg-2',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: { type: 'approval_request' as const, intent: 'cmd', status: 'pending' as const }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'cmd' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect((result[0].card as any).status).toBe('approved');
      expect((result[1].card as any).status).toBe('pending');
    });

    it('uses feedback as reason when provided', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'cmd',
            status: 'pending' as const,
            reason: 'old reason'
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_rejected_with_feedback',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'cmd', feedback: 'new reason' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect((result[0].card as any).reason).toBe('new reason');
    });

    it('preserves original reason when no feedback provided', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'approval',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'approval_request' as const,
            intent: 'cmd',
            status: 'pending' as const,
            reason: 'original'
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { intent: 'cmd' }
      } as any;

      const result = updateApprovalCard(messages, event);
      expect((result[0].card as any).reason).toBe('original');
    });
  });

  describe('updatePlanQuestionCard', () => {
    it('updates pending plan question to answered', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'question',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'plan_question' as const,
            interruptId: 'int-1',
            status: 'pending' as const,
            title: 'Test',
            questions: []
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { interruptId: 'int-1' }
      } as any;

      const result = updatePlanQuestionCard(messages, event);
      expect((result[0].card as any).status).toBe('answered');
    });

    it('updates pending plan question to aborted on run_cancelled', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'question',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'plan_question' as const,
            interruptId: 'int-1',
            status: 'pending' as const,
            title: 'Test',
            questions: []
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'run_cancelled',
        at: '2026-03-28T00:00:01.000Z',
        payload: { interruptId: 'int-1' }
      } as any;

      const result = updatePlanQuestionCard(messages, event);
      expect((result[0].card as any).status).toBe('aborted');
    });

    it('updates to bypassed for plan-question approval', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'question',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'plan_question' as const,
            interruptId: 'int-1',
            status: 'pending' as const,
            title: 'Test',
            questions: []
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: {
          interruptId: 'int-1',
          decision: 'approved',
          interactionKind: 'plan-question',
          intent: 'plan_question'
        }
      } as any;

      const result = updatePlanQuestionCard(messages, event);
      expect((result[0].card as any).status).toBe('bypassed');
    });

    it('does not update already-answered cards', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'question',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'plan_question' as const,
            interruptId: 'int-1',
            status: 'answered' as const,
            title: 'Test',
            questions: []
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { interruptId: 'int-1' }
      } as any;

      const result = updatePlanQuestionCard(messages, event);
      expect(result[0]).toBe(messages[0]);
    });

    it('skips cards with mismatching interruptId', () => {
      const messages = [
        {
          id: 'msg-1',
          sessionId: 's1',
          role: 'system' as const,
          content: 'question',
          createdAt: '2026-03-28T00:00:00.000Z',
          card: {
            type: 'plan_question' as const,
            interruptId: 'int-1',
            status: 'pending' as const,
            title: 'Test',
            questions: []
          }
        }
      ];

      const event = {
        id: 'evt-1',
        sessionId: 's1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: { interruptId: 'int-2' }
      } as any;

      const result = updatePlanQuestionCard(messages, event);
      expect(result[0]).toBe(messages[0]);
    });
  });
});
