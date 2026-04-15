import { getRemoteSkillInstallReceipt, installRemoteSkill } from '@/api/chat-api';
import type { ChatCheckpointRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import {
  deriveSessionStatusFromCheckpoint,
  mergeOrAppendMessage,
  PENDING_ASSISTANT_PREFIX,
  PENDING_USER_PREFIX,
  removePendingMessages,
  syncSessionFromCheckpoint,
  syncCheckpointMessages
} from './chat-session-helpers';
import { mergeCheckpointForDetailRefresh, TERMINAL_SESSION_STATUSES } from './chat-session-snapshot-policy';
import type { CreateChatSessionActionsOptions } from './chat-session-actions.types';
import {
  buildCancelledCheckpointState,
  buildOptimisticControlMessage,
  buildRecoveredCheckpointState,
  clearOptimisticThinkingCheckpoint,
  createOptimisticThinkingCheckpoint,
  mapReceiptStatus
} from './chat-session-control-action-helpers';

export function insertPendingUserMessage(options: CreateChatSessionActionsOptions, sessionId: string, content: string) {
  const pendingId = `${PENDING_USER_PREFIX}${sessionId}`;
  options.pendingUserIds.current[sessionId] = pendingId;
  options.setMessages(current =>
    mergeOrAppendMessage(current, {
      id: pendingId,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    })
  );
}

export function clearPendingUser(options: CreateChatSessionActionsOptions, sessionId: string) {
  delete options.pendingUserIds.current[sessionId];
}

export function insertPendingAssistantMessage(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingId = `${PENDING_ASSISTANT_PREFIX}${sessionId}`;
  options.pendingAssistantIds.current[sessionId] = pendingId;
  options.setMessages(current =>
    mergeOrAppendMessage(current, {
      id: pendingId,
      sessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    })
  );
}

export function clearPendingAssistant(options: CreateChatSessionActionsOptions, sessionId: string) {
  delete options.pendingAssistantIds.current[sessionId];
  delete options.optimisticThinkingStartedAt.current[sessionId];
}

export function clearPendingSessionMessages(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingUserId = options.pendingUserIds.current[sessionId];
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  clearPendingUser(options, sessionId);
  clearPendingAssistant(options, sessionId);
  options.setMessages(current => removePendingMessages(current, pendingAssistantId, pendingUserId));
}

export function markSessionStatus(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  status: ChatSessionRecord['status']
) {
  if (!sessionId) return;
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId ? { ...session, status, updatedAt: new Date().toISOString() } : session
    )
  );
}

export function setOptimisticThinkingState(options: CreateChatSessionActionsOptions, sessionId: string) {
  const now = new Date().toISOString();
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  options.optimisticThinkingStartedAt.current[sessionId] = now;
  options.setCheckpoint(current => createOptimisticThinkingCheckpoint(current, sessionId, now, pendingAssistantId));
}

export function clearOptimisticThinkingState(options: CreateChatSessionActionsOptions, sessionId: string) {
  const pendingAssistantId = options.pendingAssistantIds.current[sessionId];
  delete options.optimisticThinkingStartedAt.current[sessionId];
  options.setCheckpoint(current => clearOptimisticThinkingCheckpoint(current, sessionId, pendingAssistantId));
}

export function resolveCheckpointForOptimisticSend(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  nextCheckpoint: ChatCheckpointRecord | undefined
) {
  if (!nextCheckpoint) {
    return nextCheckpoint;
  }

  const optimisticStartedAt = options.optimisticThinkingStartedAt.current[sessionId];
  if (!optimisticStartedAt) {
    return nextCheckpoint;
  }

  const optimisticStartedMs = Date.parse(optimisticStartedAt);
  const checkpointUpdatedMs = Date.parse(nextCheckpoint.updatedAt);
  const nextStatus = deriveSessionStatusFromCheckpoint(nextCheckpoint);
  const hasComparableTimestamps = Number.isFinite(optimisticStartedMs) && Number.isFinite(checkpointUpdatedMs);
  const isOlderThanOptimisticSend = hasComparableTimestamps && checkpointUpdatedMs < optimisticStartedMs;

  if (isOlderThanOptimisticSend && TERMINAL_SESSION_STATUSES.has(nextStatus)) {
    return undefined;
  }

  if (!isOlderThanOptimisticSend || nextStatus === 'running') {
    delete options.optimisticThinkingStartedAt.current[sessionId];
  }

  return nextCheckpoint;
}

export function insertOptimisticControlMessage(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  content: string
) {
  options.setMessages(current => mergeOrAppendMessage(current, buildOptimisticControlMessage(sessionId, content)));
}

export function updateSkillSuggestionInstallState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  suggestionId: string,
  installState: NonNullable<
    Extract<
      NonNullable<ChatMessageRecord['card']>,
      { type: 'skill_suggestions' }
    >['suggestions'][number]['installState']
  >
) {
  options.setMessages(current =>
    current.map(message => {
      if (message.sessionId !== sessionId || message.card?.type !== 'skill_suggestions') {
        return message;
      }

      const nextSuggestions = message.card.suggestions.map(item =>
        item.id === suggestionId
          ? {
              ...item,
              installState
            }
          : item
      );

      return {
        ...message,
        card: {
          ...message.card,
          suggestions: nextSuggestions
        }
      };
    })
  );
}

export function beginOptimisticSend(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  displayContent: string,
  optionsOverride?: {
    preserveMessages?: boolean;
  }
) {
  markSessionStatus(options, sessionId, 'running');
  if (optionsOverride?.preserveMessages === false) {
    options.setMessages([]);
  }
  insertPendingUserMessage(options, sessionId, displayContent);
  insertPendingAssistantMessage(options, sessionId);
  setOptimisticThinkingState(options, sessionId);
}

export function applyCancelledSessionState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  updatedSession?: ChatSessionRecord
) {
  const now = new Date().toISOString();
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId
        ? {
            ...(updatedSession ?? session),
            status: 'cancelled',
            updatedAt: updatedSession?.updatedAt ?? now
          }
        : session
    )
  );
  options.setCheckpoint(current => {
    return buildCancelledCheckpointState(current, sessionId, now);
  });
}

export function applyRecoveredSessionState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  updatedSession?: ChatSessionRecord
) {
  const now = new Date().toISOString();
  options.setSessions(current =>
    current.map(session =>
      session.id === sessionId
        ? {
            ...(updatedSession ?? session),
            status: 'running',
            updatedAt: updatedSession?.updatedAt ?? now
          }
        : session
    )
  );
  options.setCheckpoint(current => {
    return buildRecoveredCheckpointState(current, sessionId, now);
  });
}

interface PollSkillInstallReceiptOptions {
  sessionId: string;
  suggestionId: string;
  receiptId: string;
  attempt?: number;
  hydrateSessionSnapshot: (sessionId: string, showLoading?: boolean) => Promise<unknown>;
  refreshCheckpointOnly: (sessionId: string) => Promise<unknown>;
}

export async function installSuggestedSkillAction(
  options: CreateChatSessionActionsOptions,
  params: {
    suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number];
    runLoading: <T>(task: () => Promise<T>, fallbackMessage: string, withLoading?: boolean) => Promise<T | undefined>;
    refreshCheckpointOnly: (sessionId: string) => Promise<unknown>;
    hydrateSessionSnapshot: (sessionId: string, showLoading?: boolean) => Promise<unknown>;
  }
) {
  const repo = params.suggestion.repo;
  if (!options.activeSessionId || !repo) {
    return;
  }
  updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
    receiptId: '',
    status: 'requesting'
  });
  const receipt = await params.runLoading(
    () =>
      installRemoteSkill({
        repo,
        skillName: params.suggestion.skillName ?? params.suggestion.displayName,
        detailsUrl: params.suggestion.detailsUrl,
        installCommand: params.suggestion.installCommand,
        triggerReason: params.suggestion.triggerReason,
        summary: params.suggestion.summary
      }),
    '发起 Skill 安装失败'
  );
  if (!receipt) {
    updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
      receiptId: '',
      status: 'failed',
      failureCode: 'install_request_failed'
    });
    return;
  }

  updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
    receiptId: receipt.id,
    status: mapReceiptStatus(receipt.status, receipt.phase),
    phase: receipt.phase,
    result: receipt.result
  });

  insertOptimisticControlMessage(
    options,
    options.activeSessionId,
    receipt.status === 'pending'
      ? `已发起阻塞式中断确认：安装 ${params.suggestion.displayName}`
      : `已开始安装 Skill：${params.suggestion.displayName}`
  );
  if (receipt.status !== 'installed' && receipt.status !== 'failed' && receipt.status !== 'rejected') {
    void pollSkillInstallReceipt(options, {
      sessionId: options.activeSessionId,
      suggestionId: params.suggestion.id,
      receiptId: receipt.id,
      hydrateSessionSnapshot: params.hydrateSessionSnapshot,
      refreshCheckpointOnly: params.refreshCheckpointOnly
    });
  }
  await params.refreshCheckpointOnly(options.activeSessionId);
}

export async function pollSkillInstallReceipt(
  options: CreateChatSessionActionsOptions,
  params: PollSkillInstallReceiptOptions
): Promise<void> {
  const attempt = params.attempt ?? 0;
  if (attempt >= 40) {
    return;
  }

  try {
    const receipt = await getRemoteSkillInstallReceipt(params.receiptId);
    updateSkillSuggestionInstallState(options, params.sessionId, params.suggestionId, {
      receiptId: receipt.id,
      status: mapReceiptStatus(receipt.status, receipt.phase),
      phase: receipt.phase,
      result: receipt.result,
      failureCode: receipt.failureCode,
      failureDetail: receipt.failureDetail,
      installedAt: receipt.installedAt
    });

    if (receipt.status === 'installed') {
      insertOptimisticControlMessage(options, params.sessionId, 'Skill 已安装完成，后续当前会话可直接复用。');
      await params.hydrateSessionSnapshot(params.sessionId, false);
      return;
    }

    if (receipt.status === 'failed' || receipt.status === 'rejected') {
      insertOptimisticControlMessage(
        options,
        params.sessionId,
        receipt.status === 'rejected'
          ? 'Skill 安装申请已被拒绝。'
          : `Skill 安装失败：${receipt.failureCode ?? '请检查安装日志'}`
      );
      await params.refreshCheckpointOnly(params.sessionId);
      return;
    }

    window.setTimeout(
      () => {
        void pollSkillInstallReceipt(options, {
          ...params,
          attempt: attempt + 1
        });
      },
      receipt.status === 'pending' ? 2000 : 1000
    );
  } catch (error) {
    if (attempt >= 5) {
      updateSkillSuggestionInstallState(options, params.sessionId, params.suggestionId, {
        receiptId: params.receiptId,
        status: 'failed',
        failureCode: error instanceof Error ? error.message : 'receipt_poll_failed'
      });
      return;
    }
    window.setTimeout(() => {
      void pollSkillInstallReceipt(options, {
        ...params,
        attempt: attempt + 1
      });
    }, 1200);
  }
}

export function syncCheckpointOnly(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  nextCheckpoint: ChatCheckpointRecord
) {
  let mergedCheckpoint = nextCheckpoint;
  options.setCheckpoint(current => {
    mergedCheckpoint = mergeCheckpointForDetailRefresh(current, nextCheckpoint);
    return mergedCheckpoint;
  });
  options.setMessages(current =>
    syncCheckpointMessages(
      current.filter(message => message.sessionId === sessionId),
      mergedCheckpoint,
      sessionId
    )
  );
  options.setSessions(current => syncSessionFromCheckpoint(current, mergedCheckpoint));
  return mergedCheckpoint;
}
