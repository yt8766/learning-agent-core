import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatHomeSidebar } from '@/pages/chat-home/chat-home-sidebar';
import type { ChatHomeSidebarChat } from '@/pages/chat-home/chat-home-sidebar';
import type { ChatSessionRecord } from '@/types/chat';

const sessions: ChatSessionRecord[] = [
  {
    id: 'session-running',
    title: 'Agent目录结构优化建议',
    status: 'running',
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T09:00:00.000Z'
  },
  {
    id: 'session-approval',
    title: '流程图生成与解读',
    status: 'waiting_approval',
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T09:00:00.000Z'
  },
  {
    id: 'session-old',
    title: 'gstack中skills概念解析',
    status: 'completed',
    createdAt: '2026-03-12T08:00:00.000Z',
    updatedAt: '2026-03-12T09:00:00.000Z'
  }
];

interface ChatFixture {
  chat: ChatHomeSidebarChat;
  createNewSession: ReturnType<typeof vi.fn<ChatHomeSidebarChat['createNewSession']>>;
  setActiveSessionId: ReturnType<typeof vi.fn<ChatHomeSidebarChat['setActiveSessionId']>>;
  deleteSessionById: ReturnType<typeof vi.fn<ChatHomeSidebarChat['deleteSessionById']>>;
  logout: ReturnType<typeof vi.fn<() => void>>;
}

function createChatFixture(): ChatFixture {
  const createNewSession = vi.fn<ChatHomeSidebarChat['createNewSession']>(async () => undefined);
  const setActiveSessionId = vi.fn<ChatHomeSidebarChat['setActiveSessionId']>();
  const deleteSessionById = vi.fn<ChatHomeSidebarChat['deleteSessionById']>(async () => undefined);
  const logout = vi.fn<() => void>();

  return {
    chat: {
      sessions,
      activeSessionId: 'session-running',
      createNewSession,
      setActiveSessionId,
      deleteSessionById
    },
    createNewSession,
    setActiveSessionId,
    deleteSessionById,
    logout
  };
}

function renderSidebarElement({
  chat,
  collapsed,
  onToggleCollapsed,
  onLogout
}: {
  chat: ChatHomeSidebarChat;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout?: () => void;
}) {
  return (
    <ChatHomeSidebar chat={chat} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} onLogout={onLogout} />
  );
}

describe('ChatHomeSidebar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders expanded Agent Chat session groups with Codex status and account menu', () => {
    const { chat } = createChatFixture();
    const html = renderToStaticMarkup(renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() }));

    expect(html).toContain('Agent Chat');
    expect(html).toContain('开启新对话');
    expect(html).toContain('今天');
    expect(html).toContain('7 天内');
    expect(html).toContain('2026-03');
    expect(html).toContain('Agent目录结构优化建议');
    expect(html).toContain('流程图生成与解读');
    expect(html).toContain('gstack中skills概念解析');
    expect(html).toContain('需要审批');
    expect(html).toContain('执行中');
    expect(html).toContain('chatx-session-item__status--pill');
    expect(html).toContain('chatx-session-item__spinner');
    expect(html).toContain('chatx-session-item--done');
    expect(html).toContain('chatx-session-item__status--dot');
    expect(html).toContain('176******93');
    expect(html).toContain('退出登录');
    expect(html).toContain('chatx-account-menu');
    expect(html).toContain('chatx-account-menu__trigger');
    expect(html).toContain('chatx-account-menu__panel');
    expect(html).toContain('chatx-account-menu__item');
    expect(html).not.toContain('下载手机应用');
    expect(html).not.toContain('系统设置');
    expect(html).not.toContain('帮助与反馈');
    expect(html).not.toContain('▶');
    expect(html).not.toContain('▸');
    expect(html).not.toContain('Single frontline session');
    expect(html).not.toContain('正在准备会话');
  });

  it('keeps session menus compact with delete as the only title-affecting action', () => {
    const { chat } = createChatFixture();
    const html = renderToStaticMarkup(renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() }));

    expect(html).toContain('class="chatx-session-item__menu"');
    expect(html).toContain('chatx-session-item__menu-trigger');
    expect(html).toContain('chatx-session-item__menu-panel');
    expect(html).toContain('role="menu"');
    expect(html).toContain('chatx-session-item__menu-action');
    expect(html).toContain('chatx-session-item__menu-icon');
    expect(html).not.toContain('重命名');
    expect(html).toContain('删除');
  });

  it('renders collapsed rail actions without history titles or account footer', () => {
    const { chat } = createChatFixture();
    const html = renderToStaticMarkup(renderSidebarElement({ chat, collapsed: true, onToggleCollapsed: vi.fn() }));

    expect(html).toContain('aria-label="展开侧边栏"');
    expect(html).toContain('aria-label="开启新对话"');
    expect(html).toContain('chatx-sidebar-rail');
    expect(html).not.toContain('Agent目录结构优化建议');
    expect(html).not.toContain('流程图生成与解读');
    expect(html).not.toContain('gstack中skills概念解析');
    expect(html).not.toContain('176******93');
  });

  it('renders session select controls for each history item', () => {
    const { chat } = createChatFixture();
    const html = renderToStaticMarkup(renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() }));

    expect(html.match(/chatx-session-item__select/g)).toHaveLength(3);
    expect(html).toContain('aria-current="page"');
  });

  it('filters workflow command prefixes from displayed session titles', () => {
    const { chat } = createChatFixture();
    const html = renderToStaticMarkup(
      renderSidebarElement({
        chat: {
          ...chat,
          sessions: [
            {
              ...sessions[0],
              title: '/plan 你是谁'
            },
            sessions[1]
          ]
        },
        collapsed: false,
        onToggleCollapsed: vi.fn()
      })
    );

    expect(html).toContain('你是谁');
    expect(html).not.toContain('/plan 你是谁');
  });

  it('renders new chat actions from expanded and collapsed states', () => {
    const { chat } = createChatFixture();
    const expandedHtml = renderToStaticMarkup(
      renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() })
    );
    const collapsedHtml = renderToStaticMarkup(
      renderSidebarElement({ chat, collapsed: true, onToggleCollapsed: vi.fn() })
    );

    expect(expandedHtml).toContain('开启新对话');
    expect(collapsedHtml).toContain('aria-label="开启新对话"');
  });

  it('renders expanded and collapsed sidebar toggle controls', () => {
    const { chat } = createChatFixture();
    const expandedHtml = renderToStaticMarkup(
      renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() })
    );
    const collapsedHtml = renderToStaticMarkup(
      renderSidebarElement({ chat, collapsed: true, onToggleCollapsed: vi.fn() })
    );

    expect(expandedHtml).toContain('aria-label="收起侧边栏"');
    expect(collapsedHtml).toContain('aria-label="展开侧边栏"');
  });

  it('keeps only logout in the account menu', () => {
    const { chat, logout } = createChatFixture();
    const html = renderToStaticMarkup(
      renderSidebarElement({
        chat,
        collapsed: false,
        onToggleCollapsed: vi.fn(),
        onLogout: logout
      })
    );

    expect(html).toContain('退出登录');
    expect(html).not.toContain('下载手机应用');
    expect(html).not.toContain('系统设置');
    expect(html).not.toContain('帮助与反馈');
  });

  it('closes open sidebar menus when a pointer event lands outside menus', async () => {
    const { closeOpenSidebarMenus } = await import('@/pages/chat-home/chat-home-sidebar');
    const sessionMenu = { open: true };
    const accountMenu = { open: true };
    const root = {
      querySelectorAll: vi.fn(() => [sessionMenu, accountMenu])
    };
    const outsideTarget = {
      closest: vi.fn(() => null)
    };

    closeOpenSidebarMenus(outsideTarget as unknown as EventTarget, root as unknown as ParentNode);

    expect(root.querySelectorAll).toHaveBeenCalledWith('details.chatx-session-item__menu, details.chatx-account-menu');
    expect(sessionMenu.open).toBe(false);
    expect(accountMenu.open).toBe(false);
  });

  it('keeps sidebar menus open when the pointer event stays inside a menu', async () => {
    const { closeOpenSidebarMenus } = await import('@/pages/chat-home/chat-home-sidebar');
    const sessionMenu = { open: true };
    const root = {
      querySelectorAll: vi.fn(() => [sessionMenu])
    };
    const insideTarget = {
      closest: vi.fn(() => ({ className: 'chatx-session-item__menu' }))
    };

    closeOpenSidebarMenus(insideTarget as unknown as EventTarget, root as unknown as ParentNode);

    expect(root.querySelectorAll).not.toHaveBeenCalled();
    expect(sessionMenu.open).toBe(true);
  });
});
