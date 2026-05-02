import {
  appendMessage,
  createSession,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  submitMessageFeedback as submitMessageFeedbackApi,
  updateSession
} from '@/api/chat-api';
import type { ChatMessageFeedbackInput, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  attachEventTaskIdsToMessages,
  deriveSessionStatusFromCheckpoint,
  mergeOrAppendMessage,
  removePendingMessages,
  STARTER_PROMPT,
  syncCheckpointMessages,
  syncMessageFromEvent,
  syncProcessMessageFromEvent,
  syncSessionFromCheckpoint
} from './chat-session-helpers';
import type { CreateChatSessionActionsOptions, OutboundChatMessage } from './chat-session-actions.types';
import {
  beginOptimisticSend,
  clearOptimisticThinkingState,
  clearPendingAssistant,
  clearPendingSessionMessages,
  clearPendingUser,
  insertPendingUserMessage,
  markSessionStatus,
  resolveCheckpointForOptimisticSend,
  syncCheckpointOnly
} from './chat-session-control-actions';
import {
  mergeCheckpointForDetailRefresh,
  mergeSessionEventsForDetailRefresh,
  mergeSessionMessagesForDetailRefresh,
  reconcileOptimisticControlMessages,
  shouldRetryFinalSnapshotReconcile
} from './chat-session-snapshot-policy';
import {
  createRunLoading,
  delay,
  FINAL_RECONCILE_RETRY_DELAY_MS,
  normalizeOutboundMessage,
  shouldAttemptImmediateFinalReconcile,
  type SessionDetailRefreshOptions,
  type FinalSnapshotReconcileOptions
} from './chat-session-action-utils';
import { createApprovalActions } from './chat-session-approval-actions';
import { createLifecycleActions } from './chat-session-lifecycle-actions';

export function createChatSessionActions(
  options: CreateChatSessionActionsOptions & {
    messages?: ChatMessageRecord[];
    feedbackRequestVersions?: { current: Record<string, number> };
  }
) {
  const handleMissingSession = async (sessionId: string) => {
    if (options.pendingInitialMessage.current?.sessionId === sessionId) {
      options.pendingInitialMessage.current = null;
    }
    clearPendingSessionMessages(options, sessionId);
    options.setSessions(current => current.filter(session => session.id !== sessionId));
    if (options.activeSessionId === sessionId) {
      options.setActiveSessionId('');
      options.setMessages([]);
      options.setEvents([]);
      options.setCheckpoint(undefined);
    }
    const nextSessions = await listSessions().catch(() => undefined);
    if (nextSessions) {
      options.setSessions(nextSessions);
    }
    options.setError('当前会话已失效，可能因为后端重启或会话已被移除。已清理旧会话，请重新开始。');
  };

  const runLoading = createRunLoading(options, handleMissingSession);
  const feedbackRequestVersions = options.feedbackRequestVersions?.current ?? {};

  const refreshSessions = async () => {
    const nextSessions = await runLoading(() => listSessions(), '加载会话失败', false);
    if (!nextSessions) return;
    options.setSessions(nextSessions);
    if (options.activeSessionId && !nextSessions.some(session => session.id === options.activeSessionId)) {
      options.setActiveSessionId('');
      options.setMessages([]);
      options.setEvents([]);
      options.setCheckpoint(undefined);
    }
  };

  const refreshSessionDetail = async (
    sessionId = options.activeSessionId,
    detailOptions: boolean | SessionDetailRefreshOptions = true
  ) => {
    if (!sessionId) return;
    const showLoading = typeof detailOptions === 'boolean' ? detailOptions : (detailOptions.showLoading ?? true);
    const result = await runLoading(
      () =>
        Promise.all([listMessages(sessionId), listEvents(sessionId), getCheckpoint(sessionId).catch(() => undefined)]),
      '加载会话详情失败',
      { withLoading: showLoading, sessionId }
    );
    if (!result) return;
    const [rawMessages, rawEvents, rawCheckpoint] = result;
    const nextMessages = Array.isArray(rawMessages) ? rawMessages : [];
    const nextEvents = Array.isArray(rawEvents) ? rawEvents : [];
    const nextCheckpoint = resolveCheckpointForOptimisticSend(options, sessionId, rawCheckpoint);
    const nextStatus = nextCheckpoint ? deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
    const hasPersistedUser = nextMessages.some(message => message.sessionId === sessionId && message.role === 'user');
    const hasPersistedAssistant = nextMessages.some(
      message => message.sessionId === sessionId && message.role === 'assistant'
    );
    const pendingUserId = options.pendingUserIds.current[sessionId];
    const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
    const isTerminalStatus = nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled';
    const shouldClearPendingUser = hasPersistedUser || hasPersistedAssistant || isTerminalStatus;
    const shouldClearPendingAssistant = hasPersistedAssistant || isTerminalStatus;

    if (shouldClearPendingUser) {
      clearPendingUser(options, sessionId);
    }
    if (shouldClearPendingAssistant) {
      clearPendingAssistant(options, sessionId);
    }

    const eventBoundMessages = attachEventTaskIdsToMessages(nextMessages, nextEvents);
    const eventVisibleMessages = nextEvents.reduce(
      (messages, event) => syncProcessMessageFromEvent(syncMessageFromEvent(messages, event), event),
      eventBoundMessages
    );
    options.setMessages(current => {
      const currentSessionMessages = current.filter(message => message.sessionId === sessionId);
      const mergedVisibleMessages = mergeSessionMessagesForDetailRefresh(
        currentSessionMessages,
        eventVisibleMessages,
        nextEvents,
        nextCheckpoint
      );

      const nextThreadMessages = removePendingMessages(
        syncCheckpointMessages(mergedVisibleMessages, nextCheckpoint, sessionId),
        shouldClearPendingAssistant ? pendingAssistantId : undefined,
        shouldClearPendingUser ? pendingUserId : undefined
      );

      return reconcileOptimisticControlMessages(nextThreadMessages, nextEvents);
    });
    options.setEvents(current => mergeSessionEventsForDetailRefresh(current, nextEvents, sessionId, nextCheckpoint));
    options.setCheckpoint(current => {
      if (nextCheckpoint !== undefined) {
        return mergeCheckpointForDetailRefresh(current, nextCheckpoint);
      }

      return current?.sessionId === sessionId ? current : current;
    });
    options.setSessions(current => syncSessionFromCheckpoint(current, nextCheckpoint));
    return {
      checkpoint: nextCheckpoint,
      status: nextStatus
    };
  };

  const hydrateSessionSnapshot = async (sessionId = options.activeSessionId, showLoading = true) =>
    refreshSessionDetail(sessionId, { showLoading });

  const reconcileFinalSnapshot = async (
    sessionId = options.activeSessionId,
    reconcileOptions: FinalSnapshotReconcileOptions = {}
  ) => {
    if (!sessionId) return;
    const attempt = reconcileOptions.attempt ?? 0;
    const maxRetries = reconcileOptions.maxRetries ?? 1;
    const detail = await refreshSessionDetail(sessionId, { showLoading: false });
    if (!detail) {
      return detail;
    }

    if (shouldRetryFinalSnapshotReconcile(sessionId, detail.status, attempt, maxRetries)) {
      await delay(FINAL_RECONCILE_RETRY_DELAY_MS);
      return reconcileFinalSnapshot(sessionId, {
        attempt: attempt + 1,
        maxRetries
      });
    }

    return detail;
  };

  const refreshCheckpointOnly = async (sessionId = options.activeSessionId) => {
    if (!sessionId) return;
    const rawCheckpoint = await runLoading(
      () => getCheckpoint(sessionId).catch(() => undefined),
      '同步会话运行态失败',
      { withLoading: false, sessionId }
    );
    const nextCheckpoint = resolveCheckpointForOptimisticSend(options, sessionId, rawCheckpoint);
    if (nextCheckpoint !== undefined) {
      return syncCheckpointOnly(options, sessionId, nextCheckpoint);
    }
    return nextCheckpoint;
  };

  const createNewSession = async (initialMessage?: string | OutboundChatMessage) => {
    const resolvedMessage = normalizeOutboundMessage(initialMessage ?? options.draft);
    const content = resolvedMessage.payload.trim();
    const displayContent = resolvedMessage.display.trim() || content;
    const previousDraft = options.draft;
    if (content) {
      options.setDraft(STARTER_PROMPT);
    }
    const session = await runLoading(() => createSession(), '创建会话失败');
    if (!session) {
      if (content) {
        options.setDraft(previousDraft);
      }
      return;
    }

    if (content) {
      options.pendingInitialMessage.current = { sessionId: session.id, content };
      options.setSessions(current => [
        { ...session, status: 'running', updatedAt: new Date().toISOString() },
        ...current.filter(item => item.id !== session.id)
      ]);
    } else {
      options.setSessions(current => [session, ...current.filter(item => item.id !== session.id)]);
    }
    options.setMessages([]);
    options.setEvents([]);
    options.setCheckpoint(undefined);
    if (content) {
      beginOptimisticSend(options, session.id, displayContent, { preserveMessages: false });
    }
    options.setActiveSessionId(session.id);
  };

  const renameSessionById = async (sessionId: string, title: string) => {
    const nextTitle = title.trim();
    if (!sessionId || !nextTitle) return;

    const updatedSession = await runLoading(() => updateSession(sessionId, nextTitle), '重命名会话失败', {
      withLoading: false,
      sessionId
    });
    if (!updatedSession) {
      return;
    }

    options.setSessions(current =>
      current.map(session => (session.id === updatedSession.id ? { ...session, ...updatedSession } : session))
    );
  };

  const sendMessage = async (nextMessage?: string | OutboundChatMessage) => {
    const resolvedMessage = normalizeOutboundMessage(nextMessage ?? options.draft);
    const content = resolvedMessage.payload.trim();
    const displayContent = resolvedMessage.display.trim() || content;
    if (!content) return;
    if (!options.activeSessionId) {
      await createNewSession(resolvedMessage);
      return;
    }

    const previousDraft = options.draft;
    options.setDraft(STARTER_PROMPT);
    options.requestStreamReconnect(options.activeSessionId);
    beginOptimisticSend(options, options.activeSessionId, displayContent);
    const nextUserMessage = await runLoading(
      async () => {
        return appendMessage(options.activeSessionId, content, { modelId: resolvedMessage.modelId });
      },
      '发送消息失败',
      { sessionId: options.activeSessionId }
    );

    if (!nextUserMessage) {
      options.setDraft(previousDraft);
      clearOptimisticThinkingState(options, options.activeSessionId);
      clearPendingSessionMessages(options, options.activeSessionId);
      markSessionStatus(options, options.activeSessionId, 'idle');
      return;
    }

    clearPendingUser(options, options.activeSessionId);
    options.setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
    const nextCheckpoint = await refreshCheckpointOnly(options.activeSessionId);
    if (shouldAttemptImmediateFinalReconcile(nextCheckpoint)) {
      await reconcileFinalSnapshot(options.activeSessionId, { maxRetries: 2 });
    }
  };

  const regenerateMessage = async (message: ChatMessageRecord) => {
    if (message.role !== 'assistant') {
      return;
    }

    const threadMessages = options.messages ?? [];
    const lastAssistantMessage = [...threadMessages].reverse().find(candidate => candidate.role === 'assistant');
    if (lastAssistantMessage?.id !== message.id) {
      return;
    }

    const messageIndex = threadMessages.findIndex(candidate => candidate.id === message.id);
    const priorMessages = messageIndex >= 0 ? threadMessages.slice(0, messageIndex) : threadMessages;
    const priorUserMessage = [...priorMessages].reverse().find(candidate => candidate.role === 'user');
    if (!priorUserMessage) {
      return;
    }

    await sendMessage(priorUserMessage.content);
  };

  const submitMessageFeedback = async (message: ChatMessageRecord, feedback: ChatMessageFeedbackInput) => {
    const sessionId = message.sessionId || options.activeSessionId;
    if (!sessionId) {
      return;
    }

    const nextVersion = (feedbackRequestVersions[message.id] ?? 0) + 1;
    feedbackRequestVersions[message.id] = nextVersion;
    const updatedMessage = await runLoading(
      () => submitMessageFeedbackApi(sessionId, message.id, feedback),
      '提交消息反馈失败',
      { withLoading: false, sessionId }
    );
    if (!updatedMessage) {
      return;
    }
    if (feedbackRequestVersions[message.id] !== nextVersion) {
      return;
    }

    options.setMessages(current =>
      current.map(candidate => (candidate.id === updatedMessage.id ? { ...candidate, ...updatedMessage } : candidate))
    );
  };

  const approvalActions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });
  const lifecycleActions = createLifecycleActions({
    options,
    runLoading,
    refreshCheckpointOnly,
    hydrateSessionSnapshot
  });

  return {
    createNewSession,
    hydrateSessionSnapshot,
    reconcileFinalSnapshot,
    refreshCheckpointOnly,
    refreshSessionDetail,
    refreshSessions,
    renameSessionById,
    regenerateMessage,
    sendMessage,
    submitMessageFeedback,
    ...approvalActions,
    ...lifecycleActions,
    markSessionStatus: (sessionId: string, status: ChatSessionRecord['status']) =>
      markSessionStatus(options, sessionId, status),
    insertPendingUserMessage: (sessionId: string, content: string) =>
      insertPendingUserMessage(options, sessionId, content),
    clearPendingUser: (sessionId: string) => clearPendingUser(options, sessionId),
    clearPendingSessionMessages: (sessionId: string) => clearPendingSessionMessages(options, sessionId)
  };
}
