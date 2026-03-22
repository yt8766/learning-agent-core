import type { ChatSessionRecord } from '../../types/chat';
import { formatSessionTime, getSessionStatusLabel } from '../../hooks/use-chat-session';
import { SearchIcon } from '../../components/icons';

const SIDEBAR_ITEMS = [
  { key: 'images', icon: '▧', label: '图片', active: true },
  { key: 'apps', icon: '◌', label: '应用', active: false },
  { key: 'research', icon: '⚑', label: '深度研究', active: false },
  { key: 'health', icon: '♡', label: 'Health', active: false }
] as const;

interface SessionListPanelProps {
  sessions: ChatSessionRecord[];
  activeSessionId: string;
  loading: boolean;
  draft: string;
  onDraftCreate: () => void;
  onSelectSession: (sessionId: string) => void;
  onToggleRightPanel: () => void;
  showRightPanel: boolean;
}

export function SessionListPanel(props: SessionListPanelProps) {
  const {
    sessions,
    activeSessionId,
    loading,
    draft,
    onDraftCreate,
    onSelectSession,
    onToggleRightPanel,
    showRightPanel
  } = props;

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-top">
        <div className="brand-mark">AI</div>
        <button className="sidebar-toggle" onClick={onToggleRightPanel}>
          {showRightPanel ? '◧' : '◨'}
        </button>
      </div>

      <button className="new-chat-button" disabled={loading || !draft.trim()} onClick={onDraftCreate}>
        <span>+</span>
        <span>新聊天</span>
        <span className="shortcut-text">Ctrl + Shift + O</span>
      </button>

      <div className="sidebar-search">
        <span className="sidebar-icon">
          <SearchIcon />
        </span>
        <span>搜索聊天</span>
      </div>

      <nav className="sidebar-nav">
        {SIDEBAR_ITEMS.map(item => (
          <button key={item.key} className={`nav-item ${item.active ? 'active' : ''}`}>
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="session-list-block">
        <div className="session-list-title">最近会话</div>
        <div className="session-list">
          {sessions.length === 0 ? <p className="sidebar-empty">还没有会话，输入问题即可开始。</p> : null}
          {sessions.map(session => (
            <button
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <strong>{session.title}</strong>
              <span>{getSessionStatusLabel(session.status)}</span>
              <small>{formatSessionTime(session.updatedAt)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-footer-card">
        <h3>获取为你量身定制的回复</h3>
        <p>登录以获得基于已保存聊天的回答，并可创建图片和上传文件。</p>
        <button className="sidebar-login">登录</button>
      </div>
    </aside>
  );
}
