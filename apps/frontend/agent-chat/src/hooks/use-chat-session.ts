import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import {
  appendMessage,
  approveSession,
  cancelSession,
  confirmLearning,
  createSession,
  createSessionStream,
  deleteSession,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  recoverSession,
  rejectSession,
  selectSession,
  updateSession
} from '../api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '../types/chat';
import {
  CHECKPOINT_REFRESH_EVENT_TYPES,
  deriveSessionStatusFromCheckpoint,
  formatSessionTime,
  getMessageRoleLabel,
  getSessionStatusLabel,
  mergeEvent,
  mergeOrAppendMessage,
  PENDING_USER_PREFIX,
  removePendingMessages,
  STARTER_PROMPT,
  syncCheckpointMessages,
  syncSessionFromCheckpoint,
  syncMessageFromEvent,
  syncProcessMessageFromEvent,
  syncSessionFromEvent
} from './chat-session/chat-session-helpers';

export { formatSessionTime, getMessageRoleLabel, getSessionStatusLabel };

export function useChatSession() {
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
  const sessionDetailPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingSessionRef = useRef<string>('');
  const pollingModeRef = useRef<'checkpoint' | 'detail' | ''>('');
  const pendingInitialMessage = useRef<{ sessionId: string; content: string } | null>(null);
  const pendingUserIds = useRef<Record<string, string>>({});

  const activeSession = useMemo(
    () => sessions.find(session => session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const pendingApprovals = checkpoint?.pendingApprovals ?? [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    void refreshSessions();
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let disposed = false;
    let stream: EventSource | undefined;
    const shouldOpenStream =
      pendingInitialMessage.current?.sessionId === activeSessionId ||
      activeSession?.status === 'running' ||
      activeSession?.status === 'waiting_approval' ||
      activeSession?.status === 'waiting_learning_confirmation';

    void (async () => {
      try {
        await selectSession(activeSessionId);
        if (disposed) return;
        await refreshSessionDetail(activeSessionId, true);
        if (disposed) return;

        if (shouldOpenStream) {
          startSessionPolling(activeSessionId, 'checkpoint');
          stream = createSessionStream(activeSessionId);
          stream.onopen = () => {
            setError('');
            scheduleCheckpointRefresh();
            startSessionPolling(activeSessionId, 'checkpoint');
          };
          stream.onmessage = (raw: MessageEvent<string>) => {
            const nextEvent = JSON.parse(raw.data) as ChatEventRecord;
            if (nextEvent.type === 'user_message') {
              clearPendingUser(nextEvent.sessionId);
            }
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
              void refreshSessionDetail(nextEvent.sessionId, false);
            }
          };
          stream.onerror = () => {
            stream?.close();
            startSessionPolling(activeSessionId, 'detail');
            scheduleCheckpointRefresh();
            setError('聊天流已断开，当前改用详情轮询兜底。请确认后端 /api/chat/stream 可达。');
            void refreshSessionDetail(activeSessionId, false);
          };
        } else {
          stopSessionPolling(activeSessionId);
        }

        const pending = pendingInitialMessage.current;
        if (pending?.sessionId === activeSessionId) {
          pendingInitialMessage.current = null;
          insertPendingUserMessage(activeSessionId, pending.content);
          const nextUserMessage = await appendMessage(activeSessionId, pending.content);
          if (disposed) return;
          clearPendingUser(activeSessionId);
          setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
          markSessionRunning(activeSessionId);
        }
      } catch (nextError) {
        if (!disposed) {
          clearPendingSessionMessages(activeSessionId);
          markSessionIdle(activeSessionId);
          setError(nextError instanceof Error ? nextError.message : '激活会话失败');
        }
      }
    })();

    return () => {
      disposed = true;
      stream?.close();
      if (checkpointRefreshTimer.current) {
        clearTimeout(checkpointRefreshTimer.current);
        checkpointRefreshTimer.current = null;
      }
      stopSessionPolling(activeSessionId);
    };
  }, [activeSessionId, activeSession?.status]);

  async function runLoading<T>(task: () => Promise<T>, fallbackMessage: string, withLoading = true) {
    try {
      if (withLoading) setLoading(true);
      setError('');
      return await task();
    } catch (nextError) {
      setError(formatChatError(nextError, fallbackMessage));
      return undefined;
    } finally {
      if (withLoading) setLoading(false);
    }
  }

  function formatChatError(nextError: unknown, fallbackMessage: string) {
    if (axios.isAxiosError(nextError)) {
      if (!nextError.response) {
        return `${fallbackMessage}：当前无法连接后端 API，请确认 server 已启动且 ${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'} 可达。`;
      }
      const detail =
        typeof nextError.response.data === 'string'
          ? nextError.response.data
          : typeof nextError.response.data?.message === 'string'
            ? nextError.response.data.message
            : nextError.message;
      return `${fallbackMessage}：${detail}`;
    }

    return nextError instanceof Error ? nextError.message : fallbackMessage;
  }

  async function refreshSessions() {
    const nextSessions = await runLoading(() => listSessions(), '加载会话失败', false);
    if (!nextSessions) return;
    setSessions(nextSessions);
    if (activeSessionId && !nextSessions.some(session => session.id === activeSessionId)) {
      setActiveSessionId('');
      setMessages([]);
      setEvents([]);
      setCheckpoint(undefined);
    }
  }

  async function refreshSessionDetail(sessionId = activeSessionId, showLoading = true) {
    if (!sessionId) return;
    const result = await runLoading(
      () =>
        Promise.all([listMessages(sessionId), listEvents(sessionId), getCheckpoint(sessionId).catch(() => undefined)]),
      '加载会话详情失败',
      showLoading
    );
    if (!result) return;
    const [nextMessages, nextEvents, nextCheckpoint] = result;
    const nextStatus = deriveSessionStatusFromCheckpoint(nextCheckpoint);
    const hasPersistedUser = nextMessages.some(message => message.sessionId === sessionId && message.role === 'user');
    const hasPersistedAssistant = nextMessages.some(
      message => message.sessionId === sessionId && message.role === 'assistant'
    );
    const pendingUserId = pendingUserIds.current[sessionId];
    const shouldClearPending =
      hasPersistedUser ||
      hasPersistedAssistant ||
      nextStatus === 'completed' ||
      nextStatus === 'failed' ||
      nextStatus === 'cancelled';

    if (shouldClearPending) {
      clearPendingUser(sessionId);
    }

    const nextThreadMessages = shouldClearPending
      ? removePendingMessages(syncCheckpointMessages(nextMessages, nextCheckpoint, sessionId), undefined, pendingUserId)
      : syncCheckpointMessages(nextMessages, nextCheckpoint, sessionId);

    setMessages(nextThreadMessages);
    setEvents(nextEvents);
    setCheckpoint(nextCheckpoint);
    setSessions(current => syncSessionFromCheckpoint(current, nextCheckpoint));
  }

  async function refreshCheckpointOnly(sessionId = activeSessionId) {
    if (!sessionId) return;
    const nextCheckpoint = await runLoading(
      () => getCheckpoint(sessionId).catch(() => undefined),
      '同步会话运行态失败',
      false
    );
    if (nextCheckpoint !== undefined) {
      setMessages(current => syncCheckpointMessages(current, nextCheckpoint, sessionId));
      setCheckpoint(nextCheckpoint);
      setSessions(current => syncSessionFromCheckpoint(current, nextCheckpoint));

      const nextStatus = deriveSessionStatusFromCheckpoint(nextCheckpoint);
      if (nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled') {
        stopSessionPolling(sessionId);
        void refreshSessionDetail(sessionId, false);
      }
    }
  }

  function scheduleCheckpointRefresh() {
    if (checkpointRefreshTimer.current) {
      clearTimeout(checkpointRefreshTimer.current);
    }
    checkpointRefreshTimer.current = setTimeout(() => {
      checkpointRefreshTimer.current = null;
      void refreshCheckpointOnly();
    }, 220);
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
          void refreshSessionDetail(sessionId, false);
          return;
        }
        void refreshCheckpointOnly(sessionId);
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

  async function createNewSession(initialMessage?: string) {
    const content = (initialMessage ?? draft).trim();
    const previousDraft = draft;
    if (content) {
      setDraft(STARTER_PROMPT);
    }
    const session = await runLoading(() => createSession(), '创建会话失败');
    if (!session) {
      if (content) {
        setDraft(previousDraft);
      }
      return;
    }

    if (content) {
      pendingInitialMessage.current = { sessionId: session.id, content };
      setSessions(current => [
        { ...session, status: 'running', updatedAt: new Date().toISOString() },
        ...current.filter(item => item.id !== session.id)
      ]);
    } else {
      setSessions(current => [session, ...current.filter(item => item.id !== session.id)]);
    }
    setMessages([]);
    setEvents([]);
    setCheckpoint(undefined);
    setActiveSessionId(session.id);
  }

  async function sendMessage(nextMessage?: string) {
    const content = (nextMessage ?? draft).trim();
    if (!content) return;
    if (!activeSessionId) {
      await createNewSession(content);
      return;
    }

    const previousDraft = draft;
    setDraft(STARTER_PROMPT);
    markSessionRunning(activeSessionId);
    const nextUserMessage = await runLoading(async () => {
      insertPendingUserMessage(activeSessionId, content);
      return appendMessage(activeSessionId, content);
    }, '发送消息失败');

    if (!nextUserMessage) {
      setDraft(previousDraft);
      clearPendingSessionMessages(activeSessionId);
      markSessionIdle(activeSessionId);
      return;
    }

    clearPendingUser(activeSessionId);
    setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
  }

  async function updateApproval(intent: string, approved: boolean, feedback?: string) {
    if (!activeSessionId) return;
    const task = approved
      ? () => approveSession(activeSessionId, intent, feedback)
      : () => rejectSession(activeSessionId, intent, feedback);
    const updated = await runLoading(task, '更新审批失败');
    if (updated) await refreshSessionDetail(activeSessionId, false);
  }

  async function submitLearningConfirmation() {
    if (!activeSessionId) return;
    const updated = await runLoading(() => confirmLearning(activeSessionId), '确认学习失败');
    if (updated) await refreshSessionDetail(activeSessionId, false);
  }

  async function recoverActiveSession() {
    if (!activeSessionId) return;
    const updated = await runLoading(() => recoverSession(activeSessionId), '恢复会话失败');
    if (updated) await refreshSessionDetail(activeSessionId, false);
  }

  async function cancelActiveSession(reason?: string) {
    if (!activeSessionId) return;
    const updated = await runLoading(() => cancelSession(activeSessionId, reason), '终止会话失败');
    if (updated) await refreshSessionDetail(activeSessionId, false);
  }

  async function deleteSessionById(sessionId: string) {
    if (!sessionId) return;
    const done = await runLoading(() => deleteSession(sessionId), '删除会话失败');
    if (done === undefined) return;
    pendingInitialMessage.current = null;
    clearPendingSessionMessages(sessionId);
    setSessions(current => current.filter(session => session.id !== sessionId));
    if (activeSessionId === sessionId) {
      setMessages([]);
      setEvents([]);
      setCheckpoint(undefined);
      setActiveSessionId('');
    }
  }

  async function deleteActiveSession() {
    if (activeSessionId) {
      await deleteSessionById(activeSessionId);
    }
  }

  async function renameSessionById(sessionId: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const updatedSession = await runLoading(() => updateSession(sessionId, trimmedTitle), '重命名会话失败');
    if (updatedSession) {
      setSessions(current =>
        current.map(session =>
          session.id === sessionId
            ? {
                ...updatedSession,
                compression: updatedSession.compression
                  ? {
                      ...updatedSession.compression,
                      trigger:
                        updatedSession.compression.trigger === 'character_count' ? 'character_count' : 'message_count',
                      source: updatedSession.compression.source === 'llm' ? 'llm' : 'heuristic'
                    }
                  : undefined
              }
            : session
        )
      );
    }
  }

  function markSessionRunning(sessionId: string) {
    setSessions(current =>
      current.map(session =>
        session.id === sessionId ? { ...session, status: 'running', updatedAt: new Date().toISOString() } : session
      )
    );
  }

  function markSessionIdle(sessionId: string) {
    if (!sessionId) return;
    setSessions(current =>
      current.map(session =>
        session.id === sessionId ? { ...session, status: 'idle', updatedAt: new Date().toISOString() } : session
      )
    );
  }

  function insertPendingUserMessage(sessionId: string, content: string) {
    const pendingId = `${PENDING_USER_PREFIX}${sessionId}`;
    pendingUserIds.current[sessionId] = pendingId;
    setMessages(current =>
      mergeOrAppendMessage(current, {
        id: pendingId,
        sessionId,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      })
    );
  }

  function clearPendingUser(sessionId: string) {
    delete pendingUserIds.current[sessionId];
  }

  function clearPendingSessionMessages(sessionId: string) {
    const pendingUserId = pendingUserIds.current[sessionId];
    clearPendingUser(sessionId);
    setMessages(current => removePendingMessages(current, undefined, pendingUserId));
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
    refreshSessionDetail,
    createNewSession,
    sendMessage,
    updateApproval,
    submitLearningConfirmation,
    recoverActiveSession,
    cancelActiveSession,
    renameSessionById,
    deleteSessionById,
    deleteActiveSession
  };
}
