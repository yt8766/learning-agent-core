import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { createSessionStream, appendMessage } from '@/api/chat-api';
import { fetchChatSession } from '@/api/chat-query';
import type { ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { activateChatSession, buildSessionActivationPlan, mergeOrAppendMessage } from './chat-session-helpers';

interface BootstrapStateRefValue {
  finished: boolean;
}

interface ActivationActionsRefValue {
  clearPendingSessionMessages: (sessionId: string) => void;
  clearPendingUser: (sessionId: string) => void;
  createNewSession: () => Promise<unknown>;
  hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) => Promise<{ status?: string } | undefined>;
  insertPendingUserMessage: (sessionId: string, content: string) => void;
  markSessionStatus: (sessionId: string, status: 'running' | 'idle') => void;
  refreshSessions: () => Promise<unknown>;
}

interface StreamManagerRefValue {
  bindStream: (
    stream: EventSource,
    sessionId: string,
    isDisposed: () => boolean,
    streamState: {
      intentionalClose: boolean;
      idleTimer: ReturnType<typeof setTimeout> | null;
    }
  ) => void;
  checkpointRefreshTimer: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void;
  stopSessionPolling: (sessionId?: string) => void;
}

export function useChatSessionBootstrapEffect(options: {
  bootstrapStateRef: MutableRefObject<BootstrapStateRefValue>;
  refreshSessionsRef: MutableRefObject<() => Promise<unknown>>;
}) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await options.refreshSessionsRef.current();
      if (!cancelled) {
        options.bootstrapStateRef.current.finished = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

export function useChatSessionAutoSelectionEffect(options: {
  activeSessionId: string;
  bootstrapStateRef: MutableRefObject<BootstrapStateRefValue>;
  sessions: ChatSessionRecord[];
  setActiveSessionId: Dispatch<SetStateAction<string>>;
}) {
  useEffect(() => {
    if (!options.bootstrapStateRef.current.finished) {
      return;
    }

    if (!options.sessions.length) {
      // 无历史会话时不自动 createSession，避免刷新/列表失败时误建新会话；由用户点「新对话」或发首条消息创建
      return;
    }

    const activeExists = options.sessions.some(session => session.id === options.activeSessionId);
    if (activeExists) {
      return;
    }

    const latestSession = options.sessions
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    if (latestSession) {
      options.setActiveSessionId(latestSession.id);
    }
  }, [options.activeSessionId, options.sessions, options.setActiveSessionId]);
}

export function useChatSessionActivationEffect(options: {
  activeSessionId: string;
  chatActionsRef: MutableRefObject<ActivationActionsRefValue>;
  isXRequesting: boolean;
  pendingInitialMessageRef: MutableRefObject<{ sessionId: string; content: string } | null>;
  queryClient: QueryClient;
  setError: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<ChatMessageRecord[]>>;
  streamManagerRef: MutableRefObject<StreamManagerRefValue>;
  streamReconnectNonce: number;
  streamReconnectSessionRef: MutableRefObject<string>;
}) {
  useEffect(() => {
    if (!options.activeSessionId || options.isXRequesting) {
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
          activeSessionId: options.activeSessionId,
          pendingInitialSessionId: options.pendingInitialMessageRef.current?.sessionId,
          streamReconnectSessionId: options.streamReconnectSessionRef.current
        });
        const activation = await activateChatSession({
          activeSessionId: options.activeSessionId,
          pendingInitialSessionId: options.pendingInitialMessageRef.current?.sessionId,
          pendingInitialMessageContent: options.pendingInitialMessageRef.current?.content,
          isDisposed: () => disposed,
          plan,
          selectSession: sessionId => fetchChatSession(options.queryClient, sessionId),
          hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) =>
            options.chatActionsRef.current.hydrateSessionSnapshot(sessionId, forceRefresh),
          createSessionStream,
          bindStream: (nextStream, nextSessionId) =>
            options.streamManagerRef.current.bindStream(
              nextStream,
              nextSessionId,
              () => disposed || streamState.intentionalClose,
              streamState
            ),
          startSessionPolling: options.streamManagerRef.current.startSessionPolling,
          stopSessionPolling: options.streamManagerRef.current.stopSessionPolling,
          clearStreamReconnectSession: () => {
            options.streamReconnectSessionRef.current = '';
          },
          insertPendingUserMessage: options.chatActionsRef.current.insertPendingUserMessage,
          appendMessage,
          clearPendingInitialMessage: () => {
            options.pendingInitialMessageRef.current = null;
          },
          clearPendingUser: options.chatActionsRef.current.clearPendingUser,
          mergeOrAppendMessage,
          setMessages: options.setMessages,
          markSessionStatus: options.chatActionsRef.current.markSessionStatus
        });
        stream = activation?.stream;
      } catch (nextError) {
        if (!disposed) {
          options.chatActionsRef.current.clearPendingSessionMessages(options.activeSessionId);
          options.chatActionsRef.current.markSessionStatus(options.activeSessionId, 'idle');
          options.setError(nextError instanceof Error ? nextError.message : '激活会话失败');
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
      if (options.streamManagerRef.current.checkpointRefreshTimer.current) {
        clearTimeout(options.streamManagerRef.current.checkpointRefreshTimer.current);
        options.streamManagerRef.current.checkpointRefreshTimer.current = null;
      }
      options.streamManagerRef.current.stopSessionPolling(options.activeSessionId);
    };
  }, [options.activeSessionId, options.isXRequesting, options.queryClient, options.streamReconnectNonce]);
}
