import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/icons', () => ({
  DeleteOutlined: () => 'DeleteOutlined',
  EditOutlined: () => 'EditOutlined',
  LogoutOutlined: () => 'LogoutOutlined',
  MenuFoldOutlined: () => 'MenuFoldOutlined',
  MenuUnfoldOutlined: () => 'MenuUnfoldOutlined',
  PlusCircleOutlined: () => 'PlusCircleOutlined'
}));

vi.mock('@/pages/chat/chat-message-adapter-helpers', () => ({
  stripWorkflowCommandPrefix: (title: string) => title
}));

vi.mock('@/pages/chat-home/chat-home-sidebar-helpers', () => ({
  buildSessionGroups: vi.fn((sessions: any[]) => {
    if (!sessions.length) return [];
    return [{ label: 'Today', sessions }];
  }),
  getSessionStatusTone: vi.fn(() => ({
    tone: 'idle',
    label: 'idle',
    accessory: 'dot'
  }))
}));

import { ChatHomeSidebar, closeOpenSidebarMenus, type ChatHomeSidebarChat } from '@/pages/chat-home/chat-home-sidebar';

function createChat(overrides: Partial<ChatHomeSidebarChat> = {}): ChatHomeSidebarChat {
  return {
    sessions: [],
    activeSessionId: '',
    createNewSession: vi.fn().mockResolvedValue(undefined),
    setActiveSessionId: vi.fn(),
    deleteSessionById: vi.fn().mockResolvedValue(undefined),
    renameSessionById: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('ChatHomeSidebar', () => {
  describe('collapsed state', () => {
    it('renders collapsed rail with expand and new conversation buttons', () => {
      const html = renderToStaticMarkup(
        <ChatHomeSidebar chat={createChat()} collapsed={true} onToggleCollapsed={vi.fn()} />
      );

      expect(html).toContain('chatx-sidebar-rail');
      expect(html).toContain('展开侧边栏');
      expect(html).toContain('开启新对话');
    });
  });

  describe('expanded state', () => {
    it('renders expanded sidebar with header and new conversation button', () => {
      const html = renderToStaticMarkup(
        <ChatHomeSidebar chat={createChat()} collapsed={false} onToggleCollapsed={vi.fn()} />
      );

      expect(html).toContain('chatx-sidebar');
      expect(html).toContain('Agent Chat');
      expect(html).toContain('收起侧边栏');
      expect(html).toContain('开启新对话');
    });

    it('renders empty state when no sessions', () => {
      const html = renderToStaticMarkup(
        <ChatHomeSidebar chat={createChat({ sessions: [] })} collapsed={false} onToggleCollapsed={vi.fn()} />
      );

      expect(html).toContain('还没有会话');
    });

    it('renders session groups when sessions exist', () => {
      const sessions = [
        {
          id: 'session-1',
          title: 'First Session',
          status: 'idle' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'session-2',
          title: 'Second Session',
          status: 'running' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const html = renderToStaticMarkup(
        <ChatHomeSidebar
          chat={createChat({ sessions, activeSessionId: 'session-1' })}
          collapsed={false}
          onToggleCollapsed={vi.fn()}
        />
      );

      expect(html).toContain('Today');
      expect(html).toContain('First Session');
      expect(html).toContain('Second Session');
      expect(html).toContain('is-active');
    });

    it('renders account menu section', () => {
      const html = renderToStaticMarkup(
        <ChatHomeSidebar chat={createChat()} collapsed={false} onToggleCollapsed={vi.fn()} onLogout={vi.fn()} />
      );

      expect(html).toContain('退出登录');
      expect(html).toContain('账号菜单');
    });

    it('renders history session nav label', () => {
      const html = renderToStaticMarkup(
        <ChatHomeSidebar chat={createChat()} collapsed={false} onToggleCollapsed={vi.fn()} />
      );

      expect(html).toContain('历史会话');
    });
  });
});

describe('closeOpenSidebarMenus', () => {
  it('closes all open details elements matching the selector', () => {
    const details = { open: true } as HTMLDetailsElement;
    const root = {
      querySelectorAll: vi.fn().mockReturnValue([details])
    } as unknown as ParentNode;

    closeOpenSidebarMenus(null, root);

    expect(details.open).toBe(false);
  });

  it('does nothing when target is inside a sidebar menu', () => {
    const closest = vi.fn().mockReturnValue({});
    const target = { closest } as unknown as EventTarget;
    const root = {
      querySelectorAll: vi.fn().mockReturnValue([])
    } as unknown as ParentNode;

    closeOpenSidebarMenus(target, root);

    // Should not throw and should call closest
    expect(closest).toHaveBeenCalled();
    // querySelectorAll should NOT be called because target is inside menu
    expect(root.querySelectorAll).not.toHaveBeenCalled();
  });
});
