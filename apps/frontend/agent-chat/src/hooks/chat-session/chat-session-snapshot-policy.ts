import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { mergeOrAppendMessage, PENDING_ASSISTANT_PREFIX, PENDING_USER_PREFIX } from './chat-session-helpers';

export const TERMINAL_SESSION_STATUSES = new Set<ChatSessionRecord['status']>(['completed', 'failed', 'cancelled']);

export function shouldRetryFinalSnapshotReconcile(
  sessionId: string,
  detailStatus: ChatSessionRecord['status'] | undefined,
  attempt: number,
  maxRetries: number
) {
  if (attempt >= maxRetries) {
    return false;
  }

  return detailStatus === 'running' && Boolean(sessionId);
}

export function reconcileOptimisticControlMessages(messages: ChatMessageRecord[], events: ChatEventRecord[]) {
  const hasOfficialControlEvent = events.some(event => event.type === 'run_cancelled' || event.type === 'run_resumed');
  if (!hasOfficialControlEvent) {
    return messages;
  }

  return messages.filter(message => !message.id.startsWith('optimistic_control_'));
}

export function mergeSessionMessagesForDetailRefresh(
  currentSessionMessages: ChatMessageRecord[],
  fetchedVisibleMessages: ChatMessageRecord[],
  events: ChatEventRecord[],
  checkpoint?: ChatCheckpointRecord
) {
  let mergedMessages = fetchedVisibleMessages.reduce(
    (messages, message) => mergeOrAppendMessage(messages, message),
    [] as ChatMessageRecord[]
  );
  const snapshotWatermark = getSnapshotWatermark(fetchedVisibleMessages, events, checkpoint);

  for (const currentMessage of currentSessionMessages) {
    if (isPendingMessage(currentMessage.id)) {
      mergedMessages = mergeOrAppendMessage(mergedMessages, currentMessage);
      continue;
    }

    const fetchedMatch = mergedMessages.find(message => message.id === currentMessage.id);
    if (fetchedMatch) {
      if (shouldPreserveCurrentMessageVersion(currentMessage, fetchedMatch)) {
        mergedMessages = mergedMessages.map(message =>
          message.id === currentMessage.id ? mergeMessageVersions(currentMessage, fetchedMatch) : message
        );
      }
      continue;
    }

    if (shouldPreserveLocalOnlyMessage(currentMessage, snapshotWatermark)) {
      mergedMessages = mergeOrAppendMessage(mergedMessages, currentMessage);
    }
  }

  return mergedMessages;
}

export function mergeSessionEventsForDetailRefresh(
  currentEvents: ChatEventRecord[],
  fetchedEvents: ChatEventRecord[],
  sessionId: string,
  checkpoint?: ChatCheckpointRecord
) {
  let mergedEvents = dedupeEvents(fetchedEvents);
  const snapshotWatermark = getSnapshotWatermark([], fetchedEvents, checkpoint);

  for (const currentEvent of currentEvents) {
    if (currentEvent.sessionId !== sessionId) {
      continue;
    }

    if (mergedEvents.some(event => event.id === currentEvent.id)) {
      continue;
    }

    const currentMs = Date.parse(currentEvent.at ?? '');
    if (!Number.isFinite(currentMs) || currentMs > snapshotWatermark) {
      mergedEvents = [...mergedEvents, currentEvent];
    }
  }

  return mergedEvents.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

export function mergeCheckpointForDetailRefresh(
  currentCheckpoint: ChatCheckpointRecord | undefined,
  fetchedCheckpoint: ChatCheckpointRecord
) {
  if (!currentCheckpoint || currentCheckpoint.sessionId !== fetchedCheckpoint.sessionId) {
    return fetchedCheckpoint;
  }

  const currentMs = Date.parse(currentCheckpoint.updatedAt ?? '');
  const fetchedMs = Date.parse(fetchedCheckpoint.updatedAt ?? '');
  if (Number.isFinite(currentMs) && Number.isFinite(fetchedMs) && currentMs > fetchedMs) {
    return currentCheckpoint;
  }

  if (hasHigherPriorityGraphState(currentCheckpoint.graphState?.status, fetchedCheckpoint.graphState?.status)) {
    return {
      ...fetchedCheckpoint,
      graphState: currentCheckpoint.graphState,
      thinkState: currentCheckpoint.thinkState ?? fetchedCheckpoint.thinkState
    };
  }

  return fetchedCheckpoint;
}

function getSnapshotWatermark(
  messages: ChatMessageRecord[],
  events: ChatEventRecord[],
  checkpoint?: ChatCheckpointRecord
) {
  const timestamps = [
    ...messages.map(message => Date.parse(message.createdAt ?? '')),
    ...events.map(event => Date.parse(event.at ?? '')),
    checkpoint ? Date.parse(checkpoint.updatedAt ?? '') : Number.NaN
  ].filter(timestamp => Number.isFinite(timestamp));

  return timestamps.length ? Math.max(...timestamps) : Number.NEGATIVE_INFINITY;
}

function shouldPreserveCurrentMessageVersion(currentMessage: ChatMessageRecord, fetchedMessage: ChatMessageRecord) {
  if (currentMessage.content.length <= fetchedMessage.content.length) {
    return false;
  }

  const currentMs = Date.parse(currentMessage.createdAt ?? '');
  const fetchedMs = Date.parse(fetchedMessage.createdAt ?? '');
  if (!Number.isFinite(currentMs) || !Number.isFinite(fetchedMs)) {
    return true;
  }

  return currentMs >= fetchedMs;
}

function mergeMessageVersions(currentMessage: ChatMessageRecord, fetchedMessage: ChatMessageRecord): ChatMessageRecord {
  return {
    ...fetchedMessage,
    content: currentMessage.content,
    taskId: currentMessage.taskId ?? fetchedMessage.taskId,
    linkedAgent: currentMessage.linkedAgent ?? fetchedMessage.linkedAgent,
    card: currentMessage.card ?? fetchedMessage.card,
    createdAt: currentMessage.createdAt || fetchedMessage.createdAt
  };
}

function shouldPreserveLocalOnlyMessage(currentMessage: ChatMessageRecord, snapshotWatermark: number) {
  const currentMs = Date.parse(currentMessage.createdAt ?? '');
  if (!Number.isFinite(currentMs)) {
    return true;
  }

  return currentMs > snapshotWatermark;
}

function isPendingMessage(messageId: string) {
  return messageId.startsWith(PENDING_ASSISTANT_PREFIX) || messageId.startsWith(PENDING_USER_PREFIX);
}

function dedupeEvents(events: ChatEventRecord[]) {
  const seen = new Set<string>();
  const nextEvents: ChatEventRecord[] = [];
  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    nextEvents.push(event);
  }
  return nextEvents;
}

function hasHigherPriorityGraphState(
  currentStatus: ChatCheckpointRecord['graphState'] extends { status?: infer T } ? T : string | undefined,
  fetchedStatus: ChatCheckpointRecord['graphState'] extends { status?: infer T } ? T : string | undefined
) {
  const statusPriority = new Map<string, number>([
    ['completed', 4],
    ['failed', 4],
    ['cancelled', 4],
    ['blocked', 3],
    ['running', 2],
    ['queued', 1]
  ]);

  return (
    (statusPriority.get(String(currentStatus ?? '')) ?? 0) > (statusPriority.get(String(fetchedStatus ?? '')) ?? 0)
  );
}
