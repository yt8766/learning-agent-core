import type {
  ExecutionCapabilityRecord,
  ChatEventRecord,
  ExecutionNodeRecord,
  ExecutionPolicyDecisionRecord,
  ExecutionRequestRecord,
  ExecutionResultRecord,
  ExecutionRiskClass
} from '@agent/core';
import {
  ChatEventRecordSchema,
  ExecutionCapabilityRecordSchema,
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema
} from '@agent/core';

const AGENT_TOOL_API_PREFIX = '/api/agent-tools';

export type AgentToolFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface CreateAgentToolExecutionRequest {
  sessionId?: string;
  taskId: string;
  nodeId?: string;
  capabilityId?: string;
  toolName: string;
  requestedBy: {
    actor: 'human' | 'supervisor' | 'ministry' | 'specialist_agent' | 'runtime';
    actorId?: string;
  };
  input: Record<string, unknown>;
  inputPreview?: string;
  riskClass?: ExecutionRiskClass;
  approvalIntent?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentToolApprovalResumeInput {
  interruptId?: string;
  action: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
  requestId: string;
  approvalId?: string;
  feedback?: string;
  value?: string;
  payload?: {
    toolInputPatch?: Record<string, unknown>;
    approvalScope?: 'once' | 'session' | 'always';
    reasonCode?: string;
    [key: string]: unknown;
  };
}

export interface AgentToolExecutionResponse {
  request: ExecutionRequestRecord;
  policyDecision?: ExecutionPolicyDecisionRecord;
  result?: ExecutionResultRecord;
  approval?: {
    approvalId: string;
    interruptId: string;
    resumeEndpoint: string;
    resumePayload: AgentToolApprovalResumeInput;
  };
}

export interface AgentToolGovernanceProjection {
  requests: ExecutionRequestRecord[];
  results: ExecutionResultRecord[];
  capabilities: ExecutionCapabilityRecord[];
  nodes: ExecutionNodeRecord[];
  policyDecisions: ExecutionPolicyDecisionRecord[];
  events: ChatEventRecord[];
}

export interface CancelAgentToolExecutionInput {
  sessionId?: string;
  taskId?: string;
  actor?: string;
  reason?: string;
}

export interface ResumeAgentToolApprovalInput {
  sessionId: string;
  interrupt: AgentToolApprovalResumeInput;
  actor?: string;
  reason?: string;
}

export interface AgentToolNodeHealthCheckInput {
  actor?: string;
  reason?: string;
}

export interface ListAgentToolCapabilitiesQuery {
  nodeId?: string;
  category?: string;
  riskClass?: string;
  requiresApproval?: boolean;
}

export interface ListAgentToolNodesQuery {
  status?: string;
  kind?: string;
  sandboxMode?: string;
  riskClass?: string;
}

export interface ListAgentToolEventsQuery {
  requestId?: string;
  taskId?: string;
  sessionId?: string;
}

export interface AgentToolProjectionQuery {
  requestId?: string;
  taskId?: string;
  sessionId?: string;
}

export class AgentToolExecutionApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(input: { status: number; message: string; code?: string; details?: unknown }) {
    super(input.message);
    this.name = 'AgentToolExecutionApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export function buildAgentToolRequestsUrl(requestId?: string) {
  return requestId
    ? `${AGENT_TOOL_API_PREFIX}/requests/${encodeURIComponent(requestId)}`
    : `${AGENT_TOOL_API_PREFIX}/requests`;
}

export function buildAgentToolRequestResultUrl(requestId: string) {
  return `${buildAgentToolRequestsUrl(requestId)}/result`;
}

export function buildAgentToolApprovalUrl(requestId: string) {
  return `${buildAgentToolRequestsUrl(requestId)}/approval`;
}

export function buildAgentToolCancelUrl(requestId: string) {
  return `${buildAgentToolRequestsUrl(requestId)}/cancel`;
}

export function buildAgentToolCapabilitiesUrl(query: ListAgentToolCapabilitiesQuery = {}) {
  return withQuery(`${AGENT_TOOL_API_PREFIX}/capabilities`, query);
}

export function buildAgentToolNodesUrl(query: ListAgentToolNodesQuery = {}) {
  return withQuery(`${AGENT_TOOL_API_PREFIX}/nodes`, query);
}

export function buildAgentToolProjectionUrl(query: AgentToolProjectionQuery = {}) {
  return withQuery(`${AGENT_TOOL_API_PREFIX}/projection`, query);
}

export function buildAgentToolEventsUrl(query: ListAgentToolEventsQuery = {}) {
  return withQuery(`${AGENT_TOOL_API_PREFIX}/events`, query);
}

export function buildAgentToolNodeUrl(nodeId: string) {
  return `${AGENT_TOOL_API_PREFIX}/nodes/${encodeURIComponent(nodeId)}`;
}

export function buildAgentToolNodeHealthCheckUrl(nodeId: string) {
  return `${buildAgentToolNodeUrl(nodeId)}/health-check`;
}

export function createAgentToolExecution(fetcher: AgentToolFetch, input: CreateAgentToolExecutionRequest) {
  return requestJson(fetcher, buildAgentToolRequestsUrl(), parseAgentToolExecutionResponse, {
    method: 'POST',
    body: input
  });
}

export function cancelAgentToolExecution(
  fetcher: AgentToolFetch,
  requestId: string,
  input: CancelAgentToolExecutionInput
) {
  return requestJson(fetcher, buildAgentToolCancelUrl(requestId), ExecutionRequestRecordSchema, {
    method: 'POST',
    body: input
  });
}

export function resumeAgentToolApproval(
  fetcher: AgentToolFetch,
  requestId: string,
  input: ResumeAgentToolApprovalInput
) {
  return requestJson(fetcher, buildAgentToolApprovalUrl(requestId), parseAgentToolExecutionResponse, {
    method: 'POST',
    body: input
  });
}

export function listAgentToolCapabilities(fetcher: AgentToolFetch, query: ListAgentToolCapabilitiesQuery = {}) {
  return requestJson(fetcher, buildAgentToolCapabilitiesUrl(query), parseAgentToolCapabilityList);
}

export function listAgentToolNodes(fetcher: AgentToolFetch, query: ListAgentToolNodesQuery = {}) {
  return requestJson(fetcher, buildAgentToolNodesUrl(query), parseAgentToolNodeList);
}

export function getAgentToolNode(fetcher: AgentToolFetch, nodeId: string) {
  return requestJson(fetcher, buildAgentToolNodeUrl(nodeId), ExecutionNodeRecordSchema);
}

export function getAgentToolRequest(fetcher: AgentToolFetch, requestId: string) {
  return requestJson(fetcher, buildAgentToolRequestsUrl(requestId), ExecutionRequestRecordSchema);
}

export function getAgentToolResult(fetcher: AgentToolFetch, requestId: string) {
  return requestJson(fetcher, buildAgentToolRequestResultUrl(requestId), parseNullableAgentToolResult);
}

export function listAgentToolEvents(fetcher: AgentToolFetch, query: ListAgentToolEventsQuery = {}) {
  return requestJson(fetcher, buildAgentToolEventsUrl(query), parseAgentToolEvents);
}

export function getAgentToolGovernanceProjection(fetcher: AgentToolFetch, query: AgentToolProjectionQuery = {}) {
  return requestJson(fetcher, buildAgentToolProjectionUrl(query), parseAgentToolGovernanceProjection);
}

export function healthCheckAgentToolNode(
  fetcher: AgentToolFetch,
  nodeId: string,
  input: AgentToolNodeHealthCheckInput = {}
) {
  return requestJson(fetcher, buildAgentToolNodeHealthCheckUrl(nodeId), ExecutionResultRecordSchema, {
    method: 'POST',
    body: input
  });
}

function withQuery<TQuery extends object>(baseUrl: string, query: TQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query) as Array<[string, string | boolean | undefined]>) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

type AgentToolPayloadParser<T> = { parse(value: unknown): T } | ((value: unknown) => T);

async function requestJson<T>(
  fetcher: AgentToolFetch,
  url: string,
  parser: AgentToolPayloadParser<T>,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const response = await fetcher(url, buildRequestInit(options));
  const payload = await readJson(response);
  if (!response.ok) {
    throw buildApiError(response.status, payload);
  }
  return parsePayload(response.status, payload, parser);
}

function buildRequestInit(options: { method?: 'GET' | 'POST'; body?: unknown }): RequestInit {
  const method = options.method ?? 'GET';
  if (method === 'GET') {
    return { method };
  }
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options.body ?? {})
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildApiError(status: number, payload: unknown) {
  const envelope = getRecord(payload);
  const error = getRecord(envelope?.error) ?? envelope;
  const message = getString(error?.message) ?? `Agent tool API request failed with status ${status}`;
  return new AgentToolExecutionApiError({
    status,
    message,
    code: getString(error?.code),
    details: error?.details ?? payload
  });
}

function parsePayload<T>(status: number, payload: unknown, parser: AgentToolPayloadParser<T>) {
  try {
    return typeof parser === 'function' ? parser(payload) : parser.parse(payload);
  } catch (error) {
    throw new AgentToolExecutionApiError({
      status,
      message: 'Agent tool API response did not match the expected contract',
      code: 'agent_tool_response_invalid',
      details: { payload, error }
    });
  }
}

function parseAgentToolExecutionResponse(payload: unknown): AgentToolExecutionResponse {
  const record = requireRecord(payload);
  return {
    request: ExecutionRequestRecordSchema.parse(record.request),
    policyDecision:
      record.policyDecision === undefined
        ? undefined
        : ExecutionPolicyDecisionRecordSchema.parse(record.policyDecision),
    result: record.result === undefined ? undefined : ExecutionResultRecordSchema.parse(record.result),
    approval: record.approval === undefined ? undefined : parseApprovalResume(record.approval)
  };
}

function parseAgentToolCapabilityList(payload: unknown): ExecutionCapabilityRecord[] {
  if (!Array.isArray(payload)) {
    throw new Error('Expected capability list');
  }
  return payload.map(item => ExecutionCapabilityRecordSchema.parse(item));
}

function parseAgentToolNodeList(payload: unknown): ExecutionNodeRecord[] {
  if (!Array.isArray(payload)) {
    throw new Error('Expected node list');
  }
  return payload.map(item => ExecutionNodeRecordSchema.parse(item));
}

function parseNullableAgentToolResult(payload: unknown): ExecutionResultRecord | null {
  return payload === null ? null : ExecutionResultRecordSchema.parse(payload);
}

function parseAgentToolEvents(payload: unknown): ChatEventRecord[] {
  if (!Array.isArray(payload)) {
    throw new Error('Expected agent tool event list');
  }
  return payload.map(item => ChatEventRecordSchema.parse(item));
}

function parseAgentToolGovernanceProjection(payload: unknown): AgentToolGovernanceProjection {
  const record = requireRecord(payload);
  return {
    requests: parseArray(record.requests, ExecutionRequestRecordSchema, 'request'),
    results: parseArray(record.results, ExecutionResultRecordSchema, 'result'),
    capabilities: parseArray(record.capabilities, ExecutionCapabilityRecordSchema, 'capability'),
    nodes: parseArray(record.nodes, ExecutionNodeRecordSchema, 'node'),
    policyDecisions: parseArray(record.policyDecisions, ExecutionPolicyDecisionRecordSchema, 'policy decision'),
    events: parseArray(record.events, ChatEventRecordSchema, 'event')
  };
}

function parseArray<T>(payload: unknown, parser: { parse(value: unknown): T }, label: string): T[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Expected ${label} list`);
  }
  return payload.map(item => parser.parse(item));
}

function parseApprovalResume(payload: unknown): AgentToolExecutionResponse['approval'] {
  const record = requireRecord(payload);
  return {
    approvalId: requireString(record.approvalId),
    interruptId: requireString(record.interruptId),
    resumeEndpoint: requireString(record.resumeEndpoint),
    resumePayload: parseApprovalResumePayload(record.resumePayload)
  };
}

function parseApprovalResumePayload(payload: unknown): AgentToolApprovalResumeInput {
  const record = requireRecord(payload);
  return {
    interruptId: optionalString(record.interruptId),
    action: parseApprovalAction(record.action),
    requestId: requireString(record.requestId),
    approvalId: optionalString(record.approvalId),
    feedback: optionalString(record.feedback),
    value: optionalString(record.value),
    payload: record.payload === undefined ? undefined : requireRecord(record.payload)
  };
}

function parseApprovalAction(value: unknown): AgentToolApprovalResumeInput['action'] {
  if (
    value === 'approve' ||
    value === 'reject' ||
    value === 'feedback' ||
    value === 'input' ||
    value === 'bypass' ||
    value === 'abort'
  ) {
    return value;
  }
  throw new Error('Expected approval action');
}

function requireRecord(value: unknown) {
  const record = getRecord(value);
  if (!record) {
    throw new Error('Expected object payload');
  }
  return record;
}

function requireString(value: unknown) {
  const stringValue = optionalString(value);
  if (!stringValue) {
    throw new Error('Expected string value');
  }
  return stringValue;
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
