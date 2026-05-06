import type { ChatEventRecord } from '@agent/core';

import type {
  AgentToolExecutionEventLogSummary,
  AgentToolExecutionEventStatus,
  AgentToolExecutionEventSummary
} from './runtime-agent-tool-execution-projections';

export function summarizeAgentToolExecutionEvents(events: ChatEventRecord[]): AgentToolExecutionEventLogSummary {
  const projectedEvents = events
    .map(projectAgentToolExecutionEvent)
    .filter((event): event is AgentToolExecutionEventSummary => Boolean(event))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));

  return {
    blockedCount: projectedEvents.filter(event => event.status === 'blocked').length,
    resumedCount: projectedEvents.filter(event => event.status === 'resumed').length,
    latestEvents: projectedEvents.slice(0, 5)
  };
}

function projectAgentToolExecutionEvent(event: ChatEventRecord): AgentToolExecutionEventSummary | undefined {
  const payload = event.payload;
  if (event.type === 'tool_stream_detected') {
    return projectToolLifecycleEvent(event, 'running', '工具流已检测');
  }

  if (event.type === 'tool_stream_dispatched') {
    return projectToolLifecycleEvent(event, 'running', '工具流已派发');
  }

  if (event.type === 'tool_stream_completed') {
    return projectToolLifecycleEvent(event, getLifecycleStatus(payload, 'succeeded'), '工具流完成');
  }

  if (event.type === 'execution_step_completed') {
    return projectToolLifecycleEvent(event, getLifecycleStatus(payload, 'succeeded'), '执行步骤完成');
  }

  if (event.type === 'execution_step_blocked') {
    const requestId = getRequestId(payload);
    if (!requestId) return undefined;
    return {
      eventId: event.id,
      requestId,
      status: 'blocked',
      title: '执行步骤阻断',
      summary: getEventSummary(payload) ?? getString(payload.reasonCode),
      toolName: getString(payload.toolName),
      nodeId: getString(payload.nodeId),
      at: event.at
    };
  }

  if (event.type === 'execution_step_resumed') {
    const requestId = getRequestId(payload);
    if (!requestId) return undefined;
    return {
      eventId: event.id,
      requestId,
      status: 'resumed',
      title: '执行步骤恢复',
      summary: getEventSummary(payload) ?? getString(payload.action),
      toolName: getString(payload.toolName),
      nodeId: getString(payload.nodeId),
      at: event.at
    };
  }

  if (event.type === 'interrupt_resumed' && getString(payload.kind) === 'tool_execution') {
    const requestId = getRequestId(payload);
    if (!requestId) return undefined;
    return {
      eventId: event.id,
      requestId,
      status: 'resumed',
      title: '审批已恢复',
      summary: getString(payload.feedback) ?? getString(payload.action),
      at: event.at
    };
  }

  return undefined;
}

function projectToolLifecycleEvent(
  event: ChatEventRecord,
  status: AgentToolExecutionEventStatus,
  title: string
): AgentToolExecutionEventSummary | undefined {
  const payload = event.payload;
  const requestId = getRequestId(payload);
  if (!requestId) return undefined;

  return {
    eventId: event.id,
    requestId,
    status,
    title,
    summary: getEventSummary(payload),
    toolName: getString(payload.toolName),
    nodeId: getString(payload.nodeId),
    at: event.at
  };
}

function getLifecycleStatus(
  payload: Record<string, unknown>,
  fallback: AgentToolExecutionEventStatus
): AgentToolExecutionEventStatus {
  const status = getString(payload.status);
  if (status === 'running' || status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    return status;
  }
  return fallback;
}

function getEventSummary(payload: Record<string, unknown>) {
  return getString(payload.outputPreview) ?? getString(payload.chunk) ?? getString(payload.status);
}

function getRequestId(payload: Record<string, unknown>) {
  return getString(payload.requestId) ?? getString(payload.executionRequestId);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
