import { cancelSession, deleteSession, recoverSession, updateSession } from '@/api/chat-api';
import type { ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import type { CreateChatSessionActionsOptions } from './chat-session-actions.types';
import {
  applyCancelledSessionState,
  applyRecoveredSessionState,
  clearPendingSessionMessages,
  insertOptimisticControlMessage,
  installSuggestedSkillAction
} from './chat-session-control-actions';
import type { RunLoadingFn } from './chat-session-action-utils';

interface LifecycleActionDeps {
  options: CreateChatSessionActionsOptions;
  runLoading: RunLoadingFn;
  refreshCheckpointOnly: (sessionId?: string) => Promise<unknown>;
  hydrateSessionSnapshot: (sessionId?: string, showLoading?: boolean) => Promise<unknown>;
}

export function createLifecycleActions({
  options,
  runLoading,
  refreshCheckpointOnly,
  hydrateSessionSnapshot
}: LifecycleActionDeps) {
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
    recoverActiveSession,
    cancelActiveSession,
    installSuggestedSkill,
    deleteSessionById,
    deleteActiveSession,
    renameSessionById
  };
}
