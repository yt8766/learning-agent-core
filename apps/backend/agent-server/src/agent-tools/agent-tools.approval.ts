import { BadRequestException } from '@nestjs/common';
import { ExecutionRequestRecordSchema, type ExecutionRequestRecord, type ExecutionResultRecord } from '@agent/core';

import type { AgentToolApprovalRequest, AgentToolApprovalResumeInput } from './agent-tools.schemas';
import type { AgentToolApprovalProjection, AgentToolExecutionResponse } from './agent-tools.types';

interface ApplyApprovalInput {
  request: ExecutionRequestRecord;
  input: AgentToolApprovalRequest;
  saveRequest: (request: ExecutionRequestRecord) => void;
  saveResult: (result: ExecutionResultRecord) => void;
  buildResult: (
    request: ExecutionRequestRecord,
    status: 'succeeded' | 'failed' | 'cancelled',
    outputPreview: string
  ) => ExecutionResultRecord;
}

export function applyAgentToolApprovalAction(params: ApplyApprovalInput): AgentToolExecutionResponse {
  switch (params.input.interrupt.action) {
    case 'approve':
    case 'bypass':
      return approveRequest(params);
    case 'reject':
      return closeApprovalRequest(params, 'denied', params.input.interrupt.feedback ?? params.input.reason);
    case 'abort':
      return closeApprovalRequest(params, 'cancelled', params.input.interrupt.feedback ?? params.input.reason);
    case 'feedback':
      return returnForFeedback(params);
    case 'input':
      return returnWithInput(params);
    default:
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: `Unsupported approval action ${(params.input.interrupt as { action?: string }).action}`
      });
  }
}

export function buildApprovalProjection(request: ExecutionRequestRecord): AgentToolApprovalProjection {
  const approvalId = request.approvalId ?? `approval_${request.requestId}`;
  return {
    approvalId,
    interruptId: `interrupt_${request.requestId}`,
    resumeEndpoint: `/api/agent-tools/requests/${request.requestId}/approval`,
    resumePayload: {
      action: 'approve',
      requestId: request.requestId,
      approvalId
    }
  };
}

function approveRequest(params: ApplyApprovalInput): AgentToolExecutionResponse {
  const now = new Date().toISOString();
  const approved = ExecutionRequestRecordSchema.parse({
    ...params.request,
    status: 'succeeded',
    startedAt: params.request.startedAt ?? now,
    finishedAt: now,
    metadata: {
      ...(params.request.metadata ?? {}),
      approvalAction: params.input.interrupt.action,
      approvalScope: params.input.interrupt.payload?.approvalScope ?? 'once'
    }
  });
  const result = params.buildResult(approved, 'succeeded', 'Approved tool execution completed.');
  params.saveRequest(approved);
  params.saveResult(result);
  return { request: approved, policyDecision: approved.policyDecision, result };
}

function closeApprovalRequest(
  params: ApplyApprovalInput,
  status: 'denied' | 'cancelled',
  reason?: string
): AgentToolExecutionResponse {
  const closed = ExecutionRequestRecordSchema.parse({
    ...params.request,
    status,
    finishedAt: new Date().toISOString(),
    metadata: {
      ...(params.request.metadata ?? {}),
      approvalResolutionReason: reason
    }
  });
  params.saveRequest(closed);
  if (status === 'cancelled') {
    const result = params.buildResult(closed, 'cancelled', reason ?? 'Tool execution approval was aborted.');
    params.saveResult(result);
    return { request: closed, policyDecision: closed.policyDecision, result };
  }
  return { request: closed, policyDecision: closed.policyDecision };
}

function returnForFeedback(params: ApplyApprovalInput): AgentToolExecutionResponse {
  const interrupt = params.input.interrupt;
  if (!interrupt.feedback) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'feedback action requires feedback text'
    });
  }
  const updated = buildReturnedRequest(params.request, {
    approvalFeedback: interrupt.feedback
  });
  params.saveRequest(updated);
  return { request: updated, policyDecision: updated.policyDecision };
}

function returnWithInput(params: ApplyApprovalInput): AgentToolExecutionResponse {
  const interrupt = params.input.interrupt;
  if (!interrupt.value && !interrupt.payload?.toolInputPatch) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'input action requires value or payload.toolInputPatch'
    });
  }
  const updated = buildReturnedRequest(params.request, {
    approvalInputValue: interrupt.value,
    approvalInputPatch: interrupt.payload?.toolInputPatch
  });
  params.saveRequest(updated);
  return { request: updated, policyDecision: updated.policyDecision };
}

function buildReturnedRequest(
  request: ExecutionRequestRecord,
  metadata: Record<string, unknown>
): ExecutionRequestRecord {
  return ExecutionRequestRecordSchema.parse({
    ...request,
    status: 'pending_policy',
    approvalId: undefined,
    metadata: {
      ...(request.metadata ?? {}),
      ...metadata
    }
  });
}

export type { AgentToolApprovalResumeInput };
