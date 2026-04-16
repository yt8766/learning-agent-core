import axios from 'axios';

import {
  allowApprovalCapability,
  allowApprovalConnector,
  appendMessage,
  approveSession,
  cancelSession,
  confirmLearning,
  createSession,
  deleteSession,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  recoverSession,
  respondInterrupt,
  rejectSession,
  updateSession
} from '@/api/chat-api';
import type { ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
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
  applyCancelledSessionState,
  applyRecoveredSessionState,
  beginOptimisticSend,
  clearOptimisticThinkingState,
  clearPendingAssistant,
  clearPendingSessionMessages,
  clearPendingUser,
  insertOptimisticControlMessage,
  installSuggestedSkillAction,
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
const FINAL_RECONCILE_RETRY_DELAY_MS = 500;
const TERMINAL_SESSION_STATUSES = new Set(['completed', 'failed', 'cancelled']);

interface SessionDetailRefreshOptions {
  showLoading?: boolean;
}

interface FinalSnapshotReconcileOptions {
  attempt?: number;
  maxRetries?: number;
}

export function createChatSessionActions(options: CreateChatSessionActionsOptions) {
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

  const runLoading = async <T>(
    task: () => Promise<T>,
    fallbackMessage: string,
    runOptions: boolean | { withLoading?: boolean; sessionId?: string } = true
  ) => {
    const withLoading = typeof runOptions === 'boolean' ? runOptions : (runOptions.withLoading ?? true);
    const sessionId = typeof runOptions === 'boolean' ? undefined : runOptions.sessionId;
    try {
      if (withLoading) options.setLoading(true);
      options.setError('');
      return await task();
    } catch (nextError) {
      if (sessionId && isMissingSessionError(nextError)) {
        await handleMissingSession(sessionId);
        return undefined;
      }
      options.setError(formatChatError(nextError, fallbackMessage));
      return undefined;
    } finally {
      if (withLoading) options.setLoading(false);
    }
  };

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

  const updateApproval = async (
    intent: string,
    approved: boolean,
    feedback?: string,
    approvalScope?: 'once' | 'session' | 'always'
  ) => {
    if (!options.activeSessionId) return;
    const task = approved
      ? () => approveSession(options.activeSessionId, intent, feedback, approvalScope)
      : () => rejectSession(options.activeSessionId, intent, feedback);
    const updated = await runLoading(task, '更新审批失败', { sessionId: options.activeSessionId });
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  const updatePlanInterrupt = async (params: {
    action: 'input' | 'bypass' | 'abort';
    interruptId?: string;
    answers?: Array<{
      questionId: string;
      optionId?: string;
      freeform?: string;
    }>;
  }) => {
    if (!options.activeSessionId) return;
    const endpoint = params.action === 'abort' ? 'reject' : 'approve';
    const updated = await runLoading(
      () =>
        respondInterrupt(options.activeSessionId, {
          endpoint,
          intent: 'plan_question',
          interrupt: {
            interruptId: params.interruptId,
            action: params.action,
            payload: params.answers
              ? { answers: params.answers, interactionKind: 'plan-question' }
              : { interactionKind: 'plan-question' }
          }
        }),
      '更新计划问题失败',
      { sessionId: options.activeSessionId }
    );
    if (updated) {
      if (params.action === 'abort') {
        insertOptimisticControlMessage(options, options.activeSessionId, '计划已取消');
      } else if (params.action === 'bypass') {
        insertOptimisticControlMessage(options, options.activeSessionId, '已按推荐项跳过计划，正在继续执行');
      } else {
        insertOptimisticControlMessage(options, options.activeSessionId, '已提交计划回答，正在更新方案');
      }
      await hydrateSessionSnapshot(options.activeSessionId, false);
    }
  };

  const allowApprovalAndApprove = async (params: { intent: string; capabilityId?: string; serverId?: string }) => {
    if (!options.activeSessionId) return;
    const updated = await runLoading(
      async () => {
        if (params.capabilityId && params.serverId) {
          await allowApprovalCapability(params.serverId, params.capabilityId);
        } else if (params.serverId) {
          await allowApprovalConnector(params.serverId);
        }
        return approveSession(options.activeSessionId, params.intent, undefined, 'always');
      },
      '更新授权策略失败',
      { sessionId: options.activeSessionId }
    );
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  const submitLearningConfirmation = async () => {
    if (!options.activeSessionId) return;
    const updated = await runLoading(() => confirmLearning(options.activeSessionId), '确认学习失败', {
      sessionId: options.activeSessionId
    });
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  const recoverActiveSession = async () => {
    if (!options.activeSessionId) return;
    const activeStatus = options.activeSession?.status;
    if (activeStatus === 'running' || activeStatus === 'waiting_approval') {
      options.setError('当前这轮已经在处理中，无需重复恢复。');
      return;
    }
    const updated = await runLoading(() => recoverSession(options.activeSessionId), '恢复会话失败', {
      sessionId: options.activeSessionId
    });
    if (updated) {
      applyRecoveredSessionState(options, options.activeSessionId, updated);
      insertOptimisticControlMessage(options, options.activeSessionId, '已恢复执行');
      options.requestStreamReconnect(options.activeSessionId);
      await hydrateSessionSnapshot(options.activeSessionId, false);
    }
  };

  const cancelActiveSession = async (reason?: string) => {
    if (!options.activeSessionId) return;
    const activeStatus = options.activeSession?.status;
    const checkpointTaskId = options.checkpoint?.taskId;
    if (activeStatus === 'cancelled') {
      options.setError('当前这轮已经终止，无需重复操作。');
      return;
    }
    if (activeStatus === 'completed' || activeStatus === 'failed') {
      options.setError('当前没有可终止的运行中的任务。');
      return;
    }
    if (activeStatus === 'idle' && !checkpointTaskId) {
      options.setError('当前没有可终止的运行中的任务。');
      return;
    }
    const updated = await runLoading(() => cancelSession(options.activeSessionId, reason), '终止会话失败', {
      sessionId: options.activeSessionId
    });
    if (updated) {
      applyCancelledSessionState(options, options.activeSessionId, updated);
      insertOptimisticControlMessage(options, options.activeSessionId, reason ? `本轮已终止：${reason}` : '本轮已终止');
      await hydrateSessionSnapshot(options.activeSessionId, false);
    }
  };

  const installSuggestedSkill = async (
    suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number]
  ) => {
    await installSuggestedSkillAction(options, {
      suggestion,
      runLoading,
      refreshCheckpointOnly,
      hydrateSessionSnapshot
    });
  };

  const deleteSessionById = async (sessionId: string) => {
    if (!sessionId) return;
    const done = await runLoading(() => deleteSession(sessionId), '删除会话失败');
    if (done === undefined) return;
    options.pendingInitialMessage.current = null;
    clearPendingSessionMessages(options, sessionId);
    options.setSessions(current => current.filter(session => session.id !== sessionId));
    if (options.activeSessionId === sessionId) {
      options.setMessages([]);
      options.setEvents([]);
      options.setCheckpoint(undefined);
      options.setActiveSessionId('');
    }
  };

  const deleteActiveSession = async () => {
    if (options.activeSessionId) {
      await deleteSessionById(options.activeSessionId);
    }
  };

  const renameSessionById = async (sessionId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const updatedSession = await runLoading(() => updateSession(sessionId, trimmedTitle), '重命名会话失败');
    if (updatedSession) {
      options.setSessions(current =>
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
  };

  return {
    createNewSession,
    hydrateSessionSnapshot,
    reconcileFinalSnapshot,
    refreshCheckpointOnly,
    refreshSessionDetail,
    refreshSessions,
    sendMessage,
    updateApproval,
    updatePlanInterrupt,
    allowApprovalAndApprove,
    installSuggestedSkill,
    submitLearningConfirmation,
    recoverActiveSession,
    cancelActiveSession,
    deleteSessionById,
    deleteActiveSession,
    renameSessionById,
    markSessionStatus: (sessionId: string, status: ChatSessionRecord['status']) =>
      markSessionStatus(options, sessionId, status),
    insertPendingUserMessage: (sessionId: string, content: string) =>
      insertPendingUserMessage(options, sessionId, content),
    clearPendingUser: (sessionId: string) => clearPendingUser(options, sessionId),
    clearPendingSessionMessages: (sessionId: string) => clearPendingSessionMessages(options, sessionId)
  };
}

function delay(ms: number) {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

function formatChatError(nextError: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(nextError)) {
    if (fallbackMessage === '终止会话失败') {
      if (nextError.response?.status === 404) {
        return '当前会话不存在或已被移除。';
      }
      if (nextError.response?.status === 400) {
        return '当前没有可终止的运行中的任务。';
      }
      if (nextError.response?.status && nextError.response.status >= 500) {
        return '终止请求已发送，但服务端暂时没有正确返回结果。请稍后刷新会话状态。';
      }
    }
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

function isMissingSessionError(nextError: unknown) {
  if (!axios.isAxiosError(nextError)) {
    return false;
  }
  if (nextError.response?.status !== 404) {
    return false;
  }
  const detail =
    typeof nextError.response.data === 'string'
      ? nextError.response.data
      : typeof nextError.response.data?.message === 'string'
        ? nextError.response.data.message
        : nextError.message;
  return /session\s+.+not found/i.test(detail);
}

function normalizeOutboundMessage(input: string | OutboundChatMessage): OutboundChatMessage {
  if (typeof input === 'string') {
    return {
      display: input,
      payload: input
    };
  }

  return input;
}

function shouldAttemptImmediateFinalReconcile(
  checkpoint: Awaited<ReturnType<ReturnType<typeof createChatSessionActions>['refreshCheckpointOnly']>>
) {
  if (!checkpoint) {
    return false;
  }
  return TERMINAL_SESSION_STATUSES.has(deriveSessionStatusFromCheckpoint(checkpoint));
}
