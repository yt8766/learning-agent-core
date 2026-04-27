import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ExecutionRequestRecord } from '@agent/core';

import {
  AgentToolApprovalRequestSchema,
  AgentToolCancelRequestSchema,
  AgentToolEventsQuerySchema,
  AgentToolNodeHealthCheckRequestSchema,
  CreateAgentToolExecutionRequestSchema,
  type AgentToolApprovalRequest,
  type AgentToolCancelRequest,
  type AgentToolEventsQuery,
  type AgentToolNodeHealthCheckRequest,
  type CreateAgentToolExecutionRequest
} from './agent-tools.schemas';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'denied']);

export function parseCreateRequest(body: unknown): CreateAgentToolExecutionRequest {
  try {
    return CreateAgentToolExecutionRequestSchema.parse(body);
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'Agent tool execution request body is invalid',
      details: error instanceof Error ? error.message : undefined
    });
  }
}

export function parseCancelRequest(body: unknown): AgentToolCancelRequest {
  try {
    return AgentToolCancelRequestSchema.parse(body ?? {});
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'Agent tool cancel request body is invalid',
      details: error instanceof Error ? error.message : undefined
    });
  }
}

export function parseApprovalRequest(body: unknown): AgentToolApprovalRequest {
  try {
    return AgentToolApprovalRequestSchema.parse(body);
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'Agent tool approval request body is invalid',
      details: error instanceof Error ? error.message : undefined
    });
  }
}

export function parseNodeHealthCheckRequest(body: unknown): AgentToolNodeHealthCheckRequest {
  try {
    return AgentToolNodeHealthCheckRequestSchema.parse(body ?? {});
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'Agent tool node health check request body is invalid',
      details: error instanceof Error ? error.message : undefined
    });
  }
}

export function parseEventsQuery(query: AgentToolEventsQuery | string | undefined): AgentToolEventsQuery | undefined {
  try {
    if (query === undefined) {
      return undefined;
    }
    if (typeof query === 'string') {
      const requestId = query.trim();
      return requestId.length > 0 ? { requestId } : undefined;
    }
    const parsed = AgentToolEventsQuerySchema.parse(query);
    return parsed.requestId || parsed.taskId || parsed.sessionId ? parsed : undefined;
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_events_query_invalid',
      message: 'Agent tool events query is invalid',
      details: error instanceof Error ? error.message : undefined
    });
  }
}

export function summarizeInput(input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  return keys.length === 0 ? 'No input fields.' : `Input fields: ${keys.slice(0, 5).join(', ')}`;
}

export function assertNotTerminal(request: ExecutionRequestRecord): void {
  if (TERMINAL_STATUSES.has(request.status)) {
    throw new ConflictException({
      code: 'agent_tool_conflict',
      message: `Agent tool request ${request.requestId} is already terminal with status ${request.status}`,
      requestId: request.requestId
    });
  }
}

export function assertPendingApproval(request: ExecutionRequestRecord): void {
  if (request.status !== 'pending_approval') {
    throw new ConflictException({
      code: 'agent_tool_conflict',
      message: `Agent tool request ${request.requestId} is not pending approval`,
      requestId: request.requestId
    });
  }
}

export function optionalEquals(value: string, expected?: string): boolean {
  return expected === undefined || value === expected;
}

export function optionalBooleanEquals(value: boolean, expected?: boolean | string): boolean {
  if (expected === undefined) {
    return true;
  }
  const normalized = typeof expected === 'string' ? expected === 'true' : expected;
  return value === normalized;
}
