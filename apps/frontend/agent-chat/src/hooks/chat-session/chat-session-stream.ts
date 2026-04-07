import type { ChatCheckpointRecord, ChatEventRecord } from '@/types/chat';

const ASSISTANT_CONTENT_EVENT_TYPES = new Set(['assistant_token', 'assistant_message', 'final_response_delta']);
const STREAM_COMPLETION_EVENT_TYPES = new Set([
  'final_response_completed',
  'session_finished',
  'session_failed',
  'run_cancelled'
]);

export function isAssistantContentEvent(eventType: string) {
  return ASSISTANT_CONTENT_EVENT_TYPES.has(eventType);
}

export function shouldStopStreamingForEvent(eventType: string) {
  return STREAM_COMPLETION_EVENT_TYPES.has(eventType);
}

export function shouldIgnoreStaleTerminalStreamEvent(
  checkpoint: ChatCheckpointRecord | undefined,
  event: ChatEventRecord
) {
  if (!checkpoint || checkpoint.sessionId !== event.sessionId || !shouldStopStreamingForEvent(event.type)) {
    return false;
  }

  const checkpointUpdatedMs = Date.parse(checkpoint.updatedAt ?? '');
  const eventAtMs = Date.parse(event.at ?? '');
  const checkpointTaskId = checkpoint.taskId;
  const eventTaskId = typeof event.payload?.taskId === 'string' ? event.payload.taskId : undefined;

  if (checkpointTaskId?.startsWith('optimistic_')) {
    return eventTaskId !== checkpointTaskId;
  }

  if (
    checkpoint.graphState?.status === 'running' &&
    Number.isFinite(checkpointUpdatedMs) &&
    Number.isFinite(eventAtMs) &&
    eventAtMs < checkpointUpdatedMs
  ) {
    return true;
  }

  if (
    checkpoint.graphState?.status === 'running' &&
    checkpointTaskId &&
    eventTaskId &&
    checkpointTaskId !== eventTaskId
  ) {
    return true;
  }

  return false;
}

export function syncCheckpointFromStreamEvent(checkpoint: ChatCheckpointRecord | undefined, event: ChatEventRecord) {
  if (!checkpoint || checkpoint.sessionId !== event.sessionId) {
    return checkpoint;
  }

  if (event.type === 'node_status' || event.type === 'node_progress') {
    return {
      ...checkpoint,
      streamStatus: {
        nodeId: typeof event.payload?.nodeId === 'string' ? event.payload.nodeId : checkpoint.streamStatus?.nodeId,
        nodeLabel:
          typeof event.payload?.nodeLabel === 'string' ? event.payload.nodeLabel : checkpoint.streamStatus?.nodeLabel,
        detail: typeof event.payload?.detail === 'string' ? event.payload.detail : checkpoint.streamStatus?.detail,
        progressPercent:
          typeof event.payload?.progressPercent === 'number'
            ? event.payload.progressPercent
            : checkpoint.streamStatus?.progressPercent,
        updatedAt: event.at
      }
    };
  }

  if (!isAssistantContentEvent(event.type) && !shouldStopStreamingForEvent(event.type)) {
    return checkpoint;
  }

  const nextGraphState =
    event.type === 'assistant_message' || event.type === 'assistant_token' || event.type === 'final_response_delta'
      ? checkpoint.graphState
      : {
          ...checkpoint.graphState,
          status:
            event.type === 'session_failed' ? 'failed' : event.type === 'run_cancelled' ? 'cancelled' : 'completed'
        };

  const shouldSettleThinkState = shouldStopStreamingForEvent(event.type);

  if (!checkpoint.thinkState?.loading || !shouldSettleThinkState) {
    return nextGraphState === checkpoint.graphState
      ? checkpoint
      : {
          ...checkpoint,
          graphState: nextGraphState
        };
  }

  return {
    ...checkpoint,
    thinkState: {
      ...checkpoint.thinkState,
      loading: false,
      blink: false
    },
    graphState: nextGraphState
  };
}
