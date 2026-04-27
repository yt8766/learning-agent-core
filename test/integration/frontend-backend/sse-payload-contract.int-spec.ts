/**
 * 第5类 integration：frontend-backend SSE payload 契约
 *
 * 验证：
 * 1. @agent/core 的 ChatEventRecordSchema 包含前端流处理逻辑所依赖的全部事件类型。
 * 2. 前端"停流"类型（session_finished / session_failed / run_cancelled）在 core schema 中有定义。
 * 3. 前端"助手内容"类型（assistant_token / assistant_message / final_response_delta）在 core schema 中有定义。
 * 4. approval / learning / review 相关事件类型在 core schema 中有定义（后端必须 emit）。
 * 5. ChatEventRecordSchema 可以 parse 合法事件对象并拒绝非法对象。
 *
 * 不依赖前端内部 hook 实现，通过 @agent/core 作为双端共同 ground truth 验证契约。
 *
 * 命名约定：*.int-spec.ts
 */

import { describe, expect, it } from 'vitest';

import { ChatEventRecordSchema } from '@agent/core';

const CANONICAL_EVENT_TYPES: string[] = ChatEventRecordSchema.shape.type.options as string[];
const AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST: Record<string, string[]> = {
  tool_called: [
    'requestId',
    'toolName',
    'inputPreview',
    'policyDecision',
    'sandboxRunId',
    'sandboxDecision',
    'sandboxProfile',
    'autoReviewId',
    'autoReviewVerdict'
  ],
  execution_step_started: ['requestId', 'nodeId', 'toolName', 'stage', 'sandboxRunId', 'autoReviewId'],
  execution_step_completed: ['requestId', 'resultId', 'status', 'outputPreview', 'sandboxRunId', 'autoReviewId'],
  execution_step_blocked: [
    'requestId',
    'reasonCode',
    'approvalId',
    'interruptId',
    'sandboxRunId',
    'sandboxProfile',
    'autoReviewId',
    'autoReviewVerdict',
    'reviewId'
  ],
  execution_step_resumed: ['requestId', 'approvalId', 'interruptId', 'action', 'reviewId'],
  review_completed: ['reviewId', 'kind', 'verdict', 'summary', 'findingCount'],
  interrupt_pending: ['interruptId', 'kind', 'requestId', 'runId', 'reviewId', 'approvalId'],
  interrupt_resumed: ['interruptId', 'kind', 'requestId', 'runId', 'reviewId', 'action'],
  interrupt_rejected_with_feedback: ['interruptId', 'kind', 'requestId', 'reviewId', 'feedback']
};
const FORBIDDEN_AGENT_TOOL_PAYLOAD_FIELDS = [
  'input',
  'rawInput',
  'rawOutput',
  'metadata',
  'vendorObject',
  'vendorPayload',
  'vendorResponse',
  'rawVendorResponse',
  'providerResponse',
  'rawProviderResponse'
];

describe('frontend-backend SSE payload contract (第5类 integration)', () => {
  describe('canonical event type set', () => {
    it('ChatEventRecordSchema defines a non-empty set of canonical event types', () => {
      expect(CANONICAL_EVENT_TYPES.length).toBeGreaterThan(0);
    });

    it('event type set is deduplicated', () => {
      expect(new Set(CANONICAL_EVENT_TYPES).size).toBe(CANONICAL_EVENT_TYPES.length);
    });
  });

  describe('assistant content event types (frontend stream rendering)', () => {
    // These types are referenced in frontend chat-session-stream.ts ASSISTANT_CONTENT_EVENT_TYPES
    const FRONTEND_ASSISTANT_CONTENT_TYPES = ['assistant_token', 'assistant_message', 'final_response_delta'];

    for (const eventType of FRONTEND_ASSISTANT_CONTENT_TYPES) {
      it(`canonical schema includes assistant content type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('stream completion event types (frontend shouldStopStreamingForEvent)', () => {
    // These types are referenced in frontend STREAM_COMPLETION_EVENT_TYPES
    const FRONTEND_STOP_STREAMING_TYPES = [
      'final_response_completed',
      'session_finished',
      'session_failed',
      'run_cancelled'
    ];

    for (const eventType of FRONTEND_STOP_STREAMING_TYPES) {
      it(`canonical schema includes stream-stop type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('session lifecycle event types (backend must emit)', () => {
    const SESSION_LIFECYCLE_TYPES = ['session_started', 'session_finished', 'session_failed'];

    for (const eventType of SESSION_LIFECYCLE_TYPES) {
      it(`canonical schema includes session lifecycle type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('approval flow event types (approval center contract)', () => {
    const APPROVAL_TYPES = ['approval_required', 'approval_resolved', 'approval_rejected_with_feedback'];

    for (const eventType of APPROVAL_TYPES) {
      it(`canonical schema includes approval type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('interrupt flow event types (interrupt lifecycle)', () => {
    const INTERRUPT_TYPES = ['interrupt_pending', 'interrupt_resumed', 'interrupt_rejected_with_feedback'];

    for (const eventType of INTERRUPT_TYPES) {
      it(`canonical schema includes interrupt type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('learning flow event types (learning center contract)', () => {
    const LEARNING_TYPES = ['learning_pending_confirmation', 'learning_confirmed'];

    for (const eventType of LEARNING_TYPES) {
      it(`canonical schema includes learning type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('execution step event types (observability contract)', () => {
    const EXECUTION_STEP_TYPES = [
      'execution_step_started',
      'execution_step_completed',
      'execution_step_blocked',
      'execution_step_resumed'
    ];

    for (const eventType of EXECUTION_STEP_TYPES) {
      it(`canonical schema includes execution step type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }
  });

  describe('agent tool governance event payload allowlist', () => {
    for (const eventType of Object.keys(AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST)) {
      it(`canonical schema includes agent tool governance event type: '${eventType}'`, () => {
        expect(CANONICAL_EVENT_TYPES).toContain(eventType);
      });
    }

    it('does not allow raw input, raw output, metadata, vendor or provider payload fields', () => {
      const allowlistedFields = new Set(Object.values(AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST).flat());

      for (const forbiddenField of FORBIDDEN_AGENT_TOOL_PAYLOAD_FIELDS) {
        expect(allowlistedFields.has(forbiddenField)).toBe(false);
      }
    });

    it('keeps sandbox and auto-review governance fields as explicit summaries', () => {
      expect(AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST['tool_called']).toEqual(
        expect.arrayContaining([
          'sandboxRunId',
          'sandboxDecision',
          'sandboxProfile',
          'autoReviewId',
          'autoReviewVerdict'
        ])
      );
      expect(AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST['execution_step_blocked']).toEqual(
        expect.arrayContaining(['reasonCode', 'approvalId', 'interruptId', 'sandboxRunId', 'autoReviewId', 'reviewId'])
      );
      expect(AGENT_TOOL_EVENT_PAYLOAD_ALLOWLIST['review_completed']).toEqual(
        expect.arrayContaining(['reviewId', 'kind', 'verdict', 'summary', 'findingCount'])
      );
    });
  });

  describe('ChatEventRecordSchema.parse() (wire format validation)', () => {
    it('parses a minimal valid assistant_token event', () => {
      const result = ChatEventRecordSchema.parse({
        id: 'evt-001',
        sessionId: 'session-abc',
        type: 'assistant_token',
        at: '2026-04-22T00:00:00.000Z',
        payload: { messageId: 'msg-1', content: '测试' }
      });
      expect(result.type).toBe('assistant_token');
      expect(result.sessionId).toBe('session-abc');
    });

    it('parses a minimal valid session_finished event', () => {
      const result = ChatEventRecordSchema.parse({
        id: 'evt-002',
        sessionId: 'session-abc',
        type: 'session_finished',
        at: '2026-04-22T00:00:01.000Z',
        payload: { taskId: 'task-1' }
      });
      expect(result.type).toBe('session_finished');
    });

    it('parses an approval_required event', () => {
      const result = ChatEventRecordSchema.parse({
        id: 'evt-003',
        sessionId: 'session-abc',
        type: 'approval_required',
        at: '2026-04-22T00:00:02.000Z',
        payload: {
          interruptId: 'intr-1',
          toolName: 'write_local_file',
          riskLevel: 'high'
        }
      });
      expect(result.type).toBe('approval_required');
    });

    it('rejects event with unknown type', () => {
      expect(() =>
        ChatEventRecordSchema.parse({
          id: 'evt-bad',
          sessionId: 'session-abc',
          type: 'nonexistent_event_type_xyz',
          at: '2026-04-22T00:00:00.000Z',
          payload: {}
        })
      ).toThrow();
    });

    it('rejects event missing required id', () => {
      expect(() =>
        ChatEventRecordSchema.parse({
          sessionId: 'session-abc',
          type: 'assistant_token',
          at: '2026-04-22T00:00:00.000Z',
          payload: {}
        })
      ).toThrow();
    });

    it('rejects event missing required sessionId', () => {
      expect(() =>
        ChatEventRecordSchema.parse({
          id: 'evt-004',
          type: 'assistant_token',
          at: '2026-04-22T00:00:00.000Z',
          payload: {}
        })
      ).toThrow();
    });

    it('rejects event missing required at timestamp', () => {
      expect(() =>
        ChatEventRecordSchema.parse({
          id: 'evt-005',
          sessionId: 'session-abc',
          type: 'assistant_token',
          payload: {}
        })
      ).toThrow();
    });

    it('accepts arbitrary payload fields (open record)', () => {
      const result = ChatEventRecordSchema.parse({
        id: 'evt-006',
        sessionId: 'session-abc',
        type: 'node_progress',
        at: '2026-04-22T00:00:00.000Z',
        payload: {
          nodeId: 'manager_plan',
          progress: 0.75,
          customField: { nested: true }
        }
      });
      expect(result.payload['nodeId']).toBe('manager_plan');
      expect(result.payload['progress']).toBe(0.75);
    });
  });
});
