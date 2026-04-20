import { useRef } from 'react';

import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  CHECKPOINT_REFRESH_EVENT_TYPES,
  bindChatSessionStream,
  createSessionPollingRunner,
  deriveSessionStatusFromCheckpoint,
  isAssistantContentEvent,
  mergeEvent,
  shouldIgnoreStaleTerminalStreamEvent,
  shouldShowStreamFallbackError,
  shouldSkipStopSessionPolling,
  shouldStartDetailPollingAfterIdleClose,
  shouldStartDetailPollingAfterStreamError,
  shouldStopStreamingForEvent,
  STREAM_IDLE_TIMEOUT_MS,
  syncCheckpointFromStreamEvent,
  syncMessageFromEvent,
  syncProcessMessageFromEvent,
  syncSessionFromEvent
} from './chat-session-helpers';

export interface ChatActionsForStream {
  clearPendingUser: (sessionId: string) => void;
  reconcileFinalSnapshot: (sessionId: string) => Promise<unknown>;
  refreshCheckpointOnly: (sessionId?: string) => Promise<ChatCheckpointRecord | undefined>;
  hydrateSessionSnapshot: (sessionId: string, forceRefresh?: boolean) => Promise<unknown>;
}

interface StreamManagerDeps {
  setCheckpoint: React.Dispatch<React.SetStateAction<ChatCheckpointRecord | undefined>>;
  setEvents: React.Dispatch<React.SetStateAction<ChatEventRecord[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageRecord[]>>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSessionRecord[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  checkpointRef: React.RefObject<ChatCheckpointRecord | undefined>;
}

export function useChatSessionStreamManager(deps: StreamManagerDeps) {
  const checkpointRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkpointRefreshInFlight = useRef(false);
  const checkpointRefreshQueued = useRef(false);
  const sessionDetailPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingSessionRef = useRef<string>('');
  const pollingModeRef = useRef<'checkpoint' | 'detail' | ''>('');
  const chatActionsRef = useRef<ChatActionsForStream | null>(null);

  function setChatActions(actions: ChatActionsForStream) {
    chatActionsRef.current = actions;
  }

  function scheduleCheckpointRefresh() {
    if (checkpointRefreshTimer.current) {
      clearTimeout(checkpointRefreshTimer.current);
    }
    checkpointRefreshTimer.current = setTimeout(() => {
      checkpointRefreshTimer.current = null;
      void flushCheckpointRefresh();
    }, 220);
  }

  async function flushCheckpointRefresh() {
    if (checkpointRefreshInFlight.current) {
      checkpointRefreshQueued.current = true;
      return;
    }

    checkpointRefreshInFlight.current = true;
    try {
      await chatActionsRef.current?.refreshCheckpointOnly();
    } finally {
      checkpointRefreshInFlight.current = false;
      if (checkpointRefreshQueued.current) {
        checkpointRefreshQueued.current = false;
        scheduleCheckpointRefresh();
      }
    }
  }

  function startSessionPolling(sessionId: string, mode: 'checkpoint' | 'detail') {
    if (!sessionId) {
      return;
    }

    if (pollingSessionRef.current === sessionId && pollingModeRef.current === mode && sessionDetailPollTimer.current) {
      return;
    }

    stopSessionPolling();
    pollingSessionRef.current = sessionId;
    pollingModeRef.current = mode;
    sessionDetailPollTimer.current = setInterval(
      createSessionPollingRunner({
        mode,
        sessionId,
        checkpointRefreshInFlight: checkpointRefreshInFlight.current,
        hydrateSessionSnapshot: (sid, forceRefresh) =>
          chatActionsRef.current?.hydrateSessionSnapshot(sid, forceRefresh) as Promise<{ status?: string } | undefined>,
        refreshCheckpointOnly: sid =>
          chatActionsRef.current?.refreshCheckpointOnly(sid) as Promise<ChatCheckpointRecord | undefined>,
        deriveSessionStatusFromCheckpoint,
        stopSessionPolling
      }),
      mode === 'detail' ? 1500 : 2500
    );
  }

  function stopSessionPolling(sessionId?: string) {
    if (shouldSkipStopSessionPolling(sessionId, pollingSessionRef.current)) {
      return;
    }

    if (sessionDetailPollTimer.current) {
      clearInterval(sessionDetailPollTimer.current);
      sessionDetailPollTimer.current = null;
    }
    if (!sessionId || pollingSessionRef.current === sessionId) {
      pollingSessionRef.current = '';
      pollingModeRef.current = '';
    }
  }

  function bindStream(
    stream: EventSource,
    sessionId: string,
    isDisposed: () => boolean,
    streamState: {
      intentionalClose: boolean;
      idleTimer: ReturnType<typeof setTimeout> | null;
      hasAssistantContent?: boolean;
    }
  ) {
    bindChatSessionStream({
      stream,
      sessionId,
      isDisposed,
      streamState,
      checkpointRef: deps.checkpointRef,
      clearPendingUser: sid => chatActionsRef.current?.clearPendingUser(sid),
      reconcileFinalSnapshot: sid => chatActionsRef.current?.reconcileFinalSnapshot(sid) ?? Promise.resolve(undefined),
      refreshCheckpointOnly: sid =>
        chatActionsRef.current?.refreshCheckpointOnly(sid) as Promise<ChatCheckpointRecord | undefined>,
      deriveSessionStatusFromCheckpoint,
      shouldIgnoreStaleTerminalStreamEvent,
      isAssistantContentEvent,
      syncCheckpointFromStreamEvent,
      mergeEvent,
      syncMessageFromEvent,
      syncProcessMessageFromEvent,
      syncSessionFromEvent,
      checkpointRefreshEventTypes: CHECKPOINT_REFRESH_EVENT_TYPES,
      shouldStopStreamingForEvent,
      shouldStartDetailPollingAfterStreamError,
      shouldShowStreamFallbackError,
      shouldStartDetailPollingAfterIdleClose,
      setCheckpoint: deps.setCheckpoint,
      setEvents: deps.setEvents,
      setMessages: deps.setMessages,
      setSessions: deps.setSessions,
      setError: deps.setError,
      startSessionPolling,
      stopSessionPolling,
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS
    });
  }

  return {
    checkpointRefreshTimer,
    setChatActions,
    scheduleCheckpointRefresh,
    startSessionPolling,
    stopSessionPolling,
    bindStream
  };
}
