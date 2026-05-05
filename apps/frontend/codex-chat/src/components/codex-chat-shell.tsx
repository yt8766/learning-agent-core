import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  RadarChartOutlined
} from '@ant-design/icons';
import { Bubble, Prompts, Sender, Welcome, XProvider } from '@ant-design/x';
import { Button, ConfigProvider, Dropdown, Input, Modal } from 'antd';
import type { MenuProps } from 'antd';

import { chatApi } from '@/api/chat-api';
import { AssistantMessage } from '@/components/assistant-message';
import { isStreamTerminalEvent, syncEvent } from '../runtime/codex-chat-events';
import { toUiMessage, type UiMessage } from '../runtime/codex-chat-message';
import { fallbackTitleFromMessage, sanitizeGeneratedTitle, toConversationLabel } from '../runtime/codex-chat-title';
import type { ChatEventRecord, ChatSessionRecord, CodexChatMessage } from '@/types/chat';

const approvePattern = /^(执行|继续|同意|确认|批准|可以|好的|好|approve|yes|ok)\b/i;
const rejectPattern = /^(取消|停止|拒绝|不要|不用|abort|reject|cancel|no)\b/i;

function streamUrl(sessionId: string) {
  return `/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`;
}

export function CodexChatShell() {
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

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
    streamRef.current?.close();
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

    const stream = new EventSource(streamUrl(activeSessionId), { withCredentials: true });
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
      stream.close();
    };
  }, [activeSessionId]);

  const maybeGenerateSessionTitle = async (sessionId: string) => {
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
  };

  const createConversation = async () => {
    const session = await chatApi.createSession('新对话');
    setSessions(current => [session, ...current]);
    setActiveSessionId(session.id);
    return session;
  };

  const deleteConversation = async (sessionId: string) => {
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
  };

  const openRenameDialog = (session: ChatSessionRecord) => {
    setRenameTarget(session);
    setRenameValue(toConversationLabel(session));
  };

  const renameConversation = async () => {
    const session = renameTarget;
    const nextTitle = renameValue.trim();

    if (!session || !nextTitle || nextTitle === session.title) {
      setRenameTarget(null);
      return;
    }

    const next = await chatApi.updateSession(session.id, nextTitle);
    setSessions(current => current.map(item => (item.id === next.id ? next : item)));
    setRenameTarget(null);
  };

  const confirmDeleteConversation = (session: ChatSessionRecord) => {
    Modal.confirm({
      title: '删除这个会话？',
      content: `“${toConversationLabel(session)}” 删除后不会在左侧列表中保留。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => deleteConversation(session.id)
    });
  };

  const sendMessage = async (content: string) => {
    const message = content.trim();
    if (!message || isRequesting) {
      return;
    }

    const session = activeSessionId
      ? sessions.find(item => item.id === activeSessionId)
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
      const pendingApproval = (messageMap[session.id] ?? []).findLast(
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
  };

  const conversationMenu = (session: ChatSessionRecord): MenuProps['items'] => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        openRenameDialog(session);
      }
    },
    {
      key: 'delete',
      danger: true,
      icon: <DeleteOutlined />,
      label: '删除',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        confirmDeleteConversation(session);
      }
    }
  ];

  const bubbleItems = activeMessages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: message,
    loading: status === 'loading',
    classNames: {
      content: message.role === 'user' ? 'codex-user-bubble' : 'codex-assistant-bubble'
    }
  }));

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 10,
          colorPrimary: '#1677ff',
          fontFamily: '"Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
        }
      }}
    >
      <XProvider>
        <main className="codex-shell">
          <aside className="codex-sidebar">
            <div className="codex-brand">
              <span className="codex-brand-mark">C</span>
              <div>
                <strong>Codex Chat</strong>
                <small>clear agent thinking</small>
              </div>
            </div>

            <Button className="codex-new-chat" icon={<PlusOutlined />} onClick={() => void createConversation()}>
              新建对话
            </Button>

            <nav className="codex-conversations" aria-label="会话列表">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`codex-session-item${activeSessionId === session.id ? ' codex-session-item-active' : ''}`}
                >
                  <button type="button" className="codex-session-select" onClick={() => setActiveSessionId(session.id)}>
                    <span className="codex-session-title">{toConversationLabel(session)}</span>
                  </button>
                  <Dropdown
                    menu={{ items: conversationMenu(session) }}
                    placement="bottomRight"
                    trigger={['click']}
                    overlayClassName="codex-session-menu"
                  >
                    <button
                      type="button"
                      className="codex-session-more"
                      aria-label={`${toConversationLabel(session)} 更多操作`}
                      onClick={event => event.stopPropagation()}
                      onKeyDown={event => event.stopPropagation()}
                    >
                      <MoreOutlined />
                    </button>
                  </Dropdown>
                </div>
              ))}
            </nav>
          </aside>

          <section className="codex-main">
            <header className="codex-topbar">
              <div>
                <span className="codex-kicker">
                  <RadarChartOutlined /> Agent session stream
                </span>
                <h1>更安静、更清晰的 AI 对话。</h1>
              </div>
              <div className="codex-status-pill">
                <ApiOutlined />
                /api/chat/stream
              </div>
            </header>

            <div className="codex-thread">
              {activeMessages.length === 0 ? (
                <div className="codex-welcome">
                  <div className="codex-hero-mark" aria-hidden="true">
                    <span />
                  </div>
                  <Welcome title="我是 Codex Chat，很高兴见到你。" />
                  <Prompts
                    className="codex-prompts"
                    items={[
                      { key: 'design', label: '设计一个更清晰的 Agent 对话工作台' },
                      { key: 'debug', label: '分析一个前后端 SSE 流式问题' },
                      { key: 'plan', label: '把复杂需求拆成可执行计划' },
                      { key: 'review', label: '帮我审查一段产品方案' }
                    ]}
                    onItemClick={(info: { data: { label?: ReactNode } }) => void sendMessage(String(info.data.label))}
                  />
                </div>
              ) : (
                <Bubble.List
                  className="codex-bubble-list"
                  role={{
                    user: {
                      placement: 'end',
                      contentRender: (message: CodexChatMessage) => <span>{message.content}</span>
                    },
                    assistant: {
                      placement: 'start',
                      contentRender: (message: CodexChatMessage, info: { status?: string }) => (
                        <AssistantMessage
                          message={message}
                          streaming={info?.status === 'loading' || info?.status === 'updating'}
                        />
                      )
                    },
                    system: {
                      placement: 'start',
                      contentRender: (message: CodexChatMessage) => <span>{message.content}</span>
                    }
                  }}
                  items={bubbleItems}
                />
              )}
            </div>

            <footer className="codex-composer">
              {streamError ? <p className="codex-stream-error">{streamError}</p> : null}
              <Sender
                className="codex-sender"
                loading={isRequesting}
                onCancel={() => {
                  streamRef.current?.close();
                  setIsRequesting(false);
                }}
                onSubmit={content => void sendMessage(content)}
                placeholder="给 Codex 一个任务，按 Enter 发送"
                submitType="enter"
              />
            </footer>
          </section>
          <Modal
            title="重命名会话"
            open={Boolean(renameTarget)}
            okText="保存"
            cancelText="取消"
            onCancel={() => setRenameTarget(null)}
            onOk={() => void renameConversation()}
          >
            <Input
              autoFocus
              maxLength={32}
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onPressEnter={() => void renameConversation()}
              placeholder="输入新的会话名"
            />
          </Modal>
        </main>
      </XProvider>
    </ConfigProvider>
  );
}
