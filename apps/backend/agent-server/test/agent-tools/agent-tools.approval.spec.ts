import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { ExecutionRequestRecord, ExecutionResultRecord } from '@agent/core';

import { applyAgentToolApprovalAction, buildApprovalProjection } from '../../src/agent-tools/agent-tools.approval';
import type { AgentToolApprovalRequest } from '../../src/agent-tools/agent-tools.schemas';

function createBaseRequest(overrides: Partial<ExecutionRequestRecord> = {}): ExecutionRequestRecord {
  return {
    requestId: 'req-1',
    taskId: 'task-1',
    nodeId: 'node-1',
    toolName: 'test-tool',
    requestedBy: { actor: 'human' },
    riskClass: 'low',
    status: 'pending_policy',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides
  };
}

function createApprovalInput(action: string, overrides: Record<string, unknown> = {}): AgentToolApprovalRequest {
  return {
    sessionId: 'sess-1',
    interrupt: {
      action: action as never,
      requestId: 'req-1',
      ...overrides
    }
  };
}

function createParams(input: AgentToolApprovalRequest, requestOverrides?: Partial<ExecutionRequestRecord>) {
  return {
    request: createBaseRequest(requestOverrides),
    input,
    saveRequest: vi.fn(),
    saveResult: vi.fn(),
    buildResult: vi.fn().mockReturnValue({
      requestId: 'req-1',
      taskId: 'task-1',
      nodeId: 'node-1',
      toolName: 'test-tool',
      requestedBy: { actor: 'human' },
      riskClass: 'low',
      status: 'succeeded',
      createdAt: '2026-05-01T00:00:00.000Z'
    } as ExecutionResultRecord)
  };
}

describe('applyAgentToolApprovalAction', () => {
  describe('approve action', () => {
    it('approves request and returns succeeded response', () => {
      const params = createParams(createApprovalInput('approve'));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('succeeded');
      expect(params.saveRequest).toHaveBeenCalled();
      expect(params.saveResult).toHaveBeenCalled();
      expect(params.buildResult).toHaveBeenCalled();
    });

    it('uses approvalScope from payload', () => {
      const params = createParams(createApprovalInput('approve', { payload: { approvalScope: 'session' } }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('succeeded');
      expect(result.request.metadata).toMatchObject({ approvalScope: 'session' });
    });
  });

  describe('bypass action', () => {
    it('bypasses request same as approve', () => {
      const params = createParams(createApprovalInput('bypass'));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('succeeded');
      expect(params.saveRequest).toHaveBeenCalled();
      expect(params.saveResult).toHaveBeenCalled();
    });
  });

  describe('reject action', () => {
    it('rejects request with feedback as reason', () => {
      const params = createParams(createApprovalInput('reject', { feedback: 'Not allowed' }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('denied');
      expect(params.saveRequest).toHaveBeenCalled();
      expect(result.result).toBeUndefined();
    });

    it('rejects request with reason fallback', () => {
      const params = createParams(createApprovalInput('reject'));
      params.input.reason = 'custom reason';

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('denied');
      expect(result.request.metadata).toMatchObject({ approvalResolutionReason: 'custom reason' });
    });
  });

  describe('abort action', () => {
    it('cancels request with feedback', () => {
      const params = createParams(createApprovalInput('abort', { feedback: 'Aborted' }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('cancelled');
      expect(params.saveRequest).toHaveBeenCalled();
      expect(params.saveResult).toHaveBeenCalled();
      expect(params.buildResult).toHaveBeenCalledWith(expect.anything(), 'cancelled', 'Aborted');
    });

    it('cancels request with default message when no feedback', () => {
      const params = createParams(createApprovalInput('abort'));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('cancelled');
      expect(params.buildResult).toHaveBeenCalledWith(
        expect.anything(),
        'cancelled',
        'Tool execution approval was aborted.'
      );
    });
  });

  describe('feedback action', () => {
    it('returns request for feedback with text', () => {
      const params = createParams(createApprovalInput('feedback', { feedback: 'Please clarify' }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('pending_policy');
      expect(result.request.approvalId).toBeUndefined();
      expect(result.request.metadata).toMatchObject({ approvalFeedback: 'Please clarify' });
      expect(params.saveRequest).toHaveBeenCalled();
    });

    it('throws when feedback text is missing', () => {
      const params = createParams(createApprovalInput('feedback'));

      expect(() => applyAgentToolApprovalAction(params)).toThrow(BadRequestException);
    });
  });

  describe('input action', () => {
    it('returns request with value', () => {
      const params = createParams(createApprovalInput('input', { value: 'user-input' }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('pending_policy');
      expect(result.request.metadata).toMatchObject({ approvalInputValue: 'user-input' });
    });

    it('returns request with payload.toolInputPatch', () => {
      const params = createParams(createApprovalInput('input', { payload: { toolInputPatch: { path: '/new' } } }));

      const result = applyAgentToolApprovalAction(params);

      expect(result.request.status).toBe('pending_policy');
      expect(result.request.metadata).toMatchObject({
        approvalInputPatch: { path: '/new' }
      });
    });

    it('throws when neither value nor toolInputPatch provided', () => {
      const params = createParams(createApprovalInput('input'));

      expect(() => applyAgentToolApprovalAction(params)).toThrow(BadRequestException);
    });
  });

  describe('unsupported action', () => {
    it('throws BadRequestException for unknown action', () => {
      const params = createParams(createApprovalInput('unknown'));

      expect(() => applyAgentToolApprovalAction(params)).toThrow(BadRequestException);
    });
  });
});

describe('buildApprovalProjection', () => {
  it('builds projection with default approvalId', () => {
    const request = createBaseRequest();

    const result = buildApprovalProjection(request);

    expect(result.approvalId).toBe('approval_req-1');
    expect(result.interruptId).toBe('interrupt_req-1');
    expect(result.resumeEndpoint).toBe('/api/agent-tools/requests/req-1/approval');
    expect(result.resumePayload.action).toBe('approve');
    expect(result.resumePayload.requestId).toBe('req-1');
  });

  it('uses existing approvalId when present', () => {
    const request = createBaseRequest({ approvalId: 'custom-approval' });

    const result = buildApprovalProjection(request);

    expect(result.approvalId).toBe('custom-approval');
  });
});
