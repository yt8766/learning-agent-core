import { useEffect, useMemo, useRef, useState } from 'react';

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

const STARTER_PROMPT = '';
const PENDING_ASSISTANT_PREFIX = 'pending_assistant_';
const PENDING_USER_PREFIX = 'pending_user_';
const CHECKPOINT_REFRESH_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'skill_resolved',
  'skill_stage_started',
  'skill_stage_completed',
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'learning_pending_confirmation',
  'learning_confirmed',
  'session_finished',
  'session_failed'
]);
const MESSAGE_VISIBLE_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'session_failed',
  'session_finished'
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
    case 'cancelled':
      return '已终止';
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
  const pendingInitialMessage = useRef<{ sessionId: string; content: string } | null>(null);
  const pendingAssistantIds = useRef<Record<string, string>>({});
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
        if (disposed) {
          return;
        }

        await refreshSessionDetail(activeSessionId, true);
        if (disposed) {
          return;
        }

        if (shouldOpenStream) {
          stream = createSessionStream(activeSessionId);
          stream.onmessage = (event: MessageEvent<string>) => {
            const nextEvent = JSON.parse(event.data) as ChatEventRecord;
            setEvents(current => mergeEvent(current, nextEvent));
            syncMessageFromEvent(nextEvent);
            syncProcessMessageFromEvent(nextEvent);
            if (CHECKPOINT_REFRESH_EVENT_TYPES.has(nextEvent.type)) {
              scheduleCheckpointRefresh();
            }
            syncSessionFromEvent(nextEvent);
          };
          stream.onerror = () => {
            stream?.close();
          };
        }

        const pending = pendingInitialMessage.current;
        if (pending?.sessionId === activeSessionId) {
          pendingInitialMessage.current = null;
          insertPendingUserMessage(activeSessionId, pending.content);
          insertPendingAssistantMessage(activeSessionId);
          const nextUserMessage = await appendMessage(activeSessionId, pending.content);
          if (disposed) {
            return;
          }
          clearPendingUser(activeSessionId);
          setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
          setSessions(current =>
            current.map(session =>
              session.id === activeSessionId
                ? { ...session, status: 'running', updatedAt: new Date().toISOString() }
                : session
            )
          );
        }
      } catch (nextError) {
        if (!disposed) {
          if (activeSessionId) {
            clearPendingSessionMessages(activeSessionId);
          }
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
  }, [activeSessionId, activeSession?.status]);

  async function refreshSessions() {
    try {
      const nextSessions = await listSessions();
      setSessions(nextSessions);
      if (activeSessionId && !nextSessions.some(session => session.id === activeSessionId)) {
        setActiveSessionId('');
        setMessages([]);
        setEvents([]);
        setCheckpoint(undefined);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载会话失败');
    }
  }

  async function refreshSessionDetail(sessionId = activeSessionId, showLoading = true) {
    if (!sessionId) {
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');
      const [nextMessages, nextEvents, nextCheckpoint] = await Promise.all([
        listMessages(sessionId),
        listEvents(sessionId),
        getCheckpoint(sessionId).catch(() => undefined)
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
    if (!activeSessionId) {
      return;
    }

    try {
      const nextCheckpoint = await getCheckpoint(activeSessionId).catch(() => undefined);
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

    try {
      setLoading(true);
      setError('');
      const session = await createSession();
      if (content) {
        pendingInitialMessage.current = { sessionId: session.id, content };
        setDraft(STARTER_PROMPT);
      }
      setSessions(current => [session, ...current.filter(item => item.id !== session.id)]);
      setMessages([]);
      setEvents([]);
      setCheckpoint(undefined);
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
      insertPendingUserMessage(activeSessionId, content);
      insertPendingAssistantMessage(activeSessionId);
      const nextUserMessage = await appendMessage(activeSessionId, content);
      clearPendingUser(activeSessionId);
      setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
      setSessions(current =>
        current.map(session =>
          session.id === activeSessionId
            ? { ...session, status: 'running', updatedAt: new Date().toISOString() }
            : session
        )
      );
      setDraft(STARTER_PROMPT);
    } catch (nextError) {
      clearPendingSessionMessages(activeSessionId);
      setError(nextError instanceof Error ? nextError.message : '发送消息失败');
    } finally {
      setLoading(false);
    }
  }

  async function updateApproval(intent: string, approved: boolean, feedback?: string) {
    if (!activeSessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (approved) {
        await approveSession(activeSessionId, intent, feedback);
      } else {
        await rejectSession(activeSessionId, intent, feedback);
      }
      await refreshSessionDetail(activeSessionId, false);
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
      await confirmLearning(activeSessionId);
      await refreshSessionDetail(activeSessionId, false);
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
      await recoverSession(activeSessionId);
      await refreshSessionDetail(activeSessionId, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '恢复会话失败');
    } finally {
      setLoading(false);
    }
  }

  async function cancelActiveSession(reason?: string) {
    if (!activeSessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await cancelSession(activeSessionId, reason);
      await refreshSessionDetail(activeSessionId, false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '终止会话失败');
    } finally {
      setLoading(false);
    }
  }

  async function deleteSessionById(sessionId: string) {
    if (!sessionId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await deleteSession(sessionId);
      pendingInitialMessage.current = null;
      clearPendingSessionMessages(sessionId);
      setSessions(current => current.filter(session => session.id !== sessionId));
      if (activeSessionId === sessionId) {
        setMessages([]);
        setEvents([]);
        setCheckpoint(undefined);
        setActiveSessionId('');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除会话失败');
    } finally {
      setLoading(false);
    }
  }

  async function deleteActiveSession() {
    if (!activeSessionId) {
      return;
    }

    await deleteSessionById(activeSessionId);
  }

  async function renameSessionById(sessionId: string, title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const updatedSession = await updateSession(sessionId, trimmedTitle);
      setSessions(current => current.map(session => (session.id === sessionId ? updatedSession : session)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '重命名会话失败');
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
        } else if (event.type === 'approval_rejected_with_feedback') {
          nextStatus = 'failed';
        } else if (event.type === 'learning_pending_confirmation') {
          nextStatus = 'waiting_learning_confirmation';
        } else if (
          event.type === 'learning_confirmed' ||
          event.type === 'session_finished' ||
          event.type === 'assistant_message'
        ) {
          nextStatus = 'completed';
        } else if (event.type === 'run_cancelled') {
          nextStatus = 'cancelled';
        } else if (event.type === 'session_failed') {
          nextStatus = 'failed';
        } else if (
          event.type === 'skill_resolved' ||
          event.type === 'skill_stage_started' ||
          event.type === 'skill_stage_completed' ||
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

    if (role === 'assistant') {
      clearPendingAssistant(event.sessionId);
    } else {
      clearPendingUser(event.sessionId);
    }

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

  function syncProcessMessageFromEvent(event: ChatEventRecord) {
    if (!MESSAGE_VISIBLE_EVENT_TYPES.has(event.type)) {
      return;
    }

    const content = buildVisibleEventMessage(event);
    if (!content) {
      return;
    }

    setMessages(current =>
      mergeMessage(current, {
        id: `event_${event.id}`,
        sessionId: event.sessionId,
        role: 'system',
        content,
        card: buildEventCard(event),
        createdAt: event.at
      })
    );
  }

  function insertPendingAssistantMessage(sessionId: string) {
    const pendingId = `${PENDING_ASSISTANT_PREFIX}${sessionId}`;
    pendingAssistantIds.current[sessionId] = pendingId;
    setMessages(current =>
      mergeMessage(current, {
        id: pendingId,
        sessionId,
        role: 'assistant',
        content: '首辅正在规划，过程战报和流式回复会先从这里开始。',
        linkedAgent: 'manager',
        createdAt: new Date().toISOString()
      })
    );
  }

  function clearPendingAssistant(sessionId: string) {
    delete pendingAssistantIds.current[sessionId];
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
    const pendingAssistantId = pendingAssistantIds.current[sessionId];
    const pendingUserId = pendingUserIds.current[sessionId];
    clearPendingAssistant(sessionId);
    clearPendingUser(sessionId);
    if (!pendingAssistantId && !pendingUserId) {
      return;
    }

    setMessages(current =>
      current.filter(message => message.id !== pendingAssistantId && message.id !== pendingUserId)
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
    recoverActiveSession,
    cancelActiveSession,
    renameSessionById,
    deleteSessionById,
    deleteActiveSession
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
    const pendingPlaceholder = current.find(
      message =>
        (message.id.startsWith(PENDING_ASSISTANT_PREFIX) || message.id.startsWith(PENDING_USER_PREFIX)) &&
        message.sessionId === nextMessage.sessionId &&
        message.role === nextMessage.role
    );

    if (pendingPlaceholder) {
      return current.map(message =>
        message.id === pendingPlaceholder.id
          ? {
              ...message,
              id: nextMessage.id,
              content: nextMessage.content,
              linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
              card: nextMessage.card ?? message.card,
              createdAt: nextMessage.createdAt
            }
          : message
      );
    }

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
          linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
          card: nextMessage.card ?? message.card
        }
      : message
  );
}

function buildEventCard(event: ChatEventRecord): ChatMessageRecord['card'] | undefined {
  const payload = event.payload ?? {};
  if (event.type === 'approval_required') {
    return {
      type: 'approval_request',
      intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel : undefined,
      requestedBy: typeof payload.requestedBy === 'string' ? payload.requestedBy : undefined
    };
  }
  if (event.type === 'run_cancelled') {
    return {
      type: 'run_cancelled',
      reason: typeof payload.reason === 'string' ? payload.reason : undefined
    };
  }
  return undefined;
}

function buildVisibleEventMessage(event: ChatEventRecord) {
  const payload = event.payload ?? {};

  switch (event.type) {
    case 'decree_received':
      return '已接收你的任务，首辅正在判断本轮应该走哪条协作流程。';
    case 'skill_resolved':
      return typeof payload.skillId === 'string' ? `已解析流程模板：${payload.skillId}` : '已解析本轮流程模板。';
    case 'skill_stage_started':
    case 'skill_stage_completed':
      return typeof payload.skillStage === 'string' ? `流程阶段更新：${payload.skillStage}` : '流程阶段已更新。';
    case 'supervisor_planned':
    case 'manager_planned':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '首辅已完成本轮规划。';
    case 'libu_routed':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '吏部已完成路由分派。';
    case 'ministry_started':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '某位尚书已开始执行。';
    case 'ministry_reported':
    case 'research_progress':
    case 'tool_called':
    case 'review_completed':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '收到新的阶段战报。';
    case 'subtask_dispatched':
      return typeof payload.content === 'string' && payload.content ? payload.content : '子任务已分派。';
    case 'approval_required':
      return buildApprovalRequiredCopy(payload);
    case 'approval_resolved':
      return '审批已通过，系统继续执行。';
    case 'approval_rejected_with_feedback':
      return typeof payload.feedback === 'string' && payload.feedback
        ? `你已打回并附批注：${payload.feedback}`
        : '你已打回当前奏折。';
    case 'run_resumed':
      return '系统已根据你的决定恢复执行。';
    case 'run_cancelled':
      return typeof payload.reason === 'string' && payload.reason
        ? `已终止当前执行：${payload.reason}`
        : '已终止当前执行。';
    case 'session_failed':
      return typeof payload.error === 'string' && payload.error ? payload.error : '当前会话执行失败。';
    case 'session_finished':
      return '本轮协作已完成，正在整理最终回复。';
    default:
      return '';
  }
}

function buildApprovalRequiredCopy(payload: Record<string, unknown>) {
  const intent = typeof payload.intent === 'string' ? payload.intent : 'unknown';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  const requestedBy = typeof payload.requestedBy === 'string' ? payload.requestedBy : '';
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const intentLabel = getIntentLabel(intent);
  const toolSuffix = toolName ? `，工具为 ${toolName}` : '';
  const actorSuffix = requestedBy ? `，由 ${requestedBy} 发起` : '';

  if (reason) {
    return `等待审批：准备执行${intentLabel}${toolSuffix}${actorSuffix}。${reason}`;
  }

  return `等待审批：准备执行${intentLabel}${toolSuffix}${actorSuffix}。该动作具有风险，需要你明确拍板后才能继续。`;
}

function getIntentLabel(intent: string) {
  switch (intent) {
    case 'write_file':
      return '文件写入';
    case 'call_external_api':
      return '外部请求';
    case 'read_file':
      return '文件读取';
    default:
      return intent;
  }
}
