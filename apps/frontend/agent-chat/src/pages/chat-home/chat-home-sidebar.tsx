import type { useChatSession } from '@/hooks/use-chat-session';

import { buildSessionGroups, getSessionStatusTone } from './chat-home-sidebar-helpers';

export type ChatHomeSidebarChat = Pick<
  ReturnType<typeof useChatSession>,
  'sessions' | 'activeSessionId' | 'createNewSession' | 'setActiveSessionId'
>;

interface ChatHomeSidebarProps {
  chat: ChatHomeSidebarChat;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ChatHomeSidebar({ chat, collapsed, onToggleCollapsed }: ChatHomeSidebarProps) {
  if (collapsed) {
    return (
      <aside className="chatx-sidebar-rail" aria-label="会话侧边栏">
        <div className="chatx-sidebar-rail__brand" aria-hidden="true">
          AC
        </div>
        <div className="chatx-sidebar-rail__actions" aria-label="侧边栏操作">
          <button
            type="button"
            className="chatx-sidebar-rail__button"
            aria-label="展开侧边栏"
            onClick={onToggleCollapsed}
          >
            <span aria-hidden="true">&gt;</span>
          </button>
          <button
            type="button"
            className="chatx-sidebar-rail__button"
            aria-label="开启新对话"
            onClick={() => void chat.createNewSession()}
          >
            <span aria-hidden="true">+</span>
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
            AC
          </div>
          <div className="chatx-brand__copy">
            <h2>Agent Chat</h2>
          </div>
        </div>
        <button type="button" className="chatx-sidebar__toggle" aria-label="收起侧边栏" onClick={onToggleCollapsed}>
          <span aria-hidden="true">&lt;</span>
        </button>
      </header>

      <button type="button" className="chatx-new-chat" onClick={() => void chat.createNewSession()}>
        <span className="chatx-new-chat__icon" aria-hidden="true">
          +
        </span>
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

                    return (
                      <button
                        type="button"
                        key={session.id}
                        className={`chatx-session-item chatx-session-item--${statusDisplay.tone}${
                          isActive ? ' is-active' : ''
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => chat.setActiveSessionId(session.id)}
                      >
                        <span className="chatx-session-item__main">
                          <span className="chatx-session-item__row">
                            <span className="chatx-session-item__title">{session.title}</span>
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
                        </span>
                      </button>
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
        <span className="chatx-sidebar__avatar" aria-hidden="true">
          U
        </span>
        <span className="chatx-sidebar__account-text">176******93</span>
      </footer>
    </aside>
  );
}
