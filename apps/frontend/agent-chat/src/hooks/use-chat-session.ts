import { useEffect, useMemo, useRef, useState } from 'react';
import { createSessionStream, selectSession, appendMessage } from '@/api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  CHECKPOINT_REFRESH_EVENT_TYPES,
  buildSessionActivationPlan,
  deriveSessionStatusFromCheckpoint,
  formatSessionTime,
  getMessageRoleLabel,
  getSessionStatusLabel,
  mergeEvent,
  mergeOrAppendMessage,
  isAssistantContentEvent,
  shouldIgnoreStaleTerminalStreamEvent,
  shouldStartDetailPollingAfterIdleClose,
  shouldShowStreamFallbackError,
  shouldStartDetailPollingAfterStreamError,
  shouldStopStreamingForEvent,
  STARTER_PROMPT,
  STREAM_IDLE_TIMEOUT_MS,
  syncCheckpointFromStreamEvent,
  syncMessageFromEvent,
  syncProcessMessageFromEvent,
  syncSessionFromEvent
} from './chat-session/chat-session-helpers';
import { createChatSessionActions } from './chat-session/use-chat-session-actions';

export { formatSessionTime, getMessageRoleLabel, getSessionStatusLabel };

export function useChatSession() {
  const bootstrapFinished = useRef(false);
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [events, setEvents] = useState<ChatEventRecord[]>([]);
  const [checkpoint, setCheckpoint] = useState<ChatCheckpointRecord | undefined>(undefined);
  const [draft, setDraft] = useState(STARTER_PROMPT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const checkpointRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkpointRefreshInFlight = useRef(false);
  const checkpointRefreshQueued = useRef(false);
  const checkpointRef = useRef<ChatCheckpointRecord | undefined>(undefined);
  const sessionDetailPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingSessionRef = useRef<string>('');
  const pollingModeRef = useRef<'checkpoint' | 'detail' | ''>('');
  const streamReconnectSessionRef = useRef('');
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);
  const pendingInitialMessage = useRef<{ sessionId: string; content: string } | null>(null);
  const pendingUserIds = useRef<Record<string, string>>({});
  const pendingAssistantIds = useRef<Record<string, string>>({});
  const optimisticThinkingStartedAt = useRef<Record<string, string>>({});

  const activeSession = useMemo(
    () => sessions.find(session => session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const pendingApprovals = checkpoint?.pendingApprovals ?? [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    checkpointRef.current = checkpoint;
  }, [checkpoint]);

  const chatActions = createChatSessionActions({
    activeSessionId,
    activeSession,
    checkpoint,
    draft,
    setDraft,
    setError,
    setLoading,
    setSessions,
    setMessages,
    setEvents,
    setCheckpoint,
    setActiveSessionId,
    requestStreamReconnect: (sessionId: string) => {
      streamReconnectSessionRef.current = sessionId;
      setStreamReconnectNonce(current => current + 1);
    },
    pendingInitialMessage,
    pendingUserIds,
    pendingAssistantIds,
    optimisticThinkingStartedAt
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await chatActions.refreshSessions();
      if (!cancelled) {
        bootstrapFinished.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapFinished.current) {
      return;
    }

    if (!sessions.length) {
      if (!loading) {
        void chatActions.createNewSession();
      }
      return;
    }

    const activeExists = sessions.some(session => session.id === activeSessionId);
    if (activeExists) {
      return;
    }

    const latestSession = sessions
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    if (latestSession) {
      setActiveSessionId(latestSession.id);
    }
  }, [activeSessionId, loading, sessions]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let disposed = false;
    let stream: EventSource | undefined;
    const streamState = {
      intentionalClose: false,
      idleTimer: null as ReturnType<typeof setTimeout> | null
    };

    void (async () => {
      try {
        const plan = buildSessionActivationPlan({
          activeSessionId,
          pendingInitialSessionId: pendingInitialMessage.current?.sessionId,
          streamReconnectSessionId: streamReconnectSessionRef.current
        });

        if (plan.shouldOpenStreamImmediately) {
          streamReconnectSessionRef.current = '';
          startSessionPolling(activeSessionId, 'checkpoint');
          stream = createSessionStream(activeSessionId);
          bindStream(stream, activeSessionId, () => disposed || streamState.intentionalClose, streamState);
          return;
        }

        let detail: Awaited<ReturnType<typeof chatActions.hydrateSessionSnapshot>>;
        if (plan.shouldSelectSession) {
          await selectSession(activeSessionId);
          if (disposed) return;
        }
        if (plan.shouldRefreshDetail) {
          detail = await chatActions.hydrateSessionSnapshot(activeSessionId, true);
        }
        if (disposed) return;

        const hasPendingInitialMessage = pendingInitialMessage.current?.sessionId === activeSessionId;
        const shouldOpenStream = hasPendingInitialMessage || detail?.status === 'running';

        if (!shouldOpenStream) {
          stopSessionPolling(activeSessionId);
          return;
        }

        startSessionPolling(activeSessionId, 'checkpoint');
        stream = createSessionStream(activeSessionId);
        bindStream(stream, activeSessionId, () => disposed || streamState.intentionalClose, streamState);

        const pending = pendingInitialMessage.current;
        if (pending?.sessionId === activeSessionId) {
          pendingInitialMessage.current = null;
          chatActions.insertPendingUserMessage(activeSessionId, pending.content);
          const nextUserMessage = await appendMessage(activeSessionId, pending.content);
          if (disposed) return;
          chatActions.clearPendingUser(activeSessionId);
          setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
          chatActions.markSessionStatus(activeSessionId, 'running');
        }
      } catch (nextError) {
        if (!disposed) {
          chatActions.clearPendingSessionMessages(activeSessionId);
          chatActions.markSessionStatus(activeSessionId, 'idle');
          setError(nextError instanceof Error ? nextError.message : '激活会话失败');
        }
      }
    })();

    return () => {
      disposed = true;
      streamState.intentionalClose = true;
      stream?.close();
      if (streamState.idleTimer) {
        clearTimeout(streamState.idleTimer);
        streamState.idleTimer = null;
      }
      if (checkpointRefreshTimer.current) {
        clearTimeout(checkpointRefreshTimer.current);
        checkpointRefreshTimer.current = null;
      }
      stopSessionPolling(activeSessionId);
    };
  }, [activeSessionId, streamReconnectNonce]);

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
        chatActions.clearPendingUser(nextEvent.sessionId);
      }
      if (isAssistantContentEvent(nextEvent.type)) {
        streamState.hasAssistantContent = true;
      }
      setCheckpoint(current => syncCheckpointFromStreamEvent(current, nextEvent));
      setEvents(current => mergeEvent(current, nextEvent));
      setMessages(current => syncProcessMessageFromEvent(syncMessageFromEvent(current, nextEvent), nextEvent));
      setSessions(current => syncSessionFromEvent(current, nextEvent));
      if (CHECKPOINT_REFRESH_EVENT_TYPES.has(nextEvent.type)) {
        scheduleCheckpointRefresh();
      }
      if (
        nextEvent.type === 'final_response_completed' ||
        nextEvent.type === 'session_finished' ||
        nextEvent.type === 'session_failed'
      ) {
        void globalThis.setTimeout(() => {
          void chatActions.reconcileFinalSnapshot(nextEvent.sessionId);
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
      void chatActions.refreshCheckpointOnly(sessionId).then(nextCheckpoint => {
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
          void chatActions.reconcileFinalSnapshot(sessionId);
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
        stream?.close();
        scheduleCheckpointRefresh();
        void chatActions.refreshCheckpointOnly(sessionId).then(nextCheckpoint => {
          if (isDisposed()) {
            return;
          }
          const detailStatus = nextCheckpoint ? deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
          if (shouldStartDetailPollingAfterIdleClose(detailStatus)) {
            startSessionPolling(sessionId, 'checkpoint');
          } else {
            if (detailStatus) {
              void chatActions.reconcileFinalSnapshot(sessionId);
            }
            stopSessionPolling(sessionId);
          }
        });
      }, STREAM_IDLE_TIMEOUT_MS);
    }

    function clearIdleCloseTimer() {
      if (streamState.idleTimer) {
        clearTimeout(streamState.idleTimer);
        streamState.idleTimer = null;
      }
    }
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
      await chatActions.refreshCheckpointOnly();
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
      () => {
        if (mode === 'detail') {
          void chatActions.hydrateSessionSnapshot(sessionId, false).then(detail => {
            if (!detail) {
              return;
            }
            if (detail.status !== 'running') {
              stopSessionPolling(sessionId);
            }
          });
          return;
        }
        if (!checkpointRefreshInFlight.current) {
          void chatActions.refreshCheckpointOnly(sessionId).then(nextCheckpoint => {
            const nextStatus = nextCheckpoint ? deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
            if (nextStatus && nextStatus !== 'running') {
              stopSessionPolling(sessionId);
            }
          });
        }
      },
      mode === 'detail' ? 1500 : 2500
    );
  }

  function stopSessionPolling(sessionId?: string) {
    if (sessionId && pollingSessionRef.current && pollingSessionRef.current !== sessionId) {
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

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    events,
    checkpoint,
    draft,
    error,
    loading,
    showRightPanel,
    pendingApprovals,
    hasMessages,
    setDraft,
    setActiveSessionId,
    setShowRightPanel,
    refreshSessionDetail: chatActions.refreshSessionDetail,
    createNewSession: chatActions.createNewSession,
    sendMessage: chatActions.sendMessage,
    updateApproval: chatActions.updateApproval,
    updatePlanInterrupt: chatActions.updatePlanInterrupt,
    allowApprovalAndApprove: chatActions.allowApprovalAndApprove,
    installSuggestedSkill: chatActions.installSuggestedSkill,
    submitLearningConfirmation: chatActions.submitLearningConfirmation,
    recoverActiveSession: chatActions.recoverActiveSession,
    cancelActiveSession: chatActions.cancelActiveSession,
    renameSessionById: chatActions.renameSessionById,
    deleteSessionById: chatActions.deleteSessionById,
    deleteActiveSession: chatActions.deleteActiveSession
  };
}
