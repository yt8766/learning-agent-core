import { randomUUID } from 'node:crypto';

import type {
  AgentExecutionState,
  AgentMessageRecord as AgentMessage,
  CapabilityOwnerType,
  ExecutionTrace,
  ToolUsageSummaryRecord
} from '@agent/core';
import type { ToolRegistry } from '@agent/tools';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { AgentRole } from '../task-architecture-helpers';

export function addRuntimeMessage(
  task: TaskRecord,
  type: AgentMessage['type'],
  content: string,
  from: AgentRole,
  to: AgentRole = AgentRole.MANAGER
): void {
  task.messages.push({
    id: `msg_${Date.now()}_${task.messages.length}`,
    taskId: task.id,
    from,
    to,
    type,
    content,
    createdAt: new Date().toISOString()
  });
}

export function addRuntimeProgressDelta(task: TaskRecord, content: string, from: AgentRole = AgentRole.MANAGER): void {
  const normalized = content.trim();
  if (!normalized) {
    return;
  }
  task.messages.push({
    id: `progress_${task.id}`,
    taskId: task.id,
    from,
    to: AgentRole.MANAGER,
    type: 'summary_delta',
    content: `${normalized}\n`,
    createdAt: new Date().toISOString()
  });
}

export function upsertRuntimeAgentState(task: TaskRecord, nextState: AgentExecutionState): boolean {
  const index = task.agentStates.findIndex(item => item.role === nextState.role);
  if (index >= 0) {
    task.agentStates[index] = { ...nextState };
    return true;
  }
  task.agentStates.push({ ...nextState });
  return false;
}

export function setRuntimeSubTaskStatus(
  task: TaskRecord,
  role: AgentRole,
  status: 'pending' | 'running' | 'completed' | 'blocked'
) {
  const target = task.plan?.subTasks.find(subTask => subTask.assignedTo === role);
  if (target) {
    target.status = status;
    return true;
  }
  return false;
}

export function addRuntimeTrace(
  trace: ExecutionTrace[],
  node: string,
  summary: string,
  data?: Record<string, unknown>,
  task?: TaskRecord
): void {
  const traceId = task?.traceId ?? randomUUID();
  if (task && !task.traceId) {
    task.traceId = traceId;
  }
  const spanId = typeof data?.spanId === 'string' ? data.spanId : randomUUID();
  const parentSpanId = typeof data?.parentSpanId === 'string' ? data.parentSpanId : resolveParentSpanId(trace, node);
  trace.push({
    traceId,
    spanId,
    parentSpanId,
    node,
    at: new Date().toISOString(),
    summary,
    data,
    specialistId: typeof data?.specialistId === 'string' ? data.specialistId : undefined,
    role: toSpanRole(data?.role),
    latencyMs: typeof data?.latencyMs === 'number' ? data.latencyMs : undefined,
    status: toTraceStatus(data?.status),
    revisionCount: typeof data?.revisionCount === 'number' ? data.revisionCount : undefined,
    modelUsed: typeof data?.modelUsed === 'string' ? data.modelUsed : undefined,
    isFallback: typeof data?.isFallback === 'boolean' ? data.isFallback : undefined,
    fallbackReason: typeof data?.fallbackReason === 'string' ? data.fallbackReason : undefined,
    tokenUsage:
      data?.tokenUsage && typeof data.tokenUsage === 'object'
        ? (data.tokenUsage as ExecutionTrace['tokenUsage'])
        : undefined
  });
}

export function attachRuntimeTool(
  task: TaskRecord,
  toolRegistry: ToolRegistry | undefined,
  params: {
    toolName: string;
    attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
    preferred?: boolean;
    reason?: string;
    ownerType?: CapabilityOwnerType;
    ownerId?: string;
    family?: string;
  }
) {
  const tool = toolRegistry?.get(params.toolName);
  const now = new Date().toISOString();
  const attachment = {
    toolName: params.toolName,
    family: params.family ?? tool?.family ?? 'runtime-governance',
    ownerType: params.ownerType ?? tool?.ownerType ?? 'runtime-derived',
    ownerId: params.ownerId ?? tool?.ownerId,
    attachedAt: now,
    attachedBy: params.attachedBy,
    preferred: params.preferred ?? false,
    reason: params.reason
  };
  task.toolAttachments = dedupeByToolName([...(task.toolAttachments ?? []), attachment]);
  task.updatedAt = now;
}

export function recordRuntimeToolUsage(
  task: TaskRecord,
  toolRegistry: ToolRegistry | undefined,
  params: {
    toolName: string;
    status: ToolUsageSummaryRecord['status'];
    requestedBy?: string;
    reason?: string;
    blockedReason?: string;
    serverId?: string;
    capabilityId?: string;
    approvalRequired?: boolean;
    riskLevel?: ToolUsageSummaryRecord['riskLevel'];
    route?: ToolUsageSummaryRecord['route'];
    family?: string;
    capabilityType?: ToolUsageSummaryRecord['capabilityType'];
  }
) {
  const tool = toolRegistry?.get(params.toolName);
  const now = new Date().toISOString();
  const item: ToolUsageSummaryRecord = {
    toolName: params.toolName,
    family: params.family ?? tool?.family ?? 'runtime-governance',
    capabilityType: params.capabilityType ?? tool?.capabilityType ?? 'governance-tool',
    status: params.status,
    route:
      params.route ??
      (params.serverId || tool?.capabilityType === 'mcp-capability'
        ? 'mcp'
        : tool?.capabilityType === 'governance-tool'
          ? 'governance'
          : 'local'),
    requestedBy: params.requestedBy,
    reason: params.reason,
    blockedReason: params.blockedReason,
    serverId: params.serverId,
    capabilityId: params.capabilityId,
    approvalRequired: params.approvalRequired,
    riskLevel: params.riskLevel ?? tool?.riskLevel,
    usedAt: now
  };
  task.toolUsageSummary = dedupeUsage([...(task.toolUsageSummary ?? []), item]).slice(-50);
  task.updatedAt = now;
}

function resolveParentSpanId(trace: ExecutionTrace[], node: string): string | undefined {
  if (!trace.length) {
    return undefined;
  }
  const scopedParent = [...trace].reverse().find(item => item.node === node || belongsToSameStage(item.node, node));
  return scopedParent?.spanId ?? trace[trace.length - 1]?.spanId;
}

function belongsToSameStage(previousNode: string, nextNode: string): boolean {
  const groups = [
    ['goal_intake', 'route', 'libu_routed', 'specialist_routed', 'dispatch'],
    ['research', 'budget_exhausted', 'ministry_started', 'ministry_reported'],
    ['execute', 'approval_gate'],
    ['review', 'critique_guard_triggered', 'final_response_completed', 'finish']
  ];
  return groups.some(group => group.includes(previousNode) && group.includes(nextNode));
}

function toSpanRole(value: unknown): ExecutionTrace['role'] | undefined {
  if (value === 'lead' || value === 'support' || value === 'ministry') {
    return value;
  }
  return undefined;
}

function toTraceStatus(value: unknown): ExecutionTrace['status'] | undefined {
  if (value === 'running' || value === 'failed' || value === 'rejected' || value === 'success' || value === 'timeout') {
    return value;
  }
  return undefined;
}

function dedupeByToolName<T extends { toolName: string }>(items: T[]) {
  return Array.from(new Map(items.map(item => [item.toolName, item])).values());
}

function dedupeUsage(items: ToolUsageSummaryRecord[]) {
  return Array.from(new Map(items.map(item => [`${item.toolName}:${item.status}:${item.usedAt}`, item])).values());
}
