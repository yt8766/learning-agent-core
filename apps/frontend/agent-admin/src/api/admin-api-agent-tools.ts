import type {
  ChatEventRecord,
  ExecutionCapabilityRecord,
  ExecutionNodeRecord,
  ExecutionPolicyDecisionRecord,
  ExecutionRequestRecord,
  ExecutionResultRecord
} from '@agent/core';
import {
  ChatEventRecordSchema,
  ExecutionCapabilityRecordSchema,
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema
} from '@agent/core';
import { request } from './admin-api-core';

export interface AgentToolExecutionProjectionRecord {
  requests?: ExecutionRequestRecord[];
  results?: ExecutionResultRecord[];
  capabilities?: ExecutionCapabilityRecord[];
  nodes?: ExecutionNodeRecord[];
  policyDecisions?: ExecutionPolicyDecisionRecord[];
  events?: ChatEventRecord[];
}

export interface AgentToolExecutionProjectionQuery {
  requestId?: string;
  taskId?: string;
  sessionId?: string;
}

export async function getAgentToolExecutionProjection(query: AgentToolExecutionProjectionQuery = {}) {
  const projection = await request<AgentToolExecutionProjectionRecord>(buildAgentToolExecutionProjectionPath(query), {
    cancelKey: 'agent-tool-execution-projection',
    cancelPrevious: true
  });
  return parseAgentToolExecutionProjection(projection);
}

function buildAgentToolExecutionProjectionPath(query: AgentToolExecutionProjectionQuery) {
  const params = new URLSearchParams();
  if (query.requestId) params.set('requestId', query.requestId);
  if (query.taskId) params.set('taskId', query.taskId);
  if (query.sessionId) params.set('sessionId', query.sessionId);
  const queryString = params.toString();
  return queryString ? `/agent-tools/projection?${queryString}` : '/agent-tools/projection';
}

function parseAgentToolExecutionProjection(
  payload: AgentToolExecutionProjectionRecord
): AgentToolExecutionProjectionRecord {
  try {
    return {
      requests:
        payload.requests === undefined ? undefined : ExecutionRequestRecordSchema.array().parse(payload.requests),
      results: payload.results === undefined ? undefined : ExecutionResultRecordSchema.array().parse(payload.results),
      capabilities:
        payload.capabilities === undefined
          ? undefined
          : ExecutionCapabilityRecordSchema.array().parse(payload.capabilities),
      nodes: payload.nodes === undefined ? undefined : ExecutionNodeRecordSchema.array().parse(payload.nodes),
      policyDecisions:
        payload.policyDecisions === undefined
          ? undefined
          : ExecutionPolicyDecisionRecordSchema.array().parse(payload.policyDecisions),
      events: payload.events === undefined ? undefined : ChatEventRecordSchema.array().parse(payload.events)
    };
  } catch {
    throw new Error('Agent tool execution projection response did not match the expected contract');
  }
}
