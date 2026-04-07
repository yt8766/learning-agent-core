import { useEffect, useMemo, useRef, useState } from 'react';
import { createSessionStream, selectSession, appendMessage } from '@/api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  CHECKPOINT_REFRESH_EVENT_TYPES,
  buildSessionActivationPlan,
  activateChatSession,
  deriveSessionStatusFromCheckpoint,
  formatSessionTime,
  getMessageRoleLabel,
  getSessionStatusLabel,
  bindChatSessionStream,
  mergeEvent,
  mergeOrAppendMessage,
  isAssistantContentEvent,
  createSessionPollingRunner,
  shouldIgnoreStaleTerminalStreamEvent,
  shouldSkipStopSessionPolling,
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
        const activation = await activateChatSession({
          activeSessionId,
          pendingInitialSessionId: pendingInitialMessage.current?.sessionId,
          pendingInitialMessageContent: pendingInitialMessage.current?.content,
          isDisposed: () => disposed,
          plan,
          selectSession,
          hydrateSessionSnapshot: chatActions.hydrateSessionSnapshot,
          createSessionStream,
          bindStream: (nextStream, nextSessionId) =>
            bindStream(nextStream, nextSessionId, () => disposed || streamState.intentionalClose, streamState),
          startSessionPolling,
          stopSessionPolling,
          clearStreamReconnectSession: () => {
            streamReconnectSessionRef.current = '';
          },
          insertPendingUserMessage: chatActions.insertPendingUserMessage,
          appendMessage,
          clearPendingInitialMessage: () => {
            pendingInitialMessage.current = null;
          },
          clearPendingUser: chatActions.clearPendingUser,
          mergeOrAppendMessage,
          setMessages,
          markSessionStatus: chatActions.markSessionStatus
        });
        stream = activation?.stream;
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
      createSessionPollingRunner({
        mode,
        sessionId,
        checkpointRefreshInFlight: checkpointRefreshInFlight.current,
        hydrateSessionSnapshot: chatActions.hydrateSessionSnapshot,
        refreshCheckpointOnly: chatActions.refreshCheckpointOnly,
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
      checkpointRef,
      clearPendingUser: chatActions.clearPendingUser,
      reconcileFinalSnapshot: chatActions.reconcileFinalSnapshot,
      refreshCheckpointOnly: chatActions.refreshCheckpointOnly,
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
      setCheckpoint,
      setEvents,
      setMessages,
      setSessions,
      setError,
      startSessionPolling,
      stopSessionPolling,
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: STREAM_IDLE_TIMEOUT_MS
    });
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
