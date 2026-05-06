import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type MessageInfo, useXChat, useXConversations } from '@ant-design/x-sdk';

import { createAgentChatActions } from '@/chat-runtime/agent-chat-actions';
import {
  buildAgentChatConversationKey,
  parseAgentChatConversationKey,
  toAgentChatConversationData,
  type AgentChatConversationData
} from '@/chat-runtime/agent-chat-conversations';
import type { AgentChatProviderInput } from '@/chat-runtime/agent-chat-provider';
import {
  createAgentChatSessionProvider,
  type AgentChatSessionProviderChunk
} from '@/chat-runtime/agent-chat-session-provider';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { normalizeOutboundMessage } from './chat-session/chat-session-action-utils';
import type { OutboundChatMessage } from './chat-session/chat-session-actions.types';
import {
  formatSessionTime,
  getMessageRoleLabel,
  getSessionStatusLabel,
  STARTER_PROMPT
} from './chat-session/chat-session-helpers';
import {
  useChatSessionActivationEffect,
  useChatSessionAutoSelectionEffect,
  useChatSessionBootstrapEffect
} from './chat-session/use-chat-session-runtime-effects';
import {
  createAssistantMessageRecord,
  toChatSessionRecord,
  toXChatMessageInfos,
  upsertSession,
  useAgentToolGovernanceProjection
} from './chat-session/use-chat-session-runtime-adapters';
import { createChatSessionActions } from './chat-session/use-chat-session-actions';
import { useChatSessionStreamManager } from './chat-session/use-chat-session-stream-manager';
import { debugAgentChat, summarizeDebugMessages, summarizeDebugSessions } from '@/utils/agent-chat-debug';

export { formatSessionTime, getMessageRoleLabel, getSessionStatusLabel };

export function useChatSession() {
  const queryClient = useQueryClient();
  const bootstrapState = useRef({
    finished: false
  });
  const [sessionsShadow, setSessionsShadow] = useState<ChatSessionRecord[]>([]);
  const [activeSessionIdShadow, setActiveSessionIdShadow] = useState('');
  const [messagesShadow] = useState<ChatMessageRecord[]>([]);
  const [events, setEvents] = useState<ChatEventRecord[]>([]);
  const [checkpoint, setCheckpoint] = useState<ChatCheckpointRecord | undefined>(undefined);
  const [draft, setDraft] = useState(STARTER_PROMPT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [streamingCompleted, setStreamingCompleted] = useState(false);
  const [streamReconnectNonce, setStreamReconnectNonce] = useState(0);

  const runtimeActions = useMemo(() => createAgentChatActions(), []);
  const conversationStore = useXConversations({
    defaultConversations: sessionsShadow.map(toAgentChatConversationData),
    defaultActiveConversationKey: activeSessionIdShadow ? buildAgentChatConversationKey(activeSessionIdShadow) : ''
  });

  void messagesShadow;

  useEffect(() => {
    conversationStore.setConversations(sessionsShadow.map(toAgentChatConversationData));
  }, [conversationStore.setConversations, sessionsShadow]);

  useEffect(() => {
    conversationStore.setActiveConversationKey(
      activeSessionIdShadow ? buildAgentChatConversationKey(activeSessionIdShadow) : ''
    );
  }, [activeSessionIdShadow, conversationStore.setActiveConversationKey]);

  const sessions = useMemo(
    () => (conversationStore.conversations as AgentChatConversationData[]).map(toChatSessionRecord),
    [conversationStore.conversations]
  );
  const activeSessionId = parseAgentChatConversationKey(conversationStore.activeConversationKey) ?? '';
  const activeSession = useMemo(
    () => sessions.find(session => session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const activeConversationKey = activeSessionId ? buildAgentChatConversationKey(activeSessionId) : '';

  const checkpointRef = useRef<ChatCheckpointRecord | undefined>(undefined);
  const messageInfoRef = useRef<MessageInfo<ChatMessageRecord>[]>([]);
  const setXMessagesRef = useRef<
    | ((
        messages:
          | MessageInfo<ChatMessageRecord>[]
          | ((current: MessageInfo<ChatMessageRecord>[]) => MessageInfo<ChatMessageRecord>[])
      ) => boolean)
    | null
  >(null);
  const isXRequestingRef = useRef(false);

  const setSessionsCompat: Dispatch<SetStateAction<ChatSessionRecord[]>> = next => {
    const resolveNext = typeof next === 'function' ? next : () => next;
    setSessionsShadow(current => {
      const nextSessions = resolveNext(current);
      debugAgentChat('setSessionsCompat', {
        current: summarizeDebugSessions(current),
        next: summarizeDebugSessions(nextSessions)
      });
      return nextSessions;
    });
  };

  const setActiveSessionIdCompat: Dispatch<SetStateAction<string>> = next => {
    const resolveNext = typeof next === 'function' ? next : () => next;
    setActiveSessionIdShadow(current => {
      const nextSessionId = resolveNext(current);
      debugAgentChat('setActiveSessionIdCompat', {
        current,
        next: nextSessionId
      });
      return nextSessionId;
    });
  };

  const setMessagesCompat: Dispatch<SetStateAction<ChatMessageRecord[]>> = next => {
    const resolveNext = typeof next === 'function' ? next : () => next;
    setXMessagesRef.current?.(currentInfos => {
      const nextMessages = resolveNext(currentInfos.map(info => info.message));
      debugAgentChat('setMessagesCompat.xChat', {
        current: summarizeDebugMessages(currentInfos.map(info => info.message)),
        next: summarizeDebugMessages(nextMessages)
      });
      return toXChatMessageInfos(nextMessages, currentInfos);
    });
  };

  const streamManager = useChatSessionStreamManager({
    setCheckpoint,
    setEvents,
    setMessages: setMessagesCompat,
    setSessions: setSessionsCompat,
    setError,
    checkpointRef,
    onStreamComplete: () => setStreamingCompleted(true)
  });

  const streamReconnectSessionRef = useRef('');
  const pendingInitialMessage = useRef<{ sessionId: string; content: string } | null>(null);
  const pendingUserIds = useRef<Record<string, string>>({});
  const pendingAssistantIds = useRef<Record<string, string>>({});
  const optimisticThinkingStartedAt = useRef<Record<string, string>>({});
  const feedbackRequestVersions = useRef<Record<string, number>>({});
  const compatFacadeRef = useRef({
    setActiveSessionIdCompat,
    setMessagesCompat,
    setSessionsCompat,
    streamManager
  });
  compatFacadeRef.current = {
    setActiveSessionIdCompat,
    setMessagesCompat,
    setSessionsCompat,
    streamManager
  };

  const sessionProvider = useMemo(
    () =>
      createAgentChatSessionProvider({
        appendMessage: runtimeActions.appendMessage,
        ensureSession: runtimeActions.ensureSession,
        createSessionStream: runtimeActions.createSessionStream,
        bindStream: (stream, sessionId, handlers) => {
          const streamState = {
            intentionalClose: false,
            idleTimer: null as ReturnType<typeof setTimeout> | null
          };
          compatFacadeRef.current.streamManager.bindStream(
            stream,
            sessionId,
            () => streamState.intentionalClose,
            streamState,
            {
              onDone: handlers.onDone,
              onError: handlers.onError,
              onEvent: handlers.onEvent,
              syncAssistantMessages: true,
              syncUserMessages: true
            }
          );
        },
        onSessionResolved: session => {
          compatFacadeRef.current.setSessionsCompat(current => upsertSession(current, session));
          compatFacadeRef.current.setActiveSessionIdCompat(session.id);
          compatFacadeRef.current.setMessagesCompat(current =>
            current.map(message => (message.sessionId ? message : { ...message, sessionId: session.id }))
          );
        }
      }),
    [runtimeActions]
  );

  const xChat = useXChat<ChatMessageRecord, ChatMessageRecord, AgentChatProviderInput, AgentChatSessionProviderChunk>({
    conversationKey: activeConversationKey,
    defaultMessages: async ({ conversationKey }: { conversationKey?: string }) => {
      const sessionId = parseAgentChatConversationKey(String(conversationKey ?? ''));
      if (!sessionId) {
        return [];
      }
      const nextMessages = await runtimeActions.listMessages(sessionId);
      return nextMessages.map(message => ({
        id: message.id,
        message,
        status: 'success' as const
      }));
    },
    provider: sessionProvider,
    requestPlaceholder: requestParams => {
      const sessionId = parseAgentChatConversationKey(String(requestParams.conversationKey ?? '')) ?? activeSessionId;
      return createAssistantMessageRecord(sessionId, `assistant-loading-${Date.now()}`, '');
    },
    requestFallback: (requestParams, info) => {
      const sessionId = parseAgentChatConversationKey(String(requestParams.conversationKey ?? '')) ?? activeSessionId;
      return createAssistantMessageRecord(
        sessionId,
        typeof info.messageInfo.message?.id === 'string'
          ? info.messageInfo.message.id
          : `assistant-error-${Date.now()}`,
        info.error.message
      );
    }
  });
  setXMessagesRef.current = xChat.setMessages;
  messageInfoRef.current = xChat.messages;
  isXRequestingRef.current = xChat.isRequesting;

  const messages = useMemo(() => xChat.messages.map(info => info.message), [xChat.messages]);
  const activeTaskId = activeSession?.currentTaskId ?? checkpoint?.taskId;
  const pendingApprovals = checkpoint?.pendingApprovals ?? [];
  const hasMessages = messages.length > 0;
  const agentToolGovernanceProjection = useAgentToolGovernanceProjection(activeSessionId, activeTaskId);

  const chatActions = createChatSessionActions({
    activeSessionId,
    activeSession,
    messages,
    checkpoint,
    draft,
    setDraft,
    setError,
    setLoading,
    setSessions: setSessionsCompat,
    setMessages: setMessagesCompat,
    setEvents,
    setCheckpoint,
    setActiveSessionId: setActiveSessionIdCompat,
    requestStreamReconnect: (sessionId: string) => {
      streamReconnectSessionRef.current = sessionId;
      setStreamReconnectNonce(current => current + 1);
    },
    pendingInitialMessage,
    pendingUserIds,
    pendingAssistantIds,
    optimisticThinkingStartedAt,
    feedbackRequestVersions
  });

  const hydrateSnapshotRef = useRef(chatActions.hydrateSessionSnapshot);
  hydrateSnapshotRef.current = chatActions.hydrateSessionSnapshot;
  streamManager.setChatActions(chatActions);
  const chatActionsRef = useRef(chatActions);
  chatActionsRef.current = chatActions;
  const streamManagerRef = useRef(streamManager);
  streamManagerRef.current = streamManager;
  const refreshSessionsRef = useRef(chatActions.refreshSessions);
  refreshSessionsRef.current = chatActions.refreshSessions;

  useEffect(() => {
    checkpointRef.current = checkpoint;
  }, [checkpoint]);

  useEffect(() => {
    if (xChat.isRequesting) {
      setStreamingCompleted(false);
    }
  }, [xChat.isRequesting]);

  useEffect(() => {
    setStreamingCompleted(false);
  }, [streamReconnectNonce, activeSessionId]);

  useChatSessionBootstrapEffect({
    bootstrapStateRef: bootstrapState,
    refreshSessionsRef
  });

  useChatSessionAutoSelectionEffect({
    activeSessionId,
    bootstrapStateRef: bootstrapState,
    sessions,
    setActiveSessionId: setActiveSessionIdCompat
  });

  useChatSessionActivationEffect({
    activeSessionId,
    chatActionsRef,
    isXRequesting: xChat.isRequesting,
    pendingInitialMessageRef: pendingInitialMessage,
    queryClient,
    setError,
    setMessages: setMessagesCompat,
    streamManagerRef,
    streamReconnectNonce,
    streamReconnectSessionRef
  });

  const sendMessage = async (nextMessage?: string | OutboundChatMessage) => {
    const resolvedMessage = normalizeOutboundMessage(nextMessage ?? draft);
    const content = resolvedMessage.payload.trim();
    if (!content) {
      return;
    }

    setDraft(STARTER_PROMPT);
    setError('');
    setStreamingCompleted(false);
    xChat.onRequest({
      conversationKey: activeConversationKey,
      messages: [{ role: 'user', content, modelId: resolvedMessage.modelId }]
    });
  };

  const regenerateMessage = async (message: ChatMessageRecord) => {
    if (message.role !== 'assistant') {
      return;
    }

    const lastAssistantMessage = [...messages].reverse().find(candidate => candidate.role === 'assistant');
    if (lastAssistantMessage?.id !== message.id) {
      return;
    }

    const messageIndex = messages.findIndex(candidate => candidate.id === message.id);
    const priorUserMessage = [...messages.slice(0, messageIndex)]
      .reverse()
      .find(candidate => candidate.role === 'user');
    if (!priorUserMessage) {
      return;
    }

    await sendMessage(priorUserMessage.content);
  };

  const cancelActiveSession = async (reason?: string) => {
    xChat.abort();
    await chatActions.cancelActiveSession(reason);
  };

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    events,
    checkpoint,
    agentToolGovernanceProjection,
    draft,
    error,
    loading,
    showRightPanel,
    pendingApprovals,
    hasMessages,
    streamingCompleted,
    isRequesting: xChat.isRequesting,
    setDraft,
    setActiveSessionId: setActiveSessionIdCompat,
    setShowRightPanel,
    refreshSessionDetail: chatActions.refreshSessionDetail,
    createNewSession: chatActions.createNewSession,
    sendMessage,
    regenerateMessage,
    submitMessageFeedback: chatActions.submitMessageFeedback,
    updateApproval: chatActions.updateApproval,
    updatePlanInterrupt: chatActions.updatePlanInterrupt,
    allowApprovalAndApprove: chatActions.allowApprovalAndApprove,
    installSuggestedSkill: chatActions.installSuggestedSkill,
    submitLearningConfirmation: chatActions.submitLearningConfirmation,
    recoverActiveSession: chatActions.recoverActiveSession,
    cancelActiveSession,
    renameSessionById: chatActions.renameSessionById,
    deleteSessionById: chatActions.deleteSessionById,
    deleteActiveSession: chatActions.deleteActiveSession
  };
}
