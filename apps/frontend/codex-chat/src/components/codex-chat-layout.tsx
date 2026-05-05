import { useMemo } from 'react';
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

import { AssistantMessage } from './assistant-message';
import type { CodexChatSessionState } from '../hooks/use-codex-chat-session';
import { toConversationLabel } from '../runtime/codex-chat-title';
import type { ChatSessionRecord, CodexChatMessage } from '../types/chat';

interface CodexChatLayoutProps {
  chat: CodexChatSessionState;
}

export function CodexChatLayout({ chat }: CodexChatLayoutProps) {
  const bubbleItems = useMemo(
    () =>
      chat.activeMessages.map(({ id, message, status }) => ({
        key: id,
        role: message.role,
        content: message,
        loading: status === 'loading',
        classNames: {
          content: message.role === 'user' ? 'codex-user-bubble' : 'codex-assistant-bubble'
        }
      })),
    [chat.activeMessages]
  );

  const confirmDeleteConversation = (session: ChatSessionRecord) => {
    Modal.confirm({
      title: '删除这个会话？',
      content: `“${toConversationLabel(session)}” 删除后不会在左侧列表中保留。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => chat.deleteConversation(session.id)
    });
  };

  const conversationMenu = (session: ChatSessionRecord): MenuProps['items'] => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        chat.openRenameDialog(session);
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

            <Button className="codex-new-chat" icon={<PlusOutlined />} onClick={() => void chat.createConversation()}>
              新建对话
            </Button>

            <nav className="codex-conversations" aria-label="会话列表">
              {chat.sessions.map(session => (
                <div
                  key={session.id}
                  className={`codex-session-item${chat.activeSessionId === session.id ? ' codex-session-item-active' : ''}`}
                >
                  <button
                    type="button"
                    className="codex-session-select"
                    onClick={() => chat.setActiveSessionId(session.id)}
                  >
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
              {chat.activeMessages.length === 0 ? (
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
                    onItemClick={(info: { data: { label?: ReactNode } }) =>
                      void chat.sendMessage(String(info.data.label))
                    }
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
              {chat.streamError ? <p className="codex-stream-error">{chat.streamError}</p> : null}
              <Sender
                className="codex-sender"
                loading={chat.isRequesting}
                onCancel={chat.cancelStreamRequest}
                onSubmit={content => void chat.sendMessage(content)}
                placeholder="给 Codex 一个任务，按 Enter 发送"
                submitType="enter"
              />
            </footer>
          </section>
          <Modal
            title="重命名会话"
            open={Boolean(chat.renameTarget)}
            okText="保存"
            cancelText="取消"
            onCancel={() => chat.setRenameTarget(null)}
            onOk={() => void chat.renameConversation()}
          >
            <Input
              autoFocus
              maxLength={32}
              value={chat.renameValue}
              onChange={event => chat.setRenameValue(event.target.value)}
              onPressEnter={() => void chat.renameConversation()}
              placeholder="输入新的会话名"
            />
          </Modal>
        </main>
      </XProvider>
    </ConfigProvider>
  );
}
