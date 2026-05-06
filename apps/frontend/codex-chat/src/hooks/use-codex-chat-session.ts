import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { chatApi } from '../api/chat-api';
import { isStreamTerminalEvent, syncEvent } from '../runtime/codex-chat-events';
import { toUiMessage, type UiMessage } from '../runtime/codex-chat-message';
import { buildCodexChatStreamUrl, closeEventSource } from '../runtime/codex-chat-stream';
import { fallbackTitleFromMessage, sanitizeGeneratedTitle, toConversationLabel } from '../runtime/codex-chat-title';
import type { ChatEventRecord, ChatSessionRecord } from '../types/chat';

const approvePattern = /^(执行|继续|同意|确认|批准|可以|好的|好|approve|yes|ok)\b/i;
const rejectPattern = /^(取消|停止|拒绝|不要|不用|abort|reject|cancel|no)\b/i;

export interface CodexChatSessionState {
  activeMessages: UiMessage[];
  activeSessionId: string;
  cancelStreamRequest: () => void;
  createConversation: () => Promise<ChatSessionRecord>;
  deleteConversation: (sessionId: string) => Promise<void>;
  isRequesting: boolean;
  openRenameDialog: (session: ChatSessionRecord) => void;
  renameConversation: () => Promise<void>;
  renameTarget: ChatSessionRecord | null;
  renameValue: string;
  sendMessage: (content: string) => Promise<void>;
  sessions: ChatSessionRecord[];
  setActiveSessionId: (sessionId: string) => void;
  setRenameTarget: (session: ChatSessionRecord | null) => void;
  setRenameValue: (value: string) => void;
  streamError: string;
}

export function useCodexChatSession(): CodexChatSessionState {
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messageMap, setMessageMap] = useState<Record<string, UiMessage[]>>({});
  const [isRequesting, setIsRequesting] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [renameTarget, setRenameTarget] = useState<ChatSessionRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const streamRef = useRef<EventSource | null>(null);
  const activeSessionRef = useRef('');
  const sessionsRef = useRef<ChatSessionRecord[]>([]);
  const messageMapRef = useRef<Record<string, UiMessage[]>>({});
  const titleRequestsRef = useRef(new Set<string>());

  const activeMessages = messageMap[activeSessionId] ?? [];

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    messageMapRef.current = messageMap;
  }, [messageMap]);

  useEffect(() => {
    let disposed = false;

    void chatApi.listSessions().then(records => {
      if (disposed) {
        return;
      }
      setSessions(records);
      setActiveSessionId(records[0]?.id ?? '');
    });

    return () => {
      disposed = true;
    };
  }, []);

  const maybeGenerateSessionTitle = useCallback(async (sessionId: string) => {
    if (titleRequestsRef.current.has(sessionId)) {
      return;
    }

    const session = sessionsRef.current.find(item => item.id === sessionId);
    if (!session || session.titleSource === 'manual' || session.titleSource === 'generated') {
      return;
    }

    const currentTitle = toConversationLabel(session);
    if (currentTitle !== '新对话' && !currentTitle.startsWith('新对话')) {
      return;
    }

    const messages = messageMapRef.current[sessionId] ?? [];
    const firstUser = messages.find(item => item.message.role === 'user')?.message.content.trim();
    const assistant = messages.findLast(item => item.message.role === 'assistant' && item.message.content.trim());

    if (!firstUser || !assistant?.message.content.trim()) {
      return;
    }

    titleRequestsRef.current.add(sessionId);

    try {
      const rawTitle = await chatApi.generateTitle(firstUser, assistant.message.content);
      const title = sanitizeGeneratedTitle(rawTitle) || fallbackTitleFromMessage(firstUser);
      const updated = await chatApi.updateGeneratedSessionTitle(sessionId, title);
      setSessions(current => current.map(item => (item.id === updated.id ? updated : item)));
    } catch {
      const title = fallbackTitleFromMessage(firstUser);
      try {
        const updated = await chatApi.updateGeneratedSessionTitle(sessionId, title);
        setSessions(current => current.map(item => (item.id === updated.id ? updated : item)));
      } catch {
        titleRequestsRef.current.delete(sessionId);
      }
    }
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
    closeEventSource(streamRef.current);
    streamRef.current = null;

    if (!activeSessionId) {
      return undefined;
    }

    let disposed = false;

    void chatApi.listMessages(activeSessionId).then(records => {
      if (disposed) {
        return;
      }
      setMessageMap(current => ({
        ...current,
        [activeSessionId]: records.map(toUiMessage)
      }));
    });

    const stream = new EventSource(buildCodexChatStreamUrl(activeSessionId), { withCredentials: true });
    streamRef.current = stream;

    stream.onopen = () => {
      if (!disposed) {
        setStreamError('');
      }
    };

    stream.onmessage = (raw: MessageEvent<string>) => {
      if (disposed) {
        return;
      }

      try {
        const event = JSON.parse(raw.data) as ChatEventRecord;
        setMessageMap(current => ({
          ...current,
          [event.sessionId]: syncEvent(current[event.sessionId] ?? [], event)
        }));

        if (isStreamTerminalEvent(event.type)) {
          setIsRequesting(false);
          window.setTimeout(() => void maybeGenerateSessionTitle(event.sessionId), 200);
        }
      } catch {
        setStreamError('流式消息解析失败，请检查 /api/chat/stream 返回格式。');
      }
    };

    stream.onerror = () => {
      if (!disposed) {
        setStreamError('聊天流已断开，请确认后端 /api/chat/stream 可达。');
      }
    };

    return () => {
      disposed = true;
      closeEventSource(stream);
    };
  }, [activeSessionId, maybeGenerateSessionTitle]);

  const createConversation = useCallback(async () => {
    const session = await chatApi.createSession('新对话');
    setSessions(current => [session, ...current]);
    setActiveSessionId(session.id);
    return session;
  }, []);

  const deleteConversation = useCallback(async (sessionId: string) => {
    await chatApi.deleteSession(sessionId);
    let nextActiveSessionId = '';
    setSessions(current => {
      const next = current.filter(session => session.id !== sessionId);
      nextActiveSessionId = next[0]?.id ?? '';
      return next;
    });
    setMessageMap(current => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });

    if (activeSessionRef.current === sessionId) {
      setActiveSessionId(nextActiveSessionId);
    }
  }, []);

  const openRenameDialog = useCallback((session: ChatSessionRecord) => {
    setRenameTarget(session);
    setRenameValue(toConversationLabel(session));
  }, []);

  const renameConversation = useCallback(async () => {
    const session = renameTarget;
    const nextTitle = renameValue.trim();

    if (!session || !nextTitle || nextTitle === session.title) {
      setRenameTarget(null);
      return;
    }

    const next = await chatApi.updateSession(session.id, nextTitle);
    setSessions(current => current.map(item => (item.id === next.id ? next : item)));
    setRenameTarget(null);
  }, [renameTarget, renameValue]);

  const sendMessage = useCallback(
    async (content: string) => {
      const message = content.trim();
      if (!message || isRequesting) {
        return;
      }

      const session = activeSessionId
        ? sessionsRef.current.find(item => item.id === activeSessionId)
        : await chatApi.createSession('新对话');
      if (!session) {
        return;
      }

      if (!activeSessionId) {
        setSessions(current => [session, ...current]);
        setActiveSessionId(session.id);
      }

      const userMessage: UiMessage = {
        id: `local-${Date.now()}`,
        status: 'local',
        message: { role: 'user', content: message }
      };
      const assistantDraft: UiMessage = {
        id: `assistant-${Date.now()}`,
        status: 'loading',
        message: {
          role: 'assistant',
          content: '',
          reasoning: '正在连接会话流、读取上下文并等待模型返回。',
          thinkingDurationMs: Date.now(),
          steps: [{ id: 'stream-open', title: '等待 /api/chat/stream', status: 'running' }]
        }
      };

      setMessageMap(current => ({
        ...current,
        [session.id]: [...(current[session.id] ?? []), userMessage, assistantDraft]
      }));
      setIsRequesting(true);
      setStreamError('');

      try {
        const pendingApproval = (messageMapRef.current[session.id] ?? []).findLast(
          item => item.message.role === 'assistant' && item.message.approvalPending
        );

        if (pendingApproval && approvePattern.test(message)) {
          await chatApi.approveSession(session.id, message);
          return;
        }

        if (pendingApproval && rejectPattern.test(message)) {
          await chatApi.rejectSession(session.id, message);
          return;
        }

        await chatApi.postMessage(session.id, message);
      } catch {
        setIsRequesting(false);
        setMessageMap(current => ({
          ...current,
          [session.id]: (current[session.id] ?? []).map(item =>
            item.id === assistantDraft.id
              ? {
                  ...item,
                  status: 'error',
                  message: {
                    ...item.message,
                    content: '提交消息失败，请确认后端 /api/chat/messages 可达。',
                    steps: [{ id: 'post-message-error', title: 'POST /api/chat/messages 失败', status: 'failed' }]
                  }
                }
              : item
          )
        }));
      }
    },
    [activeSessionId, isRequesting]
  );

  const cancelStreamRequest = useCallback(() => {
    closeEventSource(streamRef.current);
    setIsRequesting(false);
  }, []);

  return useMemo(
    () => ({
      activeMessages,
      activeSessionId,
      cancelStreamRequest,
      createConversation,
      deleteConversation,
      isRequesting,
      openRenameDialog,
      renameConversation,
      renameTarget,
      renameValue,
      sendMessage,
      sessions,
      setActiveSessionId,
      setRenameTarget,
      setRenameValue,
      streamError
    }),
    [
      activeMessages,
      activeSessionId,
      cancelStreamRequest,
      createConversation,
      deleteConversation,
      isRequesting,
      openRenameDialog,
      renameConversation,
      renameTarget,
      renameValue,
      sendMessage,
      sessions,
      streamError
    ]
  );
}
