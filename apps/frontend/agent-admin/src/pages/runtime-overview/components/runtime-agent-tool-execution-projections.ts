import type { ChatEventRecord } from '@agent/core';

import { summarizeAgentToolExecutionEvents } from './runtime-agent-tool-execution-event-projections';

export type AgentToolExecutionRequestStatus =
  | 'pending_policy'
  | 'pending_approval'
  | 'queued'
  | 'denied'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AgentToolExecutionResultStatus = 'succeeded' | 'failed' | 'cancelled';

export type AgentToolRiskClass = 'low' | 'medium' | 'high' | 'critical' | string;

export interface AgentToolExecutionRequestRecord {
  id?: string;
  requestId?: string;
  taskId: string;
  toolName: string;
  nodeId?: string;
  capabilityId?: string;
  status: AgentToolExecutionRequestStatus | string;
  riskClass?: AgentToolRiskClass;
  policyDecisionId?: string;
  requestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentToolExecutionResultRecord {
  id?: string;
  resultId?: string;
  requestId: string;
  status: AgentToolExecutionResultStatus | string;
  completedAt?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentToolExecutionCapabilityRecord {
  id?: string;
  capabilityId?: string;
  toolName: string;
  nodeId?: string;
  displayName?: string;
  riskClass?: AgentToolRiskClass;
  requiresApproval?: boolean;
}

export interface AgentToolExecutionNodeRecord {
  id?: string;
  nodeId?: string;
  displayName?: string;
  status?: string;
  riskClass?: AgentToolRiskClass;
}

export interface AgentToolExecutionPolicyDecisionRecord {
  id?: string;
  decisionId?: string;
  requestId: string;
  decision: 'allow' | 'require_approval' | 'deny' | string;
  riskClass?: AgentToolRiskClass;
  reason?: string;
}

export interface AgentToolExecutionProjectionInput {
  requests?: AgentToolExecutionRequestRecord[];
  results?: AgentToolExecutionResultRecord[];
  capabilities?: AgentToolExecutionCapabilityRecord[];
  nodes?: AgentToolExecutionNodeRecord[];
  policyDecisions?: AgentToolExecutionPolicyDecisionRecord[];
  events?: ChatEventRecord[];
}

export interface AgentToolExecutionCountGroup {
  total: number;
  pendingApproval: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

export interface AgentToolExecutionRiskGroup extends AgentToolExecutionCountGroup {
  riskClass: string;
}

export interface AgentToolExecutionNodeGroup extends AgentToolExecutionCountGroup {
  nodeId: string;
  nodeLabel: string;
}

export interface AgentToolExecutionRequestSummary {
  requestId: string;
  taskId: string;
  toolName: string;
  nodeId: string;
  nodeLabel: string;
  status: string;
  riskClass: string;
  at?: string;
  governanceBadges?: string[];
}

export interface AgentToolExecutionGovernanceSummary {
  totals: AgentToolExecutionCountGroup;
  byRiskClass: AgentToolExecutionRiskGroup[];
  byNode: AgentToolExecutionNodeGroup[];
  requestQueue: AgentToolExecutionRequestSummary[];
  policyDecisions: AgentToolExecutionPolicyDecisionRecord[];
  capabilityCount: number;
  eventLog: AgentToolExecutionEventLogSummary;
}

export type AgentToolExecutionEventStatus = 'blocked' | 'resumed' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentToolExecutionEventSummary {
  eventId: string;
  requestId: string;
  status: AgentToolExecutionEventStatus;
  title: string;
  summary?: string;
  toolName?: string;
  nodeId?: string;
  at: string;
}

export interface AgentToolExecutionEventLogSummary {
  blockedCount: number;
  resumedCount: number;
  latestEvents: AgentToolExecutionEventSummary[];
}

const GOVERNANCE_METADATA_KEYS = [
  'sandboxRunId',
  'sandboxDecision',
  'sandboxProfile',
  'sandboxProviderId',
  'sandboxExitCode',
  'autoReviewId',
  'autoReviewVerdict',
  'autoReviewGateDecision',
  'autoReviewReviewerKind'
] as const;

function createEmptyCounts(): AgentToolExecutionCountGroup {
  return {
    total: 0,
    pendingApproval: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0
  };
}

function incrementCounts(counts: AgentToolExecutionCountGroup, status: string) {
  counts.total += 1;
  if (status === 'pending_approval') counts.pendingApproval += 1;
  if (status === 'running') counts.running += 1;
  if (status === 'succeeded') counts.succeeded += 1;
  if (status === 'failed') counts.failed += 1;
  if (status === 'cancelled') counts.cancelled += 1;
}

function compareCountGroups<T extends AgentToolExecutionCountGroup>(left: T, right: T) {
  return right.total - left.total || right.pendingApproval - left.pendingApproval || right.running - left.running;
}

export function summarizeAgentToolExecutions(
  input: AgentToolExecutionProjectionInput = {}
): AgentToolExecutionGovernanceSummary {
  const totals = createEmptyCounts();
  const riskGroups = new Map<string, AgentToolExecutionRiskGroup>();
  const nodeGroups = new Map<string, AgentToolExecutionNodeGroup>();
  const nodesById = new Map(
    (input.nodes ?? []).flatMap(node => buildRecordKeys(node.id, node.nodeId).map(key => [key, node]))
  );
  const resultsByRequestId = new Map((input.results ?? []).map(result => [result.requestId, result]));
  const eventGovernanceByRequestId = buildEventGovernanceMetadataByRequestId(input.events ?? []);

  for (const request of input.requests ?? []) {
    const requestId = request.requestId ?? request.id;
    const status = (requestId ? resultsByRequestId.get(requestId)?.status : undefined) ?? request.status;

    incrementCounts(totals, status);

    const riskClass = request.riskClass ?? 'unclassified';
    const riskGroup = riskGroups.get(riskClass) ?? { riskClass, ...createEmptyCounts() };
    incrementCounts(riskGroup, status);
    riskGroups.set(riskClass, riskGroup);

    const nodeId = request.nodeId ?? 'unassigned';
    const node = nodesById.get(nodeId);
    const nodeGroup = nodeGroups.get(nodeId) ?? {
      nodeId,
      nodeLabel: node?.displayName ?? nodeId,
      ...createEmptyCounts()
    };
    incrementCounts(nodeGroup, status);
    nodeGroups.set(nodeId, nodeGroup);
  }

  return {
    totals,
    byRiskClass: [...riskGroups.values()].sort((left, right) => {
      const riskOrder = riskPriority(right.riskClass) - riskPriority(left.riskClass);
      return riskOrder || compareCountGroups(left, right) || left.riskClass.localeCompare(right.riskClass);
    }),
    byNode: [...nodeGroups.values()].sort(
      (left, right) => compareCountGroups(left, right) || left.nodeId.localeCompare(right.nodeId)
    ),
    requestQueue: buildRequestQueue(input.requests ?? [], resultsByRequestId, nodesById, eventGovernanceByRequestId),
    policyDecisions: (input.policyDecisions ?? []).map(projectPolicyDecisionDisplay),
    capabilityCount: input.capabilities?.length ?? 0,
    eventLog: summarizeAgentToolExecutionEvents(input.events ?? [])
  };
}

function buildRequestQueue(
  requests: AgentToolExecutionRequestRecord[],
  resultsByRequestId: Map<string, AgentToolExecutionResultRecord>,
  nodesById: Map<string, AgentToolExecutionNodeRecord>,
  eventGovernanceByRequestId: Map<string, Record<string, unknown>>
): AgentToolExecutionRequestSummary[] {
  return requests
    .map(request => {
      const requestId = request.requestId ?? request.id ?? request.toolName;
      const result = resultsByRequestId.get(requestId);
      const nodeId = request.nodeId ?? 'unassigned';
      const node = nodesById.get(nodeId);
      return {
        requestId,
        taskId: request.taskId,
        toolName: request.toolName,
        nodeId,
        nodeLabel: node?.displayName ?? nodeId,
        status: result?.status ?? request.status,
        riskClass: request.riskClass ?? 'unclassified',
        at: request.requestedAt ?? request.createdAt ?? request.updatedAt,
        ...buildGovernanceBadgeProjection([
          request.metadata,
          result?.metadata,
          eventGovernanceByRequestId.get(requestId)
        ])
      };
    })
    .sort((left, right) => Date.parse(right.at ?? '') - Date.parse(left.at ?? ''))
    .slice(0, 6);
}

export function buildAgentToolExecutionGovernanceBadges(
  metadata: Record<string, unknown> | Array<Record<string, unknown> | undefined> | undefined
): string[] {
  const governanceMetadata = mergeGovernanceMetadata(metadata);
  const sandboxRunId = getMetadataString(governanceMetadata, 'sandboxRunId');
  const sandboxDecision = getMetadataString(governanceMetadata, 'sandboxDecision');
  const sandboxProfile = getMetadataString(governanceMetadata, 'sandboxProfile');
  const sandboxProviderId = getMetadataString(governanceMetadata, 'sandboxProviderId');
  const sandboxExitCode = getMetadataString(governanceMetadata, 'sandboxExitCode');
  const autoReviewId = getMetadataString(governanceMetadata, 'autoReviewId');
  const autoReviewVerdict = getMetadataString(governanceMetadata, 'autoReviewVerdict');
  const autoReviewGateDecision = getMetadataString(governanceMetadata, 'autoReviewGateDecision');
  const autoReviewReviewerKind = getMetadataString(governanceMetadata, 'autoReviewReviewerKind');

  return [
    sandboxRunId ? `sandbox ${sandboxRunId}` : undefined,
    sandboxDecision ? `sandbox decision ${sandboxDecision}` : undefined,
    sandboxProfile ? `sandbox profile ${sandboxProfile}` : undefined,
    sandboxProviderId ? `sandbox provider ${sandboxProviderId}` : undefined,
    sandboxExitCode ? `sandbox exit ${sandboxExitCode}` : undefined,
    autoReviewId ? `review ${autoReviewId}` : undefined,
    autoReviewVerdict ? `review verdict ${autoReviewVerdict}` : undefined,
    autoReviewGateDecision ? `review gate ${autoReviewGateDecision}` : undefined,
    autoReviewReviewerKind ? `reviewer ${autoReviewReviewerKind}` : undefined
  ].filter((badge): badge is string => Boolean(badge));
}

function buildGovernanceBadgeProjection(
  metadata: Record<string, unknown> | Array<Record<string, unknown> | undefined> | undefined
) {
  const governanceBadges = buildAgentToolExecutionGovernanceBadges(metadata);
  return governanceBadges.length ? { governanceBadges } : {};
}

function buildEventGovernanceMetadataByRequestId(events: ChatEventRecord[]) {
  const metadataByRequestId = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    const requestId = getEventRequestId(event.payload);
    if (!requestId) continue;

    const eventRecord = event as ChatEventRecord & { metadata?: Record<string, unknown> };
    const governanceMetadata = mergeGovernanceMetadata([
      event.payload,
      getRecord(event.payload.metadata),
      eventRecord.metadata
    ]);
    if (!Object.keys(governanceMetadata).length) continue;

    metadataByRequestId.set(
      requestId,
      mergeGovernanceMetadata([metadataByRequestId.get(requestId), governanceMetadata])
    );
  }

  return metadataByRequestId;
}

function mergeGovernanceMetadata(
  metadata: Record<string, unknown> | Array<Record<string, unknown> | undefined> | undefined
) {
  const merged: Record<string, unknown> = {};
  const sources = Array.isArray(metadata) ? metadata : [metadata];

  for (const source of sources) {
    if (!source) continue;
    for (const key of GOVERNANCE_METADATA_KEYS) {
      if (merged[key] === undefined && getMetadataString(source, key)) {
        merged[key] = source[key];
      }
    }
  }

  return merged;
}

function projectPolicyDecisionDisplay(
  decision: AgentToolExecutionPolicyDecisionRecord
): AgentToolExecutionPolicyDecisionRecord {
  return omitUndefined({
    id: getString(decision.id),
    decisionId: getString(decision.decisionId),
    requestId: getString(decision.requestId) ?? '',
    decision: getString(decision.decision) ?? '',
    riskClass: getString(decision.riskClass),
    reason: getString(decision.reason)
  }) as AgentToolExecutionPolicyDecisionRecord;
}

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
  if (!metadata) return undefined;
  const value = metadata[key];
  if (key === 'sandboxExitCode' && typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return getString(value);
}

function getEventRequestId(payload: Record<string, unknown>) {
  return getString(payload.requestId) ?? getString(payload.executionRequestId);
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function buildRecordKeys(...values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function omitUndefined<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: T[K];
  };
}

function riskPriority(riskClass: string) {
  switch (riskClass) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
