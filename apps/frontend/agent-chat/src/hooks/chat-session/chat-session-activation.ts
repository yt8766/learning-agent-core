import type { ChatMessageRecord } from '@/types/chat';

export interface ChatSessionActivationPlan {
  shouldSelectSession: boolean;
  shouldRefreshDetail: boolean;
  shouldOpenStreamImmediately: boolean;
}

interface ActivateChatSessionOptions {
  activeSessionId: string;
  pendingInitialSessionId?: string;
  pendingInitialMessageContent?: string;
  isDisposed: () => boolean;
  plan: ChatSessionActivationPlan;
  selectSession: (sessionId: string) => Promise<unknown>;
  hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) => Promise<{ status?: string } | undefined>;
  createSessionStream: (sessionId: string) => EventSource;
  bindStream: (stream: EventSource, sessionId: string) => void;
  startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void;
  stopSessionPolling: (sessionId?: string) => void;
  clearStreamReconnectSession: () => void;
  insertPendingUserMessage: (sessionId: string, content: string) => void;
  appendMessage: (sessionId: string, content: string) => Promise<ChatMessageRecord>;
  clearPendingInitialMessage: () => void;
  clearPendingUser: (sessionId: string) => void;
  mergeOrAppendMessage: (messages: ChatMessageRecord[], nextMessage: ChatMessageRecord) => ChatMessageRecord[];
  setMessages: (next: (current: ChatMessageRecord[]) => ChatMessageRecord[]) => void;
  markSessionStatus: (sessionId: string, status: 'running' | 'idle') => void;
}

export async function activateChatSession(options: ActivateChatSessionOptions) {
  const {
    activeSessionId,
    pendingInitialSessionId,
    pendingInitialMessageContent,
    isDisposed,
    plan,
    selectSession,
    hydrateSessionSnapshot,
    createSessionStream,
    bindStream,
    startSessionPolling,
    stopSessionPolling,
    clearStreamReconnectSession,
    insertPendingUserMessage,
    appendMessage,
    clearPendingInitialMessage,
    clearPendingUser,
    mergeOrAppendMessage,
    setMessages,
    markSessionStatus
  } = options;

  if (plan.shouldOpenStreamImmediately) {
    clearStreamReconnectSession();
    startSessionPolling(activeSessionId, 'checkpoint');
    const stream = createSessionStream(activeSessionId);
    bindStream(stream, activeSessionId);
    return { stream };
  }

  let detail: Awaited<ReturnType<typeof hydrateSessionSnapshot>>;
  if (plan.shouldSelectSession) {
    await selectSession(activeSessionId);
    if (isDisposed()) {
      return;
    }
  }
  if (plan.shouldRefreshDetail) {
    detail = await hydrateSessionSnapshot(activeSessionId, true);
  }
  if (isDisposed()) {
    return;
  }

  const hasPendingInitialMessage = pendingInitialSessionId === activeSessionId;
  const shouldOpenStream = hasPendingInitialMessage || detail?.status === 'running';
  if (!shouldOpenStream) {
    stopSessionPolling(activeSessionId);
    return;
  }

  startSessionPolling(activeSessionId, 'checkpoint');
  const stream = createSessionStream(activeSessionId);
  bindStream(stream, activeSessionId);

  if (hasPendingInitialMessage && pendingInitialMessageContent) {
    clearPendingInitialMessage();
    insertPendingUserMessage(activeSessionId, pendingInitialMessageContent);
    const nextUserMessage = await appendMessage(activeSessionId, pendingInitialMessageContent);
    if (isDisposed()) {
      return { stream };
    }
    clearPendingUser(activeSessionId);
    setMessages(current => mergeOrAppendMessage(current, nextUserMessage));
    markSessionStatus(activeSessionId, 'running');
  }

  return { stream };
}
