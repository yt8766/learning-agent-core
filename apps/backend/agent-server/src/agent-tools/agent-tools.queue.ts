import { ExecutionRequestRecordSchema, type ExecutionRequestRecord } from '@agent/core';

export const AGENT_TOOL_QUEUE_DRAIN_MODE = 'synchronous';

export type AgentToolQueueStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export function markAgentToolQueueTransition(
  request: ExecutionRequestRecord,
  status: AgentToolQueueStatus,
  at: string
): ExecutionRequestRecord {
  const existing = readExistingQueueMetadata(request);
  return ExecutionRequestRecordSchema.parse({
    ...request,
    metadata: {
      ...(request.metadata ?? {}),
      executorQueue: {
        drainMode: AGENT_TOOL_QUEUE_DRAIN_MODE,
        queuedAt: existing.queuedAt ?? (status === 'queued' ? at : undefined),
        startedAt: existing.startedAt ?? (status === 'running' ? at : undefined),
        finishedAt: status === 'succeeded' || status === 'failed' || status === 'cancelled' ? at : existing.finishedAt,
        transitions: [...existing.transitions, status]
      }
    }
  });
}

function readExistingQueueMetadata(request: ExecutionRequestRecord): {
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  transitions: AgentToolQueueStatus[];
} {
  const queue = request.metadata?.executorQueue;
  if (!isQueueMetadata(queue)) {
    return { transitions: [] };
  }
  return {
    queuedAt: queue.queuedAt,
    startedAt: queue.startedAt,
    finishedAt: queue.finishedAt,
    transitions: queue.transitions.filter(isQueueStatus)
  };
}

function isQueueMetadata(value: unknown): value is {
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  transitions: unknown[];
} {
  return typeof value === 'object' && value !== null && Array.isArray((value as { transitions?: unknown }).transitions);
}

function isQueueStatus(value: unknown): value is AgentToolQueueStatus {
  return (
    value === 'queued' || value === 'running' || value === 'succeeded' || value === 'failed' || value === 'cancelled'
  );
}
