import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { buildCodexChatStreamUrl, closeEventSource } from '../src/runtime/codex-chat-stream';
import { CodexChatLayout } from '../src/components/codex-chat-layout';
import { CodexChatShell } from '../src/components/codex-chat-shell';
import type { CodexChatSessionState } from '../src/hooks/use-codex-chat-session';
import type { ChatSessionRecord } from '../src/types/chat';

vi.mock('antd', () => {
  const Container = ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  );

  function Input({ value }: { value?: string }) {
    return <input value={value} readOnly />;
  }

  function Modal({ children, title, open }: { children?: ReactNode; title?: ReactNode; open?: boolean }) {
    return open ? (
      <div>
        {title}
        {children}
      </div>
    ) : null;
  }
  Modal.confirm = vi.fn();

  return {
    Button: ({ children, icon }: { children?: ReactNode; icon?: ReactNode }) => (
      <button type="button">
        {icon}
        {children}
      </button>
    ),
    ConfigProvider: Container,
    Dropdown: ({ children, menu }: { children?: ReactNode; menu?: { items?: { label?: ReactNode }[] } }) => (
      <div>
        {children}
        {menu?.items?.map((item, index) => (
          <span key={index}>{item.label}</span>
        ))}
      </div>
    ),
    Input,
    Modal,
    Popover: ({ children, content, open }: { children?: ReactNode; content?: ReactNode; open?: boolean }) => (
      <div>
        {children}
        {open ? content : null}
      </div>
    )
  };
});

vi.mock('@ant-design/x', () => ({
  Bubble: {
    List: ({ items }: { items?: { key: string; content: ReactNode }[] }) => (
      <div>
        {items?.map(item => (
          <div key={item.key}>{item.content}</div>
        ))}
      </div>
    )
  },
  Prompts: ({ items }: { items?: { key: string; label: ReactNode }[] }) => (
    <div>
      {items?.map(item => (
        <button key={item.key}>{item.label}</button>
      ))}
    </div>
  ),
  Welcome: ({ title }: { title?: ReactNode }) => <section>{title}</section>,
  XProvider: ({ children }: { children?: ReactNode }) => <>{children}</>
}));

vi.mock('../src/components/assistant-message', () => ({
  AssistantMessage: ({ message }: { message: { content: string } }) => <article>{message.content}</article>
}));

function createMockChat(overrides: Partial<CodexChatSessionState> = {}): CodexChatSessionState {
  return {
    activeMessages: [],
    activeSessionId: '',
    cancelStreamRequest: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    isRequesting: false,
    openRenameDialog: vi.fn(),
    renameConversation: vi.fn(),
    renameTarget: null,
    renameValue: '',
    sendMessage: vi.fn(),
    sessions: [],
    setActiveSessionId: vi.fn(),
    setRenameTarget: vi.fn(),
    setRenameValue: vi.fn(),
    streamError: '',
    ...overrides
  };
}

describe('CodexChatShell', () => {
  it('renders the empty conversation welcome copy', () => {
    const html = renderToStaticMarkup(<CodexChatShell />);

    expect(html).toContain('智能对话');
    expect(html).toContain('New chat');
    expect(html).toContain('Delete all');
    expect(html).toContain('HISTORY');
    expect(html).toContain('我能帮你做什么？');
    expect(html).toContain('提问、写代码，或者一起梳理想法。');
    expect(html).toContain('Ask anything...');
    expect(html).toContain('Kimi K2.5');
    expect(html).toContain('开始对话后会出现在这里');
    expect(html).toContain('Guest');
    expect(html).toContain('退出登录');
    expect(html).toContain('aria-label="收起侧边栏"');
    expect(html).toContain('data-chatbot-icon="message-square"');
    expect(html).toContain('data-chatbot-icon="panel-left"');
    expect(html).toContain('data-chatbot-icon="pen-square"');
    expect(html).toContain('data-chatbot-icon="trash"');
    expect(html).toContain('data-chatbot-icon="paperclip"');
    expect(html).toContain('data-chatbot-icon="arrow-up"');
    expect(html).not.toContain('Deploy with Vercel');
    expect(html).not.toContain('当前对话可见性');
    expect(html).not.toContain('私密');
    expect(html).not.toContain('给智能对话发送消息');
    expect(html).not.toContain('Message Chatbot');
    expect(html).not.toContain('Send message');
    expect(html).not.toContain('智能对话工作台');
    expect(html).not.toContain('aria-label="打开侧边栏"');
  });

  it('groups sidebar history by creation date ranges', () => {
    const now = new Date();
    const session = (id: string, title: string, daysAgo: number): ChatSessionRecord => {
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - daysAgo);

      return {
        id,
        title,
        status: 'idle',
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString()
      };
    };
    const chat = createMockChat({
      activeSessionId: 'today',
      sessions: [
        session('today', '今天的排查', 0),
        session('yesterday', '昨天的计划', 1),
        session('week', '近 7 天的实现', 3),
        session('month', '近 30 天的复盘', 14),
        session('older', '更早的归档', 45)
      ]
    });

    const html = renderToStaticMarkup(<CodexChatLayout chat={chat} />);

    expect(html).toContain('TODAY');
    expect(html).toContain('YESTERDAY');
    expect(html).toContain('LAST 7 DAYS');
    expect(html).toContain('LAST 30 DAYS');
    expect(html).toContain('OLDER');
    expect(html).toContain('今天的排查');
    expect(html).toContain('昨天的计划');
    expect(html).toContain('近 7 天的实现');
    expect(html).toContain('近 30 天的复盘');
    expect(html).toContain('更早的归档');
  });

  it('keeps the collapsed sidebar as an icon rail without leaking the main header', () => {
    const html = renderToStaticMarkup(<CodexChatLayout chat={createMockChat()} defaultSidebarCollapsed />);

    expect(html).toContain('chatbot-shell-sidebar-collapsed');
    expect(html).toContain('aria-label="新建对话"');
    expect(html).toContain('aria-label="删除全部对话"');
    expect(html).toContain('aria-label="展开侧边栏"');
    expect(html).not.toContain('aria-label="打开侧边栏"');
  });

  it('builds encoded stream URLs and closes active streams', () => {
    const close = vi.fn();

    expect(buildCodexChatStreamUrl('session/中文 1')).toBe(
      '/api/chat/stream?sessionId=session%2F%E4%B8%AD%E6%96%87%201'
    );
    closeEventSource({ close } as unknown as EventSource);

    expect(close).toHaveBeenCalledTimes(1);
  });
});
