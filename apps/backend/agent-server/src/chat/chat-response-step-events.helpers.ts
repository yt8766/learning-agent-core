import {
  ChatEventRecordSchema,
  type ChatEventRecord,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot
} from '@agent/core';

import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from './chat-response-steps.adapter';

export type ResponseStepProjectionState = {
  assistantMessageId?: string;
  stepsByMessageId: Record<string, ChatResponseStepRecord[]>;
};

export function projectResponseStepEvents(events: ChatEventRecord[]): ChatEventRecord[] {
  const projectionState = createResponseStepProjectionState();
  return events.flatMap(event => [event, ...projectRealtimeResponseStepEvent(event, projectionState)]);
}

export function createResponseStepProjectionState(): ResponseStepProjectionState {
  return {
    stepsByMessageId: {}
  };
}

export function projectRealtimeResponseStepEvent(
  sourceEvent: ChatEventRecord,
  projectionState: ResponseStepProjectionState
): ChatEventRecord[] {
  if (sourceEvent.type === 'user_message') {
    projectionState.assistantMessageId = undefined;
    return [];
  }

  const messageId = readPayloadMessageId(sourceEvent) ?? projectionState.assistantMessageId;
  if (messageId) {
    projectionState.assistantMessageId = messageId;
  }

  if (sourceEvent.type === 'assistant_token') {
    return [];
  }

  if (!projectionState.assistantMessageId) {
    return [];
  }

  const projectedStep = buildChatResponseStepEvent(sourceEvent, {
    messageId: projectionState.assistantMessageId,
    sequence: projectionState.stepsByMessageId[projectionState.assistantMessageId]?.length ?? 0
  });
  if (!projectedStep) {
    return [];
  }

  const stepsForMessage = [
    ...(projectionState.stepsByMessageId[projectionState.assistantMessageId] ?? []),
    projectedStep.step
  ];
  projectionState.stepsByMessageId[projectionState.assistantMessageId] = stepsForMessage;

  const projectedEvents = [buildResponseStepChatEvent(sourceEvent, projectedStep)];
  const snapshotStatus = resolveSnapshotStatus(sourceEvent);
  if (snapshotStatus) {
    const snapshotSteps = resolveSnapshotSteps(stepsForMessage, snapshotStatus, sourceEvent.at);
    projectedEvents.push(
      buildResponseStepSnapshotChatEvent(sourceEvent, {
        sessionId: sourceEvent.sessionId,
        messageId: projectionState.assistantMessageId,
        status: snapshotStatus,
        steps: snapshotSteps,
        updatedAt: sourceEvent.at
      })
    );
    projectionState.stepsByMessageId[projectionState.assistantMessageId] = snapshotSteps;
  }

  return projectedEvents;
}

function buildResponseStepChatEvent(
  sourceEvent: ChatEventRecord,
  payload: NonNullable<ReturnType<typeof buildChatResponseStepEvent>>
): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: `response-step-event-${sourceEvent.id}`,
    sessionId: sourceEvent.sessionId,
    type: 'node_progress',
    at: sourceEvent.at,
    payload
  });
}

function buildResponseStepSnapshotChatEvent(
  sourceEvent: ChatEventRecord,
  input: Parameters<typeof buildChatResponseStepSnapshot>[0]
): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: `response-step-snapshot-${input.messageId}`,
    sessionId: sourceEvent.sessionId,
    type: 'node_progress',
    at: input.updatedAt,
    payload: buildChatResponseStepSnapshot(input)
  });
}

function resolveSnapshotStatus(sourceEvent: ChatEventRecord): ChatResponseStepSnapshot['status'] | null {
  if (sourceEvent.type === 'final_response_completed' || sourceEvent.type === 'session_finished') {
    return 'completed';
  }
  if (sourceEvent.type === 'session_failed') {
    return 'failed';
  }
  if (sourceEvent.type === 'run_cancelled') {
    return 'cancelled';
  }
  return null;
}

function readPayloadMessageId(sourceEvent: ChatEventRecord): string | undefined {
  const messageId = sourceEvent.payload?.messageId;
  return typeof messageId === 'string' && messageId.length > 0 ? messageId : undefined;
}

function resolveSnapshotSteps(
  steps: ChatResponseStepRecord[],
  status: ChatResponseStepSnapshot['status'],
  completedAt: string
): ChatResponseStepRecord[] {
  if (status !== 'completed') {
    return steps;
  }

  return steps.map(step =>
    step.status === 'queued' || step.status === 'running'
      ? {
          ...step,
          status: 'completed',
          completedAt: step.completedAt ?? completedAt,
          durationMs: step.durationMs ?? calculateStepDurationMs(step.startedAt, step.completedAt ?? completedAt)
        }
      : step
  );
}

function calculateStepDurationMs(startedAt: string, completedAt: string): number | undefined {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(completedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return undefined;
  }
  return endMs - startMs;
}
