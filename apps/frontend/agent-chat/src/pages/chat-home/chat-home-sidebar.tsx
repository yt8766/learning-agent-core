import {
  DeleteOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { stripWorkflowCommandPrefix } from '@/pages/chat/chat-message-adapter-helpers';
import type { useChatSession } from '@/hooks/use-chat-session';

import { buildSessionGroups, getSessionStatusTone } from './chat-home-sidebar-helpers';

const sidebarMenuDetailsSelector = 'details.chatx-session-item__menu, details.chatx-account-menu';
const sessionMenuSelector = '.chatx-session-item__menu';
const accountMenuSelector = '.chatx-account-menu';

export type ChatHomeSidebarChat = Pick<
  ReturnType<typeof useChatSession>,
  'sessions' | 'activeSessionId' | 'createNewSession' | 'setActiveSessionId' | 'deleteSessionById'
>;

interface ChatHomeSidebarProps {
  chat: ChatHomeSidebarChat;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout?: () => void;
}

export function ChatHomeSidebar({ chat, collapsed, onToggleCollapsed, onLogout }: ChatHomeSidebarProps) {
  const [openSessionMenuId, setOpenSessionMenuId] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!isPointerInsideSidebarMenu(target, sessionMenuSelector)) {
        setOpenSessionMenuId('');
      }

      if (!isPointerInsideSidebarMenu(target, accountMenuSelector)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (collapsed) {
    return (
      <aside className="chatx-sidebar-rail" aria-label="会话侧边栏">
        <div className="chatx-sidebar-rail__brand" aria-hidden="true">
          <span className="chatx-brand-mark" />
        </div>
        <div className="chatx-sidebar-rail__actions" aria-label="侧边栏操作">
          <button
            type="button"
            className="chatx-sidebar-rail__button"
            aria-label="展开侧边栏"
            onClick={onToggleCollapsed}
          >
            <MenuUnfoldOutlined aria-hidden="true" />
          </button>
          <button
            type="button"
            className="chatx-sidebar-rail__button"
            aria-label="开启新对话"
            onClick={() => void chat.createNewSession()}
          >
            <PlusCircleOutlined aria-hidden="true" />
          </button>
        </div>
      </aside>
    );
  }

  const sessionGroups = buildSessionGroups(chat.sessions);

  return (
    <aside className="chatx-sidebar" aria-label="会话侧边栏">
      <header className="chatx-sidebar__header">
        <div className="chatx-brand">
          <div className="chatx-brand__badge" aria-hidden="true">
            <span className="chatx-brand-mark" />
          </div>
          <div className="chatx-brand__copy">
            <h2>Agent Chat</h2>
          </div>
        </div>
        <button type="button" className="chatx-sidebar__toggle" aria-label="收起侧边栏" onClick={onToggleCollapsed}>
          <MenuFoldOutlined aria-hidden="true" />
        </button>
      </header>

      <button type="button" className="chatx-new-chat" onClick={() => void chat.createNewSession()}>
        <PlusCircleOutlined className="chatx-new-chat__icon" aria-hidden="true" />
        <span className="chatx-new-chat__label">开启新对话</span>
      </button>

      <nav className="chatx-session-list" aria-label="历史会话">
        {sessionGroups.length ? (
          sessionGroups.map((group, index) => {
            const groupId = `chatx-session-group-${index}`;

            return (
              <section className="chatx-session-group" key={group.label} aria-labelledby={groupId}>
                <h3 id={groupId} className="chatx-session-group__label">
                  {group.label}
                </h3>
                <div className="chatx-session-group__items">
                  {group.sessions.map(session => {
                    const statusDisplay = getSessionStatusTone(session.status);
                    const isActive = session.id === chat.activeSessionId;
                    const sessionDisplayTitle = stripWorkflowCommandPrefix(session.title);

                    return (
                      <div
                        key={session.id}
                        className={`chatx-session-item chatx-session-item--${statusDisplay.tone}${
                          isActive ? ' is-active' : ''
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <button
                          type="button"
                          className="chatx-session-item__select"
                          onClick={() => chat.setActiveSessionId(session.id)}
                        >
                          <span className="chatx-session-item__row">
                            <span className="chatx-session-item__title">{sessionDisplayTitle}</span>
                            <span
                              className={`chatx-session-item__status chatx-session-item__status--${statusDisplay.accessory}`}
                              aria-label={statusDisplay.label}
                            >
                              {statusDisplay.accessory === 'pill' ? (
                                <>
                                  <span>{statusDisplay.label}</span>
                                  <span className="chatx-session-item__spinner" aria-hidden="true" />
                                </>
                              ) : (
                                <span className="chatx-session-item__dot" aria-hidden="true" />
                              )}
                            </span>
                          </span>
                        </button>
                        <details className="chatx-session-item__menu" open={openSessionMenuId === session.id}>
                          <summary
                            className="chatx-session-item__menu-trigger"
                            aria-label={`${sessionDisplayTitle} 更多操作`}
                            onClick={event => {
                              stopMenuClick(event);
                              event?.preventDefault();
                              setAccountMenuOpen(false);
                              setOpenSessionMenuId(currentId => (currentId === session.id ? '' : session.id));
                            }}
                          >
                            <span aria-hidden="true">...</span>
                          </summary>
                          <div className="chatx-session-item__menu-panel" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="chatx-session-item__menu-action chatx-session-item__menu-action--danger"
                              onClick={event => {
                                stopMenuClick(event);
                                setOpenSessionMenuId('');
                                void chat.deleteSessionById(session.id);
                              }}
                            >
                              <DeleteOutlined className="chatx-session-item__menu-icon" aria-hidden="true" />
                              <span>删除</span>
                            </button>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <p className="chatx-session-list__empty">还没有会话，输入问题即可开始。</p>
        )}
      </nav>

      <footer className="chatx-sidebar__account">
        <details className="chatx-account-menu" open={accountMenuOpen}>
          <summary
            className="chatx-account-menu__trigger"
            aria-label="账号菜单"
            onClick={event => {
              stopMenuClick(event);
              event?.preventDefault();
              setOpenSessionMenuId('');
              setAccountMenuOpen(open => !open);
            }}
          >
            <span className="chatx-sidebar__avatar" aria-hidden="true">
              U
            </span>
            <span className="chatx-sidebar__account-text">176******93</span>
            <span className="chatx-account-menu__more" aria-hidden="true">
              ...
            </span>
          </summary>
          <div className="chatx-account-menu__panel" role="menu">
            <button
              type="button"
              role="menuitem"
              className="chatx-account-menu__item"
              onClick={event => {
                stopMenuClick(event);
                setAccountMenuOpen(false);
                onLogout?.();
              }}
            >
              <LogoutOutlined className="chatx-account-menu__item-icon" aria-hidden="true" />
              退出登录
            </button>
          </div>
        </details>
      </footer>
    </aside>
  );
}

function stopMenuClick(event?: MouseEvent<HTMLElement>) {
  event?.stopPropagation();
}

export function closeOpenSidebarMenus(target: EventTarget | null, root: ParentNode = document) {
  if (isPointerInsideSidebarMenu(target, sidebarMenuDetailsSelector)) {
    return;
  }

  root.querySelectorAll<HTMLDetailsElement>(sidebarMenuDetailsSelector).forEach(menu => {
    menu.open = false;
  });
}

function isPointerInsideSidebarMenu(target: EventTarget | null, selector: string) {
  const closest = (target as { closest?: (selector: string) => Element | null } | null)?.closest;
  return typeof closest === 'function' && Boolean(closest.call(target, selector));
}
