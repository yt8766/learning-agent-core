import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { fetchChatSession } from '@/api/chat-query';
import { createSessionStream, selectSession, appendMessage } from '@/api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  buildSessionActivationPlan,
  activateChatSession,
  formatSessionTime,
  getMessageRoleLabel,
  getSessionStatusLabel,
  mergeOrAppendMessage,
  STARTER_PROMPT
} from './chat-session/chat-session-helpers';
import { createChatSessionActions } from './chat-session/use-chat-session-actions';
import { useChatSessionStreamManager } from './chat-session/use-chat-session-stream-manager';

export { formatSessionTime, getMessageRoleLabel, getSessionStatusLabel };

export function useChatSession() {
  const queryClient = useQueryClient();
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

  // Stream manager refs are declared early to preserve hook call ordering for tests.
  const checkpointRef = useRef<ChatCheckpointRecord | undefined>(undefined);
  const streamManager = useChatSessionStreamManager({
    setCheckpoint,
    setEvents,
    setMessages,
    setSessions,
    setError,
    checkpointRef
  });

  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);
  const streamReconnectSessionRef = useRef('');
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

  // hydrateSessionSnapshot is recreated every render (createChatSessionActions is not memoized).
  // Storing it in a ref prevents it from being listed as a useEffect dependency and causing
  // an infinite render loop: effect fires → fetches checkpoint → updates state → re-render →
  // new function reference → effect fires again.
  const hydrateSnapshotRef = useRef(chatActions.hydrateSessionSnapshot);
  hydrateSnapshotRef.current = chatActions.hydrateSessionSnapshot;

  streamManager.setChatActions(chatActions);

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
          selectSession: sessionId => fetchChatSession(queryClient, sessionId),
          hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) =>
            hydrateSnapshotRef.current(sessionId, forceRefresh),
          createSessionStream,
          bindStream: (nextStream, nextSessionId) =>
            streamManager.bindStream(
              nextStream,
              nextSessionId,
              () => disposed || streamState.intentionalClose,
              streamState
            ),
          startSessionPolling: streamManager.startSessionPolling,
          stopSessionPolling: streamManager.stopSessionPolling,
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
      if (streamManager.checkpointRefreshTimer.current) {
        clearTimeout(streamManager.checkpointRefreshTimer.current);
        streamManager.checkpointRefreshTimer.current = null;
      }
      streamManager.stopSessionPolling(activeSessionId);
    };
  }, [activeSessionId, queryClient, streamReconnectNonce]);

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
