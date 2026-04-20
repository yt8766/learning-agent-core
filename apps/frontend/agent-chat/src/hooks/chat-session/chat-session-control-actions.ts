import type { ChatCheckpointRecord, ChatSessionRecord } from '@/types/chat';
import {
  deriveSessionStatusFromCheckpoint,
  mergeOrAppendMessage,
  PENDING_ASSISTANT_PREFIX,
  PENDING_USER_PREFIX,
  removePendingMessages,
  syncSessionFromCheckpoint,
  syncCheckpointMessages
} from './chat-session-helpers';
import { mergeCheckpointForDetailRefresh, TERMINAL_SESSION_STATUSES } from './chat-session-snapshot-policy';
import type { CreateChatSessionActionsOptions } from './chat-session-actions.types';
import {
  buildCancelledCheckpointState,
  buildOptimisticControlMessage,
  buildRecoveredCheckpointState,
  clearOptimisticThinkingCheckpoint,
  createOptimisticThinkingCheckpoint
} from './chat-session-control-action-helpers';
export {
  installSuggestedSkillAction,
  pollSkillInstallReceipt,
  updateSkillSuggestionInstallState
} from './chat-session-skill-install-actions';

export function insertPendingUserMessage(options: CreateChatSessionActionsOptions, sessionId: string, content: string) {
  const pendingId = `${PENDING_USER_PREFIX}${sessionId}`;
  options.pendingUserIds.current[sessionId] = pendingId;
  options.setMessages(current =>
    mergeOrAppendMessage(current, {
      id: pendingId,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    })
  );
}

export function clearPendingUser(options: CreateChatSessionActionsOptions, sessionId: string) {
  delete options.pendingUserIds.current[sessionId];
}

export function insertPendingAssistantMessage(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingId = `${PENDING_ASSISTANT_PREFIX}${sessionId}`;
  options.pendingAssistantIds.current[sessionId] = pendingId;
  options.setMessages(current =>
    mergeOrAppendMessage(current, {
      id: pendingId,
      sessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    })
  );
}

export function clearPendingAssistant(options: CreateChatSessionActionsOptions, sessionId: string) {
  delete options.pendingAssistantIds.current[sessionId];
  delete options.optimisticThinkingStartedAt.current[sessionId];
}

export function clearPendingSessionMessages(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingUserId = options.pendingUserIds.current[sessionId];
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  clearPendingUser(options, sessionId);
  clearPendingAssistant(options, sessionId);
  options.setMessages(current => removePendingMessages(current, pendingAssistantId, pendingUserId));
}

export function markSessionStatus(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  status: ChatSessionRecord['status']
) {
  if (!sessionId) return;
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId ? { ...session, status, updatedAt: new Date().toISOString() } : session
    )
  );
}

export function setOptimisticThinkingState(options: CreateChatSessionActionsOptions, sessionId: string) {
  const now = new Date().toISOString();
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  options.optimisticThinkingStartedAt.current[sessionId] = now;
  options.setCheckpoint(current => createOptimisticThinkingCheckpoint(current, sessionId, now, pendingAssistantId));
}

export function clearOptimisticThinkingState(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  delete options.optimisticThinkingStartedAt.current[sessionId];
  options.setCheckpoint(current => clearOptimisticThinkingCheckpoint(current, sessionId, pendingAssistantId));
}

export function resolveCheckpointForOptimisticSend(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  nextCheckpoint: ChatCheckpointRecord | undefined
) {
  if (!nextCheckpoint) {
    return nextCheckpoint;
  }

  const optimisticStartedAt = options.optimisticThinkingStartedAt.current[sessionId];
  if (!optimisticStartedAt) {
    return nextCheckpoint;
  }

  const optimisticStartedMs = Date.parse(optimisticStartedAt);
  const checkpointUpdatedMs = Date.parse(nextCheckpoint.updatedAt);
  const nextStatus = deriveSessionStatusFromCheckpoint(nextCheckpoint);
  const hasComparableTimestamps = Number.isFinite(optimisticStartedMs) && Number.isFinite(checkpointUpdatedMs);
  const isOlderThanOptimisticSend = hasComparableTimestamps && checkpointUpdatedMs < optimisticStartedMs;

  if (isOlderThanOptimisticSend && TERMINAL_SESSION_STATUSES.has(nextStatus)) {
    return undefined;
  }

  if (!isOlderThanOptimisticSend || nextStatus === 'running') {
    delete options.optimisticThinkingStartedAt.current[sessionId];
  }

  return nextCheckpoint;
}

export function insertOptimisticControlMessage(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  content: string
) {
  options.setMessages(current => mergeOrAppendMessage(current, buildOptimisticControlMessage(sessionId, content)));
}

export function beginOptimisticSend(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  displayContent: string,
  optionsOverride?: {
    preserveMessages?: boolean;
  }
) {
  markSessionStatus(options, sessionId, 'running');
  if (optionsOverride?.preserveMessages === false) {
    options.setMessages([]);
  }
  insertPendingUserMessage(options, sessionId, displayContent);
  insertPendingAssistantMessage(options, sessionId);
  setOptimisticThinkingState(options, sessionId);
}

export function applyCancelledSessionState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  updatedSession?: ChatSessionRecord
) {
  const now = new Date().toISOString();
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId
        ? {
            ...(updatedSession ?? session),
            status: 'cancelled',
            updatedAt: updatedSession?.updatedAt ?? now
          }
        : session
    )
  );
  options.setCheckpoint(current => {
    return buildCancelledCheckpointState(current, sessionId, now);
  });
}

export function applyRecoveredSessionState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  updatedSession?: ChatSessionRecord
) {
  const now = new Date().toISOString();
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId
        ? {
            ...(updatedSession ?? session),
            status: 'running',
            updatedAt: updatedSession?.updatedAt ?? now
          }
        : session
    )
  );
  options.setCheckpoint(current => {
    return buildRecoveredCheckpointState(current, sessionId, now);
  });
}

export function syncCheckpointOnly(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  nextCheckpoint: ChatCheckpointRecord
) {
  let mergedCheckpoint = nextCheckpoint;
  options.setCheckpoint(current => {
    mergedCheckpoint = mergeCheckpointForDetailRefresh(current, nextCheckpoint);
    return mergedCheckpoint;
  });
  options.setMessages(current =>
    syncCheckpointMessages(
      current.filter(message => message.sessionId === sessionId),
      mergedCheckpoint,
      sessionId
    )
  );
  options.setSessions(current => syncSessionFromCheckpoint(current, mergedCheckpoint));
  return mergedCheckpoint;
}
