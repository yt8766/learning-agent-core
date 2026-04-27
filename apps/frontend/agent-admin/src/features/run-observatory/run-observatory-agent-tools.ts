import { buildAgentToolExecutionGovernanceBadges } from '@/features/runtime-overview/components/runtime-agent-tool-execution-projections';
import type {
  AgentToolExecutionPolicyDecisionRecord,
  AgentToolExecutionProjectionInput,
  AgentToolExecutionRequestRecord,
  AgentToolExecutionResultRecord
} from '@/features/runtime-overview/components/runtime-agent-tool-execution-projections';

export type AgentToolObservatoryFilter = 'all' | 'blocked' | 'resumed' | 'terminal' | 'high_risk';

export type AgentToolObservatoryItem = {
  id: string;
  kind: 'request' | 'result' | 'event' | 'policy';
  at?: string;
  title: string;
  summary: string;
  badges?: string[];
};

export type AgentToolObservatoryDetail = {
  filter: AgentToolObservatoryFilter;
  counts: {
    requests: number;
    results: number;
    events: number;
    policyDecisions: number;
  };
  latestItems: AgentToolObservatoryItem[];
};

type AgentToolEventRecord = NonNullable<AgentToolExecutionProjectionInput['events']>[number];

export function buildAgentToolObservatoryDetail(
  input: AgentToolExecutionProjectionInput | undefined,
  selectedTaskId: string | undefined,
  filter: AgentToolObservatoryFilter = 'all'
): AgentToolObservatoryDetail {
  if (!input || !selectedTaskId) {
    return createEmptyAgentToolObservatoryDetail(filter);
  }

  const requests = (input.requests ?? []).filter(request => request.taskId === selectedTaskId);
  const requestIds = new Set(requests.flatMap(request => uniqueValues([request.requestId, request.id])));
  const results = (input.results ?? []).filter(result => requestIds.has(result.requestId));
  const events = (input.events ?? []).filter(event => {
    const requestId = getEventRequestId(event);
    const taskId = getPayloadString(event.payload, 'taskId');
    return (requestId ? requestIds.has(requestId) : false) || taskId === selectedTaskId;
  });
  const policyDecisions = (input.policyDecisions ?? []).filter(decision => requestIds.has(decision.requestId));

  const requestIdsByFilter = new Set(
    requests
      .filter(request => matchesAgentToolRequestFilter(filter, request))
      .flatMap(request => uniqueValues([request.requestId, request.id]))
  );
  const filteredRequests = requests.filter(request => matchesAgentToolRequestFilter(filter, request));
  const filteredResults = results.filter(
    result => requestIdsByFilter.has(result.requestId) || matchesAgentToolResultFilter(filter, result)
  );
  const filteredEvents = events.filter(event => {
    const requestId = getEventRequestId(event);
    return (requestId ? requestIdsByFilter.has(requestId) : false) || matchesAgentToolEventFilter(filter, event);
  });
  const filteredPolicyDecisions = policyDecisions.filter(
    policyDecision =>
      requestIdsByFilter.has(policyDecision.requestId) || matchesAgentToolPolicyDecisionFilter(filter, policyDecision)
  );

  return {
    filter,
    counts: {
      requests: filteredRequests.length,
      results: filteredResults.length,
      events: filteredEvents.length,
      policyDecisions: filteredPolicyDecisions.length
    },
    latestItems: [
      ...filteredEvents.map(projectAgentToolEventItem),
      ...filteredResults.map(projectAgentToolResultItem),
      ...filteredRequests.map(projectAgentToolRequestItem),
      ...filteredPolicyDecisions.map(projectAgentToolPolicyDecisionItem)
    ]
      .sort((left, right) => Date.parse(right.at ?? '') - Date.parse(left.at ?? ''))
      .slice(0, 5)
  };
}

function createEmptyAgentToolObservatoryDetail(filter: AgentToolObservatoryFilter): AgentToolObservatoryDetail {
  return {
    filter,
    counts: {
      requests: 0,
      results: 0,
      events: 0,
      policyDecisions: 0
    },
    latestItems: []
  };
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(isPresent)));
}

function matchesAgentToolRequestFilter(filter: AgentToolObservatoryFilter, request: AgentToolExecutionRequestRecord) {
  if (filter === 'all') return true;
  if (filter === 'blocked') return request.status === 'pending_approval' || request.status === 'denied';
  if (filter === 'terminal') return isTerminalStatus(request.status);
  if (filter === 'high_risk') return isHighRisk(request.riskClass);
  return false;
}

function matchesAgentToolResultFilter(filter: AgentToolObservatoryFilter, result: AgentToolExecutionResultRecord) {
  if (filter === 'all') return true;
  if (filter === 'terminal') return isTerminalStatus(result.status);
  return false;
}

function matchesAgentToolEventFilter(filter: AgentToolObservatoryFilter, event: AgentToolEventRecord) {
  if (filter === 'all') return true;
  const status = getAgentToolEventStatus(event);
  if (filter === 'blocked') return status === 'blocked';
  if (filter === 'resumed') return status === 'resumed';
  return false;
}

function matchesAgentToolPolicyDecisionFilter(
  filter: AgentToolObservatoryFilter,
  policyDecision: AgentToolExecutionPolicyDecisionRecord
) {
  if (filter === 'all') return true;
  if (filter === 'blocked') return policyDecision.decision === 'require_approval' || policyDecision.decision === 'deny';
  if (filter === 'high_risk') return isHighRisk(policyDecision.riskClass);
  return false;
}

function projectAgentToolRequestItem(request: AgentToolExecutionRequestRecord): AgentToolObservatoryItem {
  const requestId = request.requestId ?? request.id ?? request.toolName;
  const badges = buildAgentToolExecutionGovernanceBadges(request.metadata);
  return {
    id: `request:${requestId}`,
    kind: 'request',
    at: request.requestedAt ?? request.createdAt ?? request.updatedAt,
    title: request.toolName,
    summary: [request.status, request.riskClass ? `risk ${request.riskClass}` : undefined, request.nodeId]
      .filter(isPresent)
      .join(' · '),
    ...(badges.length ? { badges } : {})
  };
}

function projectAgentToolResultItem(result: AgentToolExecutionResultRecord): AgentToolObservatoryItem {
  const resultId = result.resultId ?? result.id ?? result.requestId;
  return {
    id: `result:${resultId}`,
    kind: 'result',
    at: result.completedAt ?? result.createdAt,
    title: `result ${result.status}`,
    summary: `request ${result.requestId}`
  };
}

function projectAgentToolPolicyDecisionItem(
  policyDecision: AgentToolExecutionPolicyDecisionRecord
): AgentToolObservatoryItem {
  const decisionId = policyDecision.decisionId ?? policyDecision.id ?? policyDecision.requestId;
  return {
    id: `policy:${decisionId}`,
    kind: 'policy',
    title: `policy ${policyDecision.decision}`,
    summary: [policyDecision.riskClass ? `risk ${policyDecision.riskClass}` : undefined, policyDecision.reason]
      .filter(isPresent)
      .join(' · ')
  };
}

function projectAgentToolEventItem(event: AgentToolEventRecord): AgentToolObservatoryItem {
  const toolName = getPayloadString(event.payload, 'toolName');
  const nodeId = getPayloadString(event.payload, 'nodeId');
  const status = getAgentToolEventStatus(event) ?? getPayloadString(event.payload, 'status') ?? event.type;
  return {
    id: `event:${event.id}`,
    kind: 'event',
    at: event.at,
    title: event.type,
    summary: [status, toolName, nodeId].filter(isPresent).join(' · ')
  };
}

function getAgentToolEventStatus(event: AgentToolEventRecord) {
  if (event.type === 'execution_step_blocked') return 'blocked';
  if (event.type === 'execution_step_resumed') return 'resumed';
  if (event.type === 'interrupt_resumed' && getPayloadString(event.payload, 'kind') === 'tool_execution') {
    return 'resumed';
  }
  return undefined;
}

function getEventRequestId(event: AgentToolEventRecord) {
  return getPayloadString(event.payload, 'requestId') ?? getPayloadString(event.payload, 'executionRequestId');
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTerminalStatus(status: string) {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function isHighRisk(riskClass: string | undefined) {
  return riskClass === 'high' || riskClass === 'critical';
}
