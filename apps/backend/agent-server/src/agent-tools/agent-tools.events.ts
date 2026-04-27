import { ChatEventRecordSchema, type ChatEventRecord, type ExecutionRequestRecord } from '@agent/core';

import type { AgentToolApprovalProjection } from './agent-tools.types';

const AGENT_TOOL_QUEUE_DRAIN_MODE = 'synchronous';
const GOVERNANCE_EVENT_FIELD_NAMES = [
  'sandboxRunId',
  'sandboxDecision',
  'sandboxProfile',
  'autoReviewId',
  'autoReviewVerdict',
  'alias',
  'approvalMode',
  'approvalReasonCode',
  'aliasReasonCode'
] as const;

export interface AgentToolEventDraft {
  type: ChatEventRecord['type'];
  payload: Record<string, unknown>;
}

export function buildAgentToolEvent(
  request: ExecutionRequestRecord,
  sequence: number,
  draft: AgentToolEventDraft
): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: `agent_tool_${request.requestId}_${String(sequence).padStart(4, '0')}_${draft.type}`,
    sessionId: request.sessionId ?? request.taskId,
    type: draft.type,
    at: new Date().toISOString(),
    payload: draft.payload
  });
}

export function buildInitialAgentToolEventDrafts(
  request: ExecutionRequestRecord,
  policyDecision: unknown
): AgentToolEventDraft[] {
  const governance = pickGovernanceEventPayload(request);
  return [
    {
      type: 'tool_selected',
      payload: {
        requestId: request.requestId,
        toolName: request.toolName,
        capabilityId: request.capabilityId,
        nodeId: request.nodeId,
        riskClass: request.riskClass
      }
    },
    {
      type: 'tool_called',
      payload: {
        requestId: request.requestId,
        toolName: request.toolName,
        inputPreview: request.inputPreview,
        policyDecision,
        ...governance,
        queue: {
          status: 'queued',
          drainMode: AGENT_TOOL_QUEUE_DRAIN_MODE
        }
      }
    }
  ];
}

export function buildBlockedAgentToolEventDrafts(
  request: ExecutionRequestRecord,
  approval: AgentToolApprovalProjection
): AgentToolEventDraft[] {
  const governance = pickGovernanceEventPayload(request);
  return [
    {
      type: 'execution_step_blocked',
      payload: {
        requestId: request.requestId,
        reasonCode: request.policyDecision?.reasonCode ?? 'agent_tool_requires_approval',
        approvalId: approval.approvalId,
        interruptId: approval.interruptId,
        ...governance
      }
    },
    {
      type: 'interrupt_pending',
      payload: {
        interruptId: approval.interruptId,
        kind: 'tool_execution',
        requestId: request.requestId,
        approvalId: approval.approvalId
      }
    }
  ];
}

export function buildExecutionStartedEventDraft(request: ExecutionRequestRecord): AgentToolEventDraft {
  const governance = pickGovernanceEventPayload(request);
  return {
    type: 'execution_step_started',
    payload: {
      requestId: request.requestId,
      nodeId: request.nodeId,
      toolName: request.toolName,
      stage: 'execution',
      status: 'running',
      ...governance,
      queue: {
        status: 'running',
        drainMode: AGENT_TOOL_QUEUE_DRAIN_MODE
      }
    }
  };
}

export function buildExecutionQueuedEventDraft(request: ExecutionRequestRecord): AgentToolEventDraft {
  const governance = pickGovernanceEventPayload(request);
  return {
    type: 'tool_called',
    payload: {
      requestId: request.requestId,
      toolName: request.toolName,
      inputPreview: request.inputPreview,
      ...governance,
      queue: {
        status: 'queued',
        drainMode: AGENT_TOOL_QUEUE_DRAIN_MODE
      }
    }
  };
}

export function buildTerminalAgentToolEventDrafts(
  request: ExecutionRequestRecord,
  status: 'succeeded' | 'failed' | 'cancelled',
  resultId: string | undefined,
  outputPreview: string | undefined
): AgentToolEventDraft[] {
  const governance = pickGovernanceEventPayload(request);
  return [
    {
      type: 'execution_step_completed',
      payload: {
        requestId: request.requestId,
        resultId,
        status,
        outputPreview,
        ...governance
      }
    },
    {
      type: 'tool_stream_completed',
      payload: {
        requestId: request.requestId,
        resultId,
        status
      }
    }
  ];
}

function pickGovernanceEventPayload(request: ExecutionRequestRecord): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const fieldName of GOVERNANCE_EVENT_FIELD_NAMES) {
    const value = request.metadata?.[fieldName];
    if (typeof value === 'string' && value.length > 0) {
      payload[fieldName] = value;
    }
  }
  return payload;
}

export function buildApprovalResumedEventDrafts(
  request: ExecutionRequestRecord,
  approval: AgentToolApprovalProjection,
  action: string
): AgentToolEventDraft[] {
  return [
    {
      type: 'execution_step_resumed',
      payload: {
        requestId: request.requestId,
        approvalId: approval.approvalId,
        interruptId: approval.interruptId,
        action
      }
    },
    {
      type: 'interrupt_resumed',
      payload: {
        interruptId: approval.interruptId,
        kind: 'tool_execution',
        requestId: request.requestId,
        action
      }
    }
  ];
}

export function buildApprovalRejectedEventDrafts(
  request: ExecutionRequestRecord,
  approval: AgentToolApprovalProjection,
  action: string,
  feedback: string | undefined
): AgentToolEventDraft[] {
  return [
    {
      type: 'execution_step_resumed',
      payload: {
        requestId: request.requestId,
        approvalId: approval.approvalId,
        interruptId: approval.interruptId,
        action
      }
    },
    {
      type: 'interrupt_rejected_with_feedback',
      payload: {
        interruptId: approval.interruptId,
        kind: 'tool_execution',
        requestId: request.requestId,
        feedback
      }
    }
  ];
}
