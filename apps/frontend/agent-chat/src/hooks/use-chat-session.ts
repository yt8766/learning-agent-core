import { useEffect, useMemo, useRef, useState } from 'react';

import {
  appendMessage,
  approveSession,
  confirmLearning,
  createSession,
  createSessionStream,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  recoverSession,
  rejectSession,
  selectSession
} from '../api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '../types/chat';

const STARTER_PROMPT = '2';
const CHECKPOINT_REFRESH_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'approval_required',
  'approval_resolved',
  'learning_pending_confirmation',
  'learning_confirmed',
  'session_finished',
  'session_failed'
]);

export function formatSessionTime(value?: string) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString();
}

export function getSessionStatusLabel(status?: string) {
  switch (status) {
    case 'running':
      return '执行中';
    case 'waiting_approval':
      return '等待审批';
    case 'waiting_learning_confirmation':
      return '等待学习确认';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

export function getMessageRoleLabel(role: ChatMessageRecord['role']) {
  switch (role) {
    case 'user':
      return '你';
    case 'assistant':
      return 'Agent';
    default:
      return '系统';
  }
}

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

    void (async () => {
      try {
        await selectSession(activeSessionId);
        if (disposed) {
          return;
        }

        await refreshSessionDetail(true);
        if (disposed) {
          return;
        }

        stream = createSessionStream();
        stream.onmessage = (event: MessageEvent<string>) => {
          const nextEvent = JSON.parse(event.data) as ChatEventRecord;
          setEvents(current => mergeEvent(current, nextEvent));
          syncMessageFromEvent(nextEvent);
          if (CHECKPOINT_REFRESH_EVENT_TYPES.has(nextEvent.type)) {
            scheduleCheckpointRefresh();
          }
          syncSessionFromEvent(nextEvent);
        };
        stream.onerror = () => {
          stream?.close();
        };
      } catch (nextError) {
        if (!disposed) {
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
    };
  }, [activeSessionId]);

  async function refreshSessions() {
    try {
      const nextSessions = await listSessions();
      setSessions(nextSessions);
      if (!activeSessionId && nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载会话失败');
    }
  }

  async function refreshSessionDetail(showLoading = true) {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');
      const [nextMessages, nextEvents, nextCheckpoint] = await Promise.all([
        listMessages(),
        listEvents(),
        getCheckpoint().catch(() => undefined)
      ]);
      setMessages(nextMessages);
      setEvents(nextEvents);
      setCheckpoint(nextCheckpoint);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载会话详情失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function refreshCheckpointOnly() {
    try {
      const nextCheckpoint = await getCheckpoint().catch(() => undefined);
      setCheckpoint(nextCheckpoint);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '同步会话运行态失败');
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

  async function createNewSession(initialMessage?: string) {
    const content = (initialMessage ?? draft).trim();
    if (!content) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const session = await createSession(content);
      setDraft('');
      await refreshSessions();
      setActiveSessionId(session.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '创建会话失败');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(nextMessage?: string) {
    const content = (nextMessage ?? draft).trim();
    if (!content) {
      return;
    }

    if (!activeSessionId) {
      await createNewSession(content);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const nextUserMessage = await appendMessage(content);
      setMessages(current => mergeMessage(current, nextUserMessage));
      setSessions(current =>
        current.map(session =>
          session.id === activeSessionId
            ? { ...session, status: 'running', updatedAt: new Date().toISOString() }
            : session
        )
      );
      setDraft('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '发送消息失败');
    } finally {
      setLoading(false);
    }
  }

  async function updateApproval(intent: string, approved: boolean) {
    if (!activeSessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (approved) {
        await approveSession(intent);
      } else {
        await rejectSession(intent);
      }
      await refreshSessionDetail(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新审批失败');
    } finally {
      setLoading(false);
    }
  }

  async function submitLearningConfirmation() {
    if (!activeSessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await confirmLearning();
      await refreshSessionDetail(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '确认学习失败');
    } finally {
      setLoading(false);
    }
  }

  async function recoverActiveSession() {
    if (!activeSessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await recoverSession();
      await refreshSessionDetail(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '恢复会话失败');
    } finally {
      setLoading(false);
    }
  }

  function syncSessionFromEvent(event: ChatEventRecord) {
    setSessions(current =>
      current.map(session => {
        if (session.id !== event.sessionId) {
          return session;
        }

        let nextStatus = session.status;
        if (event.type === 'approval_required') {
          nextStatus = 'waiting_approval';
        } else if (event.type === 'approval_resolved') {
          nextStatus = 'running';
        } else if (event.type === 'learning_pending_confirmation') {
          nextStatus = 'waiting_learning_confirmation';
        } else if (
          event.type === 'learning_confirmed' ||
          event.type === 'session_finished' ||
          event.type === 'assistant_message'
        ) {
          nextStatus = 'completed';
        } else if (event.type === 'session_failed') {
          nextStatus = 'failed';
        } else if (
          event.type === 'manager_planned' ||
          event.type === 'subtask_dispatched' ||
          event.type === 'research_progress' ||
          event.type === 'tool_called' ||
          event.type === 'review_completed' ||
          event.type === 'assistant_token'
        ) {
          nextStatus = 'running';
        }

        const taskId =
          typeof event.payload?.taskId === 'string' ? (event.payload.taskId as string) : session.currentTaskId;

        return {
          ...session,
          currentTaskId: taskId,
          status: nextStatus,
          updatedAt: event.at,
          compression:
            event.type === 'conversation_compacted'
              ? {
                  summary:
                    typeof event.payload?.summary === 'string'
                      ? event.payload.summary
                      : (session.compression?.summary ?? ''),
                  condensedMessageCount:
                    typeof event.payload?.condensedMessageCount === 'number'
                      ? event.payload.condensedMessageCount
                      : (session.compression?.condensedMessageCount ?? 0),
                  condensedCharacterCount:
                    typeof event.payload?.condensedCharacterCount === 'number'
                      ? event.payload.condensedCharacterCount
                      : (session.compression?.condensedCharacterCount ?? 0),
                  totalCharacterCount:
                    typeof event.payload?.totalCharacterCount === 'number'
                      ? event.payload.totalCharacterCount
                      : (session.compression?.totalCharacterCount ?? 0),
                  trigger: event.payload?.trigger === 'character_count' ? 'character_count' : 'message_count',
                  source: event.payload?.source === 'llm' ? 'llm' : 'heuristic',
                  updatedAt: event.at
                }
              : session.compression
        };
      })
    );
  }

  function syncMessageFromEvent(event: ChatEventRecord) {
    const payload = event.payload ?? {};
    if (event.type !== 'assistant_message' && event.type !== 'user_message' && event.type !== 'assistant_token') {
      return;
    }

    const messageId = typeof payload.messageId === 'string' ? payload.messageId : '';
    const content = typeof payload.content === 'string' ? payload.content : '';

    if (!messageId || !content) {
      return;
    }

    const role: ChatMessageRecord['role'] = event.type === 'user_message' ? 'user' : 'assistant';
    const linkedAgent = typeof payload.from === 'string' ? payload.from : undefined;

    setMessages(current =>
      mergeOrAppendMessage(
        current,
        {
          id: messageId,
          sessionId: event.sessionId,
          role,
          content,
          linkedAgent,
          createdAt: event.at
        },
        event.type === 'assistant_token'
      )
    );
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
    recoverActiveSession
  };
}

function mergeEvent(current: ChatEventRecord[], nextEvent: ChatEventRecord) {
  if (current.some(event => event.id === nextEvent.id)) {
    return current;
  }

  return [...current, nextEvent];
}

function mergeMessage(current: ChatMessageRecord[], nextMessage: ChatMessageRecord) {
  if (current.some(message => message.id === nextMessage.id)) {
    return current;
  }

  return [...current, nextMessage];
}

function mergeOrAppendMessage(current: ChatMessageRecord[], nextMessage: ChatMessageRecord, appendContent = false) {
  const target = current.find(message => message.id === nextMessage.id);
  if (!target) {
    return [...current, nextMessage];
  }

  if (!appendContent) {
    return current;
  }

  return current.map(message =>
    message.id === nextMessage.id
      ? {
          ...message,
          content: `${message.content}${nextMessage.content}`,
          linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent
        }
      : message
  );
}
