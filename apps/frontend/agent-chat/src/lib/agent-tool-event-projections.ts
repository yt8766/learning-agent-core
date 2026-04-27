import type {
  AgentToolEventLike,
  AgentToolGovernanceProjectionLike,
  AgentToolPolicyDecisionProjectionLike,
  AgentToolProjectedPolicyDecision,
  AgentToolProjectedApproval,
  AgentToolProjectedEvent,
  AgentToolProjectedEventStatus,
  AgentToolRequestProjectionLike,
  AgentToolResultProjectionLike
} from './agent-tool-event-projection-types';

export type {
  AgentToolEventLike,
  AgentToolGovernanceProjectionLike,
  AgentToolPolicyDecisionProjectionLike,
  AgentToolProjectedPolicyDecision,
  AgentToolProjectedApproval,
  AgentToolProjectedEvent,
  AgentToolProjectedEventKind,
  AgentToolProjectedEventStatus,
  AgentToolRequestProjectionLike,
  AgentToolResultProjectionLike
} from './agent-tool-event-projection-types';

const TOOL_STREAM_EVENTS = new Set(['tool_stream_detected', 'tool_stream_dispatched', 'tool_stream_completed']);
const EXECUTION_STEP_EVENTS = new Set([
  'execution_step_started',
  'execution_step_completed',
  'execution_step_blocked',
  'execution_step_resumed'
]);
const INTERRUPT_EVENTS = new Set(['interrupt_pending', 'interrupt_resumed', 'interrupt_rejected_with_feedback']);
const TERMINAL_STATUSES = new Set<AgentToolProjectedEventStatus>(['succeeded', 'failed', 'cancelled', 'denied']);

export function normalizeAgentToolEvent(eventLike: AgentToolEventLike): AgentToolProjectedEvent | null {
  const type = getString(eventLike.type) ?? getString(eventLike.event);
  const payload = getRecord(eventLike.payload) ?? {};

  if (type === 'tool_selected') {
    return projectToolSelected(payload);
  }
  if (type === 'tool_called') {
    return projectToolCalled(payload);
  }
  if (type && TOOL_STREAM_EVENTS.has(type)) {
    return projectToolStream(type, payload);
  }
  if (type && EXECUTION_STEP_EVENTS.has(type)) {
    return projectExecutionStep(type, payload);
  }
  if (type && INTERRUPT_EVENTS.has(type)) {
    return projectInterrupt(type, payload);
  }
  return null;
}

export function projectAgentToolEventsToTimeline(events: readonly AgentToolEventLike[]): AgentToolProjectedEvent[] {
  return events.flatMap(event => {
    const projected = normalizeAgentToolEvent(event);
    return projected ? [projected] : [];
  });
}

export function projectAgentToolGovernanceProjectionToTimeline(
  projection: AgentToolGovernanceProjectionLike
): AgentToolProjectedEvent[] {
  const timeline = projectAgentToolEventsToTimeline(projection.events ?? []);
  const requestIdsWithEvents = new Set(timeline.map(item => item.requestId));
  const requestIdsWithTerminalEvents = new Set(
    timeline.filter(item => TERMINAL_STATUSES.has(item.status)).map(item => item.requestId)
  );
  const resultByRequestId = new Map<string, AgentToolResultProjectionLike>();
  const requestIdsWithPolicyDecision = new Set(
    timeline.filter(item => item.policyDecision).map(item => item.requestId)
  );

  for (const result of projection.results ?? []) {
    const requestId = getString(result.requestId);
    if (requestId && !resultByRequestId.has(requestId)) {
      resultByRequestId.set(requestId, result);
    }
  }

  for (const request of projection.requests ?? []) {
    const requestId = getString(request.requestId);
    if (!requestId) {
      continue;
    }

    if (!requestIdsWithEvents.has(requestId)) {
      const projectedRequest = projectGovernanceRequest(request);
      if (projectedRequest) {
        timeline.push(projectedRequest);
      }
    }

    const result = resultByRequestId.get(requestId);
    if (result && !requestIdsWithTerminalEvents.has(requestId)) {
      timeline.push(projectGovernanceResult(result));
      requestIdsWithTerminalEvents.add(requestId);
    }
  }

  for (const decision of projection.policyDecisions ?? []) {
    const requestId = getString(decision.requestId);
    if (!requestId || requestIdsWithPolicyDecision.has(requestId)) {
      continue;
    }
    timeline.push(projectGovernancePolicyDecision(decision));
    requestIdsWithPolicyDecision.add(requestId);
  }

  return timeline;
}

function projectGovernanceRequest(request: AgentToolRequestProjectionLike): AgentToolProjectedEvent | null {
  const requestId = getString(request.requestId);
  const toolName = getString(request.toolName);
  if (!requestId || !toolName) {
    return null;
  }

  return {
    requestId,
    kind: 'tool_called',
    status: normalizeProjectedStatus(request.status, 'pending'),
    title: `工具请求 ${toolName}`,
    summary: getString(request.inputPreview),
    toolName,
    capabilityId: getString(request.capabilityId),
    nodeId: getString(request.nodeId),
    riskClass: getString(request.riskClass)
  };
}

function projectGovernanceResult(result: AgentToolResultProjectionLike): AgentToolProjectedEvent {
  return {
    requestId: getString(result.requestId) ?? '',
    kind: 'execution_step',
    status: normalizeProjectedStatus(result.status, 'succeeded'),
    title: '工具结果',
    summary: getString(result.outputPreview),
    nodeId: getString(result.nodeId),
    resultId: getString(result.resultId)
  };
}

function projectGovernancePolicyDecision(decision: AgentToolPolicyDecisionProjectionLike): AgentToolProjectedEvent {
  const policyDecision = buildProjectedPolicyDecision(decision);
  const decisionDisplay = policyDecision ?? {};
  const decisionValue = decisionDisplay.decision;
  const requiresApproval = decisionDisplay.requiresApproval === true || decisionValue === 'require_approval';
  return {
    requestId: getString(decision.requestId) ?? '',
    kind: 'tool_called',
    status: requiresApproval ? 'pending_approval' : decisionValue === 'deny' ? 'denied' : 'succeeded',
    title: decisionValue ? `策略判定 ${decisionValue}` : '策略判定',
    summary: [decisionDisplay.reasonCode, decisionDisplay.reason].filter(Boolean).join('：') || undefined,
    riskClass: decisionDisplay.riskClass,
    approval: requiresApproval ? { required: true } : undefined,
    policyDecision
  };
}

function projectToolSelected(payload: Record<string, unknown>): AgentToolProjectedEvent | null {
  const requestId = getRequestId(payload);
  const toolName = getString(payload.toolName);
  if (!requestId || !toolName) {
    return null;
  }
  const nodeId = getString(payload.nodeId);
  const capabilityId = getString(payload.capabilityId);
  const summary = [nodeId, capabilityId].filter(Boolean).join(' · ') || undefined;
  return {
    requestId,
    kind: 'tool_selected',
    status: 'pending',
    title: `已选择工具 ${toolName}`,
    summary,
    toolName,
    capabilityId,
    nodeId,
    riskClass: getString(payload.riskClass)
  };
}

function projectToolCalled(payload: Record<string, unknown>): AgentToolProjectedEvent | null {
  const requestId = getRequestId(payload);
  const toolName = getString(payload.toolName);
  if (!requestId || !toolName) {
    return null;
  }
  const policyDecision = getRecord(payload.policyDecision);
  const projectedPolicyDecision = buildProjectedPolicyDecision(policyDecision);
  const decision = projectedPolicyDecision?.decision;
  const approvalRequired = decision === 'require_approval';
  return {
    requestId,
    kind: 'tool_called',
    status: approvalRequired ? 'pending_approval' : 'queued',
    title: `工具调用 ${toolName}`,
    summary: getString(payload.inputPreview) ?? getString(payload.summary),
    toolName,
    riskClass: projectedPolicyDecision?.riskClass ?? getString(payload.riskClass),
    approval: approvalRequired ? { required: true } : undefined,
    policyDecision: projectedPolicyDecision
  };
}

function buildProjectedPolicyDecision(
  decision: AgentToolPolicyDecisionProjectionLike | Record<string, unknown> | undefined
): AgentToolProjectedPolicyDecision | undefined {
  if (!decision) {
    return undefined;
  }

  const projected = omitUndefined({
    decisionId: getString(decision.decisionId),
    decision: getString(decision.decision),
    reasonCode: getString(decision.reasonCode),
    reason: getString(decision.reason),
    requiresApproval:
      decision.requiresApproval === true || getString(decision.decision) === 'require_approval' ? true : undefined,
    riskClass: getString(decision.riskClass)
  });

  return hasProjectedPolicyDecisionValue(projected) ? projected : undefined;
}

function hasProjectedPolicyDecisionValue(decision: AgentToolProjectedPolicyDecision) {
  return Boolean(
    decision.decisionId ||
    decision.decision ||
    decision.reasonCode ||
    decision.reason ||
    decision.requiresApproval ||
    decision.riskClass
  );
}

function omitUndefined<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: T[K];
  };
}

function projectToolStream(type: string, payload: Record<string, unknown>): AgentToolProjectedEvent | null {
  const requestId = getRequestId(payload);
  if (!requestId) {
    return null;
  }
  return {
    requestId,
    kind: 'tool_stream',
    status: type === 'tool_stream_completed' ? normalizeTerminalStatus(payload.status) : 'running',
    title: type === 'tool_stream_completed' ? '工具流式输出完成' : '工具流式输出',
    summary: getString(payload.outputPreview) ?? getString(payload.chunk) ?? getString(payload.summary),
    resultId: getString(payload.resultId),
    streamKind: getString(payload.streamKind)
  };
}

function projectExecutionStep(type: string, payload: Record<string, unknown>): AgentToolProjectedEvent | null {
  const requestId = getRequestId(payload);
  if (!requestId) {
    return null;
  }
  const blocked = type === 'execution_step_blocked';
  const resumed = type === 'execution_step_resumed';
  const approval = buildApproval(payload, blocked);
  return {
    requestId,
    kind: 'execution_step',
    status: blocked ? 'blocked' : resumed ? 'resumed' : normalizeExecutionStatus(type, payload.status),
    title: getExecutionStepTitle(type),
    summary:
      getString(payload.outputPreview) ??
      getString(payload.reasonCode) ??
      getString(payload.stage) ??
      getString(payload.status) ??
      getString(payload.action),
    toolName: getString(payload.toolName),
    nodeId: getString(payload.nodeId),
    approval,
    action: getString(payload.action),
    reasonCode: getString(payload.reasonCode),
    resultId: getString(payload.resultId)
  };
}

function projectInterrupt(type: string, payload: Record<string, unknown>): AgentToolProjectedEvent | null {
  if (getString(payload.kind) !== 'tool_execution') {
    return null;
  }
  const requestId = getRequestId(payload);
  if (!requestId) {
    return null;
  }
  const pending = type === 'interrupt_pending';
  const rejected = type === 'interrupt_rejected_with_feedback';
  return {
    requestId,
    kind: 'interrupt',
    status: pending ? 'pending_approval' : rejected ? 'denied' : 'resumed',
    title: pending ? '等待工具审批' : rejected ? '审批已带反馈打回' : '审批已恢复',
    summary: getString(payload.feedback) ?? getString(payload.action),
    approval: buildApproval(payload, pending),
    action: getString(payload.action)
  };
}

function buildApproval(payload: Record<string, unknown>, required: boolean): AgentToolProjectedApproval | undefined {
  const approvalId = getString(payload.approvalId);
  const interruptId = getString(payload.interruptId);
  if (!approvalId && !interruptId && !required) {
    return undefined;
  }
  return {
    approvalId,
    interruptId,
    required
  };
}

function normalizeExecutionStatus(type: string, statusValue: unknown): AgentToolProjectedEventStatus {
  if (type === 'execution_step_started') {
    return 'running';
  }
  if (type === 'execution_step_completed') {
    return normalizeTerminalStatus(statusValue);
  }
  return normalizeTerminalStatus(statusValue);
}

function normalizeTerminalStatus(value: unknown): AgentToolProjectedEventStatus {
  const status = getString(value);
  if (status === 'failed' || status === 'cancelled' || status === 'denied' || status === 'succeeded') {
    return status;
  }
  return 'succeeded';
}

function normalizeProjectedStatus(
  value: unknown,
  fallback: AgentToolProjectedEventStatus
): AgentToolProjectedEventStatus {
  const status = getString(value);
  if (
    status === 'pending' ||
    status === 'pending_policy' ||
    status === 'pending_approval' ||
    status === 'queued' ||
    status === 'running' ||
    status === 'blocked' ||
    status === 'resumed' ||
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'denied'
  ) {
    return status;
  }
  return fallback;
}

function getExecutionStepTitle(type: string) {
  if (type === 'execution_step_started') {
    return '执行步骤开始';
  }
  if (type === 'execution_step_completed') {
    return '执行步骤完成';
  }
  if (type === 'execution_step_blocked') {
    return '执行步骤阻断';
  }
  return '执行步骤恢复';
}

function getRequestId(payload: Record<string, unknown>) {
  return getString(payload.requestId) ?? getString(payload.executionRequestId);
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
