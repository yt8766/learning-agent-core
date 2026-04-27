import {
  ChatEventRecordSchema,
  ExecutionCapabilityRecordSchema,
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema,
  type ChatEventRecord,
  type ExecutionPolicyDecisionRecord,
  type ExecutionRequestRecord
} from '@agent/core';

import { optionalEquals } from './agent-tools.helpers';
import type { AgentToolsRepository } from './agent-tools.repository';
import type { AgentToolCatalog, AgentToolGovernanceProjection, AgentToolProjectionQuery } from './agent-tools.types';

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
const FORBIDDEN_EVENT_PAYLOAD_FIELD_NAMES = new Set(['input', 'rawInput', 'vendor', 'rawOutput']);

export function listProjectedAgentToolEvents(args: {
  repository: AgentToolsRepository;
  query?: AgentToolProjectionQuery | string;
  assertRequestExists: (requestId: string) => void;
}): ChatEventRecord[] {
  const resolvedQuery = normalizeEventsQuery(args.query);
  if (resolvedQuery?.requestId) {
    args.assertRequestExists(resolvedQuery.requestId);
  }
  if (!hasProjectionFilter(resolvedQuery)) {
    return parseAgentToolEvents(args.repository.listEvents());
  }
  const requestIds = new Set(
    args.repository
      .listRequests()
      .filter(request => matchesProjectionQuery(request, resolvedQuery))
      .map(request => request.requestId)
  );
  return parseAgentToolEvents(
    args.repository.listEvents().filter(event => matchesProjectionEvent(event, resolvedQuery, requestIds))
  );
}

export function buildAgentToolGovernanceProjection(args: {
  repository: AgentToolsRepository;
  catalog: AgentToolCatalog;
  query?: AgentToolProjectionQuery;
}): AgentToolGovernanceProjection {
  const allRequests = args.repository.listRequests();
  const shouldFilter = hasProjectionFilter(args.query);
  const filteredRequests = shouldFilter
    ? allRequests.filter(request => matchesProjectionQuery(request, args.query))
    : allRequests;
  const requestIds = new Set(filteredRequests.map(request => request.requestId));
  const requests = ExecutionRequestRecordSchema.array().parse(filteredRequests.map(sanitizeAgentToolRequestProjection));
  const results = ExecutionResultRecordSchema.array().parse(
    args.repository.listResults().filter(result => !shouldFilter || requestIds.has(result.requestId))
  );
  const capabilities = ExecutionCapabilityRecordSchema.array().parse(args.catalog.capabilities);
  const nodes = ExecutionNodeRecordSchema.array().parse(args.catalog.nodes);
  const policyDecisions = ExecutionPolicyDecisionRecordSchema.array().parse(
    requests
      .map(request => request.policyDecision)
      .filter((decision): decision is ExecutionPolicyDecisionRecord => decision !== undefined)
  );
  const events = parseAgentToolEvents(
    args.repository.listEvents().filter(event => !shouldFilter || matchesProjectionEvent(event, args.query, requestIds))
  );

  return {
    requests,
    results,
    capabilities,
    nodes,
    policyDecisions,
    events
  };
}

export function hasProjectionFilter(query: AgentToolProjectionQuery | undefined): query is AgentToolProjectionQuery {
  return Boolean(query?.requestId || query?.taskId || query?.sessionId);
}

export function matchesProjectionQuery(
  request: ExecutionRequestRecord,
  query: AgentToolProjectionQuery | undefined
): boolean {
  if (!query) {
    return true;
  }
  return (
    optionalEquals(request.requestId, query.requestId) &&
    optionalEquals(request.taskId, query.taskId) &&
    optionalEquals(request.sessionId, query.sessionId)
  );
}

export function matchesProjectionEvent(
  event: ChatEventRecord,
  query: AgentToolProjectionQuery | undefined,
  requestIds: Set<string>
): boolean {
  if (!query) {
    return true;
  }
  const payload = event.payload;
  if (typeof payload.requestId === 'string' && requestIds.has(payload.requestId)) {
    return true;
  }
  return (
    optionalEquals(readStringPayloadField(payload, 'requestId'), query.requestId) &&
    optionalEquals(readStringPayloadField(payload, 'taskId'), query.taskId) &&
    optionalEquals(readStringPayloadField(payload, 'sessionId'), query.sessionId)
  );
}

function readStringPayloadField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function parseAgentToolEvents(events: ChatEventRecord[]): ChatEventRecord[] {
  return ChatEventRecordSchema.array().parse(events.map(sanitizeAgentToolEvent));
}

function sanitizeAgentToolRequestProjection(request: ExecutionRequestRecord): ExecutionRequestRecord {
  return ExecutionRequestRecordSchema.parse({
    ...request,
    metadata: pickGovernanceMetadata(request.metadata)
  });
}

function sanitizeAgentToolEvent(event: ChatEventRecord): ChatEventRecord {
  const payload = sanitizeAgentToolEventPayload(event.payload);
  return ChatEventRecordSchema.parse({ ...event, payload });
}

function sanitizeAgentToolEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'metadata' || FORBIDDEN_EVENT_PAYLOAD_FIELD_NAMES.has(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  const metadata = payload.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    for (const fieldName of GOVERNANCE_EVENT_FIELD_NAMES) {
      const value = (metadata as Record<string, unknown>)[fieldName];
      if (typeof value === 'string' && value.length > 0 && sanitized[fieldName] === undefined) {
        sanitized[fieldName] = value;
      }
    }
  }
  return sanitized;
}

function pickGovernanceMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  if (!metadata) {
    return sanitized;
  }
  for (const fieldName of GOVERNANCE_EVENT_FIELD_NAMES) {
    const value = metadata[fieldName];
    if (typeof value === 'string' && value.length > 0) {
      sanitized[fieldName] = value;
    }
  }
  return sanitized;
}

function normalizeEventsQuery(
  query: AgentToolProjectionQuery | string | undefined
): AgentToolProjectionQuery | undefined {
  if (typeof query === 'string') {
    return query ? { requestId: query } : undefined;
  }
  return query;
}
