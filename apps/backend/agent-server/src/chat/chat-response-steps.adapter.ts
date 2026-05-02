import { z } from 'zod';

import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatEventRecord,
  type ChatResponseStepEvent,
  type ChatResponseStepPhase,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepStatus,
  type ChatResponseStepTarget
} from '@agent/core';

type BuildStepContext = {
  messageId: string;
  sequence: number;
};

type BuildSnapshotInput = {
  sessionId: string;
  messageId: string;
  status: ChatResponseStepSnapshot['status'];
  steps: ChatResponseStepRecord[];
  updatedAt: string;
};

const StepPayloadSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    path: z.string().optional(),
    file: z.string().optional(),
    command: z.string().optional(),
    url: z.string().optional(),
    approvalId: z.string().optional()
  })
  .passthrough();

const EVENT_MAP: Partial<
  Record<
    ChatEventRecord['type'],
    {
      action: ChatResponseStepEvent['action'];
      phase: ChatResponseStepPhase;
      status: ChatResponseStepStatus;
    }
  >
> = {
  tool_called: { action: 'started', phase: 'explore', status: 'running' },
  tool_stream_dispatched: { action: 'started', phase: 'execute', status: 'running' },
  tool_stream_completed: { action: 'completed', phase: 'execute', status: 'completed' },
  execution_step_started: { action: 'started', phase: 'execute', status: 'running' },
  execution_step_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  execution_step_blocked: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_required: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_resolved: { action: 'completed', phase: 'approve', status: 'completed' },
  review_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  final_response_completed: { action: 'completed', phase: 'summarize', status: 'completed' },
  session_finished: { action: 'completed', phase: 'summarize', status: 'completed' },
  session_failed: { action: 'failed', phase: 'summarize', status: 'failed' },
  run_cancelled: { action: 'cancelled', phase: 'summarize', status: 'cancelled' }
};

export function buildChatResponseStepEvent(
  sourceEvent: ChatEventRecord,
  context: BuildStepContext
): ChatResponseStepEvent | null {
  const mapping = EVENT_MAP[sourceEvent.type];
  if (!mapping) {
    return null;
  }

  const payload = StepPayloadSchema.parse(sourceEvent.payload ?? {});
  const step: ChatResponseStepRecord = {
    id: `response-step-${sourceEvent.id}`,
    sessionId: sourceEvent.sessionId,
    messageId: context.messageId,
    sequence: context.sequence,
    phase: mapping.phase,
    status: mapping.status,
    title: payload.title ?? fallbackTitle(sourceEvent.type),
    detail: payload.summary,
    target: buildTarget(payload, mapping.phase),
    startedAt: sourceEvent.at,
    completedAt: isTerminalStepStatus(mapping.status) ? sourceEvent.at : undefined,
    sourceEventId: sourceEvent.id,
    sourceEventType: sourceEvent.type
  };

  return ChatResponseStepEventSchema.parse({
    projection: 'chat_response_step',
    action: mapping.action,
    step
  });
}

export function buildChatResponseStepSnapshot(input: BuildSnapshotInput): ChatResponseStepSnapshot {
  const completedCount = input.steps.filter(step => step.status === 'completed').length;
  const runningCount = input.steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const blockedCount = input.steps.filter(step => step.status === 'blocked').length;
  const failedCount = input.steps.filter(step => step.status === 'failed').length;

  return ChatResponseStepSnapshotSchema.parse({
    projection: 'chat_response_steps',
    sessionId: input.sessionId,
    messageId: input.messageId,
    status: input.status,
    steps: input.steps,
    summary: {
      title:
        input.status === 'completed' ? `已处理 ${input.steps.length} 个步骤` : `处理中 ${input.steps.length} 个步骤`,
      completedCount,
      runningCount,
      blockedCount,
      failedCount
    },
    updatedAt: input.updatedAt
  });
}

function buildTarget(
  payload: z.infer<typeof StepPayloadSchema>,
  phase: ChatResponseStepPhase
): ChatResponseStepTarget | undefined {
  const path = payload.path ?? payload.file;
  if (path) {
    return { kind: 'file', label: path.split('/').at(-1) ?? path, path };
  }
  if (payload.command) {
    return { kind: 'command', label: payload.command };
  }
  if (payload.url && z.string().url().safeParse(payload.url).success) {
    return { kind: 'url', label: payload.url, href: payload.url };
  }
  if (payload.approvalId) {
    return { kind: 'approval', label: payload.approvalId };
  }
  if (phase === 'verify') {
    return { kind: 'test', label: 'verification' };
  }
  return undefined;
}

function fallbackTitle(eventType: ChatEventRecord['type']) {
  return eventType.split('_').join(' ');
}

function isTerminalStepStatus(status: ChatResponseStepStatus) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
