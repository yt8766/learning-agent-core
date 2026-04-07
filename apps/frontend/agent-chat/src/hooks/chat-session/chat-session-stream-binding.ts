import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

interface StreamBindingOptions {
  stream: EventSource;
  sessionId: string;
  isDisposed: () => boolean;
  streamState: {
    intentionalClose: boolean;
    idleTimer: ReturnType<typeof setTimeout> | null;
    hasAssistantContent?: boolean;
  };
  checkpointRef: { current: ChatCheckpointRecord | undefined };
  clearPendingUser: (sessionId: string) => void;
  reconcileFinalSnapshot: (sessionId: string) => Promise<unknown>;
  refreshCheckpointOnly: (sessionId: string) => Promise<ChatCheckpointRecord | undefined>;
  deriveSessionStatusFromCheckpoint: (checkpoint?: ChatCheckpointRecord) => string | undefined;
  shouldIgnoreStaleTerminalStreamEvent: (
    checkpoint: ChatCheckpointRecord | undefined,
    event: ChatEventRecord
  ) => boolean;
  isAssistantContentEvent: (type: ChatEventRecord['type']) => boolean;
  syncCheckpointFromStreamEvent: (
    checkpoint: ChatCheckpointRecord | undefined,
    event: ChatEventRecord
  ) => ChatCheckpointRecord | undefined;
  mergeEvent: (events: ChatEventRecord[], event: ChatEventRecord) => ChatEventRecord[];
  syncMessageFromEvent: (messages: ChatMessageRecord[], event: ChatEventRecord) => ChatMessageRecord[];
  syncProcessMessageFromEvent: (messages: ChatMessageRecord[], event: ChatEventRecord) => ChatMessageRecord[];
  syncSessionFromEvent: (sessions: ChatSessionRecord[], event: ChatEventRecord) => ChatSessionRecord[];
  checkpointRefreshEventTypes: Set<ChatEventRecord['type']>;
  shouldStopStreamingForEvent: (type: ChatEventRecord['type']) => boolean;
  shouldStartDetailPollingAfterStreamError: (input: {
    isDisposed: boolean;
    detailStatus?: string;
    hasAssistantContent?: boolean;
  }) => boolean;
  shouldShowStreamFallbackError: (input: {
    isDisposed: boolean;
    detailStatus?: string;
    hasAssistantContent?: boolean;
  }) => boolean;
  shouldStartDetailPollingAfterIdleClose: (detailStatus?: string) => boolean;
  setCheckpoint: (next: (current: ChatCheckpointRecord | undefined) => ChatCheckpointRecord | undefined) => void;
  setEvents: (next: (current: ChatEventRecord[]) => ChatEventRecord[]) => void;
  setMessages: (next: (current: ChatMessageRecord[]) => ChatMessageRecord[]) => void;
  setSessions: (next: (current: ChatSessionRecord[]) => ChatSessionRecord[]) => void;
  setError: (value: string) => void;
  startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void;
  stopSessionPolling: (sessionId?: string) => void;
  scheduleCheckpointRefresh: () => void;
  streamIdleTimeoutMs: number;
}

export function bindChatSessionStream(options: StreamBindingOptions) {
  const {
    stream,
    sessionId,
    isDisposed,
    streamState,
    checkpointRef,
    clearPendingUser,
    reconcileFinalSnapshot,
    refreshCheckpointOnly,
    deriveSessionStatusFromCheckpoint,
    shouldIgnoreStaleTerminalStreamEvent,
    isAssistantContentEvent,
    syncCheckpointFromStreamEvent,
    mergeEvent,
    syncMessageFromEvent,
    syncProcessMessageFromEvent,
    syncSessionFromEvent,
    checkpointRefreshEventTypes,
    shouldStopStreamingForEvent,
    shouldStartDetailPollingAfterStreamError,
    shouldShowStreamFallbackError,
    shouldStartDetailPollingAfterIdleClose,
    setCheckpoint,
    setEvents,
    setMessages,
    setSessions,
    setError,
    startSessionPolling,
    stopSessionPolling,
    scheduleCheckpointRefresh,
    streamIdleTimeoutMs
  } = options;

  stream.onopen = () => {
    if (isDisposed()) {
      return;
    }
    resetIdleCloseTimer();
    setError('');
    stopSessionPolling(sessionId);
    scheduleCheckpointRefresh();
  };

  stream.onmessage = (raw: MessageEvent<string>) => {
    if (isDisposed()) {
      return;
    }
    resetIdleCloseTimer();
    const nextEvent = JSON.parse(raw.data) as ChatEventRecord;
    if (shouldIgnoreStaleTerminalStreamEvent(checkpointRef.current, nextEvent)) {
      return;
    }
    if (nextEvent.type === 'user_message') {
      clearPendingUser(nextEvent.sessionId);
    }
    if (isAssistantContentEvent(nextEvent.type)) {
      streamState.hasAssistantContent = true;
    }
    setCheckpoint(current => syncCheckpointFromStreamEvent(current, nextEvent));
    setEvents(current => mergeEvent(current, nextEvent));
    setMessages(current => syncProcessMessageFromEvent(syncMessageFromEvent(current, nextEvent), nextEvent));
    setSessions(current => syncSessionFromEvent(current, nextEvent));
    if (checkpointRefreshEventTypes.has(nextEvent.type)) {
      scheduleCheckpointRefresh();
    }
    if (
      nextEvent.type === 'final_response_completed' ||
      nextEvent.type === 'session_finished' ||
      nextEvent.type === 'session_failed'
    ) {
      void globalThis.setTimeout(() => {
        void reconcileFinalSnapshot(nextEvent.sessionId);
      }, 220);
    }
    if (shouldStopStreamingForEvent(nextEvent.type)) {
      streamState.intentionalClose = true;
      clearIdleCloseTimer();
      stream.close();
      stopSessionPolling(nextEvent.sessionId);
    }
  };

  stream.onerror = () => {
    if (isDisposed()) {
      return;
    }
    clearIdleCloseTimer();
    stream.close();
    scheduleCheckpointRefresh();
    void refreshCheckpointOnly(sessionId).then(nextCheckpoint => {
      if (isDisposed()) {
        return;
      }
      const detailStatus = nextCheckpoint ? deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
      if (
        shouldStartDetailPollingAfterStreamError({
          isDisposed: isDisposed(),
          detailStatus,
          hasAssistantContent: streamState.hasAssistantContent
        })
      ) {
        startSessionPolling(sessionId, 'checkpoint');
        if (
          shouldShowStreamFallbackError({
            isDisposed: isDisposed(),
            detailStatus,
            hasAssistantContent: streamState.hasAssistantContent
          })
        ) {
          setError('聊天流已断开，当前改用运行态兜底同步。请确认后端 /api/chat/stream 可达。');
        }
        return;
      }
      if (detailStatus && detailStatus !== 'running') {
        void reconcileFinalSnapshot(sessionId);
      }
      stopSessionPolling(sessionId);
    });
  };

  function resetIdleCloseTimer() {
    clearIdleCloseTimer();
    streamState.idleTimer = setTimeout(() => {
      if (isDisposed()) {
        return;
      }
      streamState.intentionalClose = true;
      stream.close();
      scheduleCheckpointRefresh();
      void refreshCheckpointOnly(sessionId).then(nextCheckpoint => {
        if (isDisposed()) {
          return;
        }
        const detailStatus = nextCheckpoint ? deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
        if (shouldStartDetailPollingAfterIdleClose(detailStatus)) {
          startSessionPolling(sessionId, 'checkpoint');
        } else {
          if (detailStatus) {
            void reconcileFinalSnapshot(sessionId);
          }
          stopSessionPolling(sessionId);
        }
      });
    }, streamIdleTimeoutMs);
  }

  function clearIdleCloseTimer() {
    if (streamState.idleTimer) {
      clearTimeout(streamState.idleTimer);
      streamState.idleTimer = null;
    }
  }
}
