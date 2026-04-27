import type { RunBundleRecord } from '@agent/core';

import type { RunObservatoryFocusTarget } from '@/features/run-observatory/run-observatory-panel-support';

import { resolveGraphFilterForFocusTarget, type AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import type {
  AgentToolExecutionPolicyDecisionRecord,
  AgentToolExecutionProjectionInput,
  AgentToolExecutionRequestRecord
} from './runtime-agent-tool-execution-projections';

export interface RuntimeRunWorkbenchReplayDraftSeed {
  key: string;
  workflowCommand?: string;
  goal: string;
  sourceLabel?: string;
  sourceKind?: 'story' | 'stage' | 'graph';
  baseGoal: string;
  scopeChips: string[];
  scopeSections: string[];
}

export interface RuntimeReplayLaunchReceipt {
  sourceLabel?: string;
  scoped: boolean;
  baselineTaskId?: string;
}

export interface RuntimeRunWorkbenchAgentToolExecutionItem {
  id: string;
  at?: string;
  title: string;
  summary: string;
}

export interface RuntimeRunWorkbenchAgentToolExecutionDigest {
  requestCount: number;
  terminalResultCount: number;
  eventCount: number;
  governanceSummary?: string;
  latestItems: RuntimeRunWorkbenchAgentToolExecutionItem[];
}

export function inferWorkflowCommand(goal: string) {
  const trimmed = goal.trim();
  if (!trimmed.startsWith('/')) {
    return undefined;
  }
  const [command] = trimmed.split(/\s+/, 1);
  return command || undefined;
}

export function stripWorkflowCommand(goal: string, command?: string) {
  if (!command) {
    return goal;
  }
  return goal.startsWith(`${command} `) ? goal.slice(command.length + 1) : goal;
}

export function buildReplayGoal(command: string, goal: string) {
  return [command.trim(), goal.trim()].filter(Boolean).join(' ').trim();
}

function buildScopedReplayGoal(baseGoal: string, scopeSections: string[]) {
  return [baseGoal.trim(), ...scopeSections.map(section => section.trim())].filter(Boolean).join('\n\n');
}

export function buildCurrentNodeSlice(detail?: RunBundleRecord | null, currentNode?: string, currentStage?: string) {
  if (!detail) {
    return [];
  }

  const traceMatches = detail.traces
    .filter(
      item => (currentNode ? item.node === currentNode : false) || (currentStage ? item.stage === currentStage : false)
    )
    .map(item => ({
      id: `span:${item.spanId}`,
      label: `trace ${item.node}`,
      summary: item.summary,
      at: item.startedAt,
      focusTarget: { kind: 'span' as const, id: item.spanId }
    }));
  const checkpointMatches = detail.checkpoints
    .filter(item => (currentStage ? item.stage === currentStage : false))
    .map(item => ({
      id: `checkpoint:${item.checkpointId}`,
      label: `checkpoint ${item.checkpointId}`,
      summary: item.summary,
      at: item.createdAt,
      focusTarget: { kind: 'checkpoint' as const, id: item.checkpointId }
    }));
  const interruptMatches = detail.interrupts
    .filter(item => (currentStage ? item.stage === currentStage : false))
    .map(item => ({
      id: `interrupt:${item.id}`,
      label: `interrupt ${item.kind}`,
      summary: item.summary,
      at: item.createdAt,
      focusTarget: item.relatedSpanId
        ? { kind: 'span' as const, id: item.relatedSpanId }
        : item.relatedCheckpointId
          ? { kind: 'checkpoint' as const, id: item.relatedCheckpointId }
          : undefined
    }));

  return [...traceMatches, ...checkpointMatches, ...interruptMatches]
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-4);
}

export function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function buildAgentToolExecutionDigestForTask(
  input: AgentToolExecutionProjectionInput | undefined,
  taskId?: string
): RuntimeRunWorkbenchAgentToolExecutionDigest {
  if (!input || !taskId) {
    return createEmptyAgentToolExecutionDigest();
  }

  const requests = (input.requests ?? []).filter(request => request.taskId === taskId);
  const requestIds = new Set(requests.flatMap(request => uniqueValues([request.requestId, request.id])));
  const results = (input.results ?? []).filter(result => requestIds.has(result.requestId));
  const policyDecisions = (input.policyDecisions ?? []).filter(decision => requestIds.has(decision.requestId));
  const events = (input.events ?? []).filter(event => {
    const payload = event.payload;
    const requestId = getPayloadString(payload, 'requestId') ?? getPayloadString(payload, 'executionRequestId');
    const eventTaskId = getPayloadString(payload, 'taskId');
    return (requestId ? requestIds.has(requestId) : false) || eventTaskId === taskId;
  });

  return {
    requestCount: requests.length,
    terminalResultCount: results.filter(result => isTerminalResultStatus(result.status)).length,
    eventCount: events.length,
    governanceSummary: buildAgentToolExecutionGovernanceSummary(requests, policyDecisions),
    latestItems: [
      ...events.map(event => ({
        id: `event:${event.id}`,
        at: event.at,
        title: getPayloadString(event.payload, 'toolName') ?? event.type,
        summary:
          getPayloadString(event.payload, 'outputPreview') ??
          getPayloadString(event.payload, 'status') ??
          getPayloadString(event.payload, 'action') ??
          'event recorded'
      })),
      ...requests.map(request => ({
        id: `request:${request.requestId ?? request.id ?? request.toolName}`,
        at: request.requestedAt ?? request.createdAt ?? request.updatedAt,
        title: request.toolName,
        summary: [request.status, request.riskClass ? `risk ${request.riskClass}` : undefined, request.nodeId]
          .filter(Boolean)
          .join(' · ')
      }))
    ]
      .sort((left, right) => Date.parse(right.at ?? '') - Date.parse(left.at ?? ''))
      .slice(0, 3)
  };
}

export function buildReplayDraftSeedFromStoryStep(params: {
  runGoal: string;
  step: {
    id: string;
    at: string;
    kind: string;
    title: string;
    summary: string;
    stage?: string;
    nodeLabel?: string;
  };
}): RuntimeRunWorkbenchReplayDraftSeed {
  const workflowCommand = inferWorkflowCommand(params.runGoal);
  const inputGoal = stripWorkflowCommand(params.runGoal, workflowCommand).trim();
  const scopeParts = [
    params.step.stage ? `阶段 ${params.step.stage}` : undefined,
    params.step.nodeLabel ? `节点 ${params.step.nodeLabel}` : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join(' / ');
  const sourceLabel = [params.step.kind, params.step.title].filter(Boolean).join(' · ');
  const scopeSections = [
    `请重点复盘 ${scopeParts || params.step.title}。`,
    `本次关注事件：${params.step.title}。`,
    `上下文摘要：${params.step.summary}`
  ].filter(Boolean);
  const scopeChips = [
    params.step.kind ? `kind ${params.step.kind}` : undefined,
    params.step.stage ? `stage ${params.step.stage}` : undefined,
    params.step.nodeLabel ? `node ${params.step.nodeLabel}` : undefined
  ].filter((value): value is string => Boolean(value));

  return {
    key: `${params.step.id}:${params.step.at}`,
    workflowCommand,
    goal: buildScopedReplayGoal(inputGoal, scopeSections),
    sourceLabel,
    sourceKind: 'story',
    baseGoal: inputGoal,
    scopeChips,
    scopeSections
  };
}

export function buildReplayDraftSeedFromStage(params: {
  runGoal: string;
  stage: {
    id: string;
    title: string;
    summary: string;
    status: string;
  };
}): RuntimeRunWorkbenchReplayDraftSeed {
  const workflowCommand = inferWorkflowCommand(params.runGoal);
  const inputGoal = stripWorkflowCommand(params.runGoal, workflowCommand).trim();
  const scopeSections = [
    `请重点重放阶段 ${params.stage.title}。`,
    `当前阶段状态：${params.stage.status}。`,
    `阶段摘要：${params.stage.summary}`
  ].filter(Boolean);

  return {
    key: `stage:${params.stage.id}:${params.stage.status}`,
    workflowCommand,
    goal: buildScopedReplayGoal(inputGoal, scopeSections),
    sourceLabel: `stage · ${params.stage.title}`,
    sourceKind: 'stage',
    baseGoal: inputGoal,
    scopeChips: [`stage ${params.stage.id}`, `status ${params.stage.status}`],
    scopeSections
  };
}

export function buildReplayDraftSeedFromGraphNode(params: {
  runGoal: string;
  node: {
    id: string;
    label: string;
    summary: string;
    status: string;
    subgraphTitle?: string;
  };
}): RuntimeRunWorkbenchReplayDraftSeed {
  const workflowCommand = inferWorkflowCommand(params.runGoal);
  const inputGoal = stripWorkflowCommand(params.runGoal, workflowCommand).trim();
  const scopeSections = [
    `请重点复盘节点 ${params.node.label}。`,
    params.node.subgraphTitle ? `所在子图：${params.node.subgraphTitle}。` : undefined,
    `当前节点状态：${params.node.status}。`,
    `节点摘要：${params.node.summary}`
  ].filter((value): value is string => Boolean(value));

  return {
    key: `graph:${params.node.id}:${params.node.status}`,
    workflowCommand,
    goal: buildScopedReplayGoal(inputGoal, scopeSections),
    sourceLabel: `graph · ${params.node.label}`,
    sourceKind: 'graph',
    baseGoal: inputGoal,
    scopeChips: [
      `node ${params.node.label}`,
      `status ${params.node.status}`,
      params.node.subgraphTitle ? `subgraph ${params.node.subgraphTitle}` : undefined
    ].filter((value): value is string => Boolean(value)),
    scopeSections
  };
}

export function resolveGraphFilterForWorkbenchTarget(params: {
  detail: RunBundleRecord;
  target: Exclude<RunObservatoryFocusTarget, undefined>;
}): AgentGraphOverlayFilter | undefined {
  return resolveGraphFilterForFocusTarget({
    detail: params.detail,
    target: params.target
  });
}

function createEmptyAgentToolExecutionDigest(): RuntimeRunWorkbenchAgentToolExecutionDigest {
  return {
    requestCount: 0,
    terminalResultCount: 0,
    eventCount: 0,
    latestItems: []
  };
}

function isTerminalResultStatus(status: string) {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function buildAgentToolExecutionGovernanceSummary(
  requests: AgentToolExecutionRequestRecord[],
  policyDecisions: AgentToolExecutionPolicyDecisionRecord[]
) {
  const highestRisk = [
    ...requests.map(request => request.riskClass),
    ...policyDecisions.map(decision => decision.riskClass)
  ]
    .filter((riskClass): riskClass is string => Boolean(riskClass))
    .sort((left, right) => riskPriority(right) - riskPriority(left))[0];
  const approvalDecision = policyDecisions.find(decision => decision.decision === 'require_approval');
  const deniedDecision = policyDecisions.find(decision => decision.decision === 'deny');
  const pendingApprovalCount = requests.filter(request => request.status === 'pending_approval').length;
  const decisionSummary = approvalDecision
    ? ['approval required', approvalDecision.reason].filter(Boolean).join(' · ')
    : deniedDecision
      ? ['denied', deniedDecision.reason].filter(Boolean).join(' · ')
      : pendingApprovalCount
        ? `pending approval ${pendingApprovalCount}`
        : undefined;

  return [highestRisk ? `highest risk ${highestRisk}` : undefined, decisionSummary].filter(Boolean).join(' · ');
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
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
