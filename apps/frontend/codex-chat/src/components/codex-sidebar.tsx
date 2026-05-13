import { Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';

import {
  ChevronUpIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PenSquareIcon,
  TrashIcon
} from './chatbot-icons';
import type { CodexChatSessionState } from '../hooks/use-codex-chat-session';
import { toConversationLabel } from '../runtime/codex-chat-title';
import type { ChatSessionRecord } from '../types/chat';

interface CodexSidebarProps {
  chat: CodexChatSessionState;
  collapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}

interface HistoryGroup {
  key: string;
  label: string;
  sessions: ChatSessionRecord[];
}

const historyLabels = [
  { key: 'today', label: 'TODAY' },
  { key: 'yesterday', label: 'YESTERDAY' },
  { key: 'last7Days', label: 'LAST 7 DAYS' },
  { key: 'last30Days', label: 'LAST 30 DAYS' },
  { key: 'older', label: 'OLDER' }
] as const;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenToday(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(date);

  return Math.floor((today.getTime() - day.getTime()) / 86_400_000);
}

function groupSessionsByCreatedAt(sessions: ChatSessionRecord[]): HistoryGroup[] {
  const groups: Record<(typeof historyLabels)[number]['key'], ChatSessionRecord[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: []
  };

  for (const session of sessions) {
    const ageInDays = daysBetweenToday(session.createdAt);

    if (ageInDays <= 0) {
      groups.today.push(session);
    } else if (ageInDays === 1) {
      groups.yesterday.push(session);
    } else if (ageInDays < 7) {
      groups.last7Days.push(session);
    } else if (ageInDays < 30) {
      groups.last30Days.push(session);
    } else {
      groups.older.push(session);
    }
  }

  return historyLabels
    .map(({ key, label }) => ({ key, label, sessions: groups[key] }))
    .filter(group => group.sessions.length > 0);
}

export function CodexSidebar({ chat, collapsed, onCloseMobile, onToggleCollapsed }: CodexSidebarProps) {
  const historyGroups = groupSessionsByCreatedAt(chat.sessions);

  const confirmDeleteConversation = (session: ChatSessionRecord) => {
    Modal.confirm({
      title: '删除这个对话？',
      content: `“${toConversationLabel(session)}” 删除后不会在历史列表中保留。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => chat.deleteConversation(session.id)
    });
  };

  const conversationMenu = (session: ChatSessionRecord): MenuProps['items'] => [
    {
      key: 'rename',
      label: '重命名',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        chat.openRenameDialog(session);
        onCloseMobile();
      }
    },
    {
      key: 'delete',
      danger: true,
      label: '删除',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        confirmDeleteConversation(session);
      }
    }
  ];

  const userMenu: MenuProps['items'] = [
    {
      key: 'settings',
      label: '账户设置',
      onClick: () =>
        Modal.info({
          title: '账户设置',
          content: '当前为访客模式，暂未接入账户设置页面。',
          okText: '知道了'
        })
    },
    {
      key: 'logout',
      label: '退出登录',
      onClick: () =>
        Modal.info({
          title: '退出登录',
          content: '当前为访客模式，没有可退出的登录会话。',
          okText: '知道了'
        })
    }
  ];

  const confirmDeleteAllConversations = () => {
    Modal.confirm({
      title: '删除全部对话？',
      content: '这会删除当前历史列表中的全部对话。',
      okText: '删除全部',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        for (const session of chat.sessions) {
          chat.deleteConversation(session.id);
        }
      }
    });
  };

  return (
    <>
      <button type="button" className="chatbot-sidebar-overlay" aria-label="关闭侧边栏" onClick={onCloseMobile} />
      <aside className="chatbot-sidebar">
        <header className="chatbot-sidebar-header">
          <button type="button" className="chatbot-logo-button" aria-label="智能对话首页" onClick={onCloseMobile}>
            <MessageSquareIcon />
          </button>
          <button
            type="button"
            className="chatbot-sidebar-toggle"
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={onToggleCollapsed}
          >
            <PanelLeftIcon />
          </button>
        </header>

        <button
          type="button"
          className="chatbot-new-chat"
          aria-label="新建对话"
          onClick={() => {
            onCloseMobile();
            void chat.createConversation();
          }}
        >
          <PenSquareIcon />
          <span className="chatbot-collapsible-label">New chat</span>
        </button>

        <button
          type="button"
          className="chatbot-delete-all"
          aria-label="删除全部对话"
          onClick={confirmDeleteAllConversations}
        >
          <TrashIcon />
          <span className="chatbot-collapsible-label">Delete all</span>
        </button>

        <nav className="chatbot-history" aria-label="对话历史">
          <span className="chatbot-history-heading">HISTORY</span>
          {historyGroups.length === 0 ? (
            <p className="chatbot-history-empty">开始对话后会出现在这里</p>
          ) : (
            historyGroups.map(group => (
              <section key={group.key} className="chatbot-history-group" aria-label={group.label}>
                <span className="chatbot-history-label">{group.label}</span>
                {group.sessions.map(session => {
                  const label = toConversationLabel(session);

                  return (
                    <div
                      key={session.id}
                      className={`chatbot-history-item${chat.activeSessionId === session.id ? ' chatbot-history-item-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="chatbot-history-select"
                        onClick={() => {
                          chat.setActiveSessionId(session.id);
                          onCloseMobile();
                        }}
                      >
                        <span>{label}</span>
                      </button>
                      <Dropdown
                        menu={{ items: conversationMenu(session) }}
                        placement="bottomRight"
                        trigger={['click']}
                        classNames={{ root: 'chatbot-history-menu' }}
                      >
                        <button
                          type="button"
                          className="chatbot-history-more"
                          aria-label={`${label} 操作`}
                          onClick={event => event.stopPropagation()}
                          onKeyDown={event => event.stopPropagation()}
                        >
                          <MoreHorizontalIcon />
                        </button>
                      </Dropdown>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </nav>

        <Dropdown
          menu={{ items: userMenu }}
          placement="topLeft"
          trigger={['click']}
          classNames={{ root: 'chatbot-user-menu' }}
        >
          <button type="button" className="chatbot-sidebar-footer" aria-label="打开用户菜单">
            <div className="chatbot-user-avatar" />
            <div className="chatbot-collapsible-label">
              <strong>Guest</strong>
            </div>
            <ChevronUpIcon className="chatbot-user-chevron" aria-hidden="true" />
          </button>
        </Dropdown>
      </aside>
    </>
  );
}
