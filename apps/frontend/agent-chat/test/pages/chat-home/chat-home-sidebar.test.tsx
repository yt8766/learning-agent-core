import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
}

interface ElementProps {
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
  onClick?: () => void;
}

function createChatFixture(): ChatFixture {
  const createNewSession = vi.fn<ChatHomeSidebarChat['createNewSession']>(async () => undefined);
  const setActiveSessionId = vi.fn<ChatHomeSidebarChat['setActiveSessionId']>();

  return {
    chat: {
      sessions,
      activeSessionId: 'session-running',
      createNewSession,
      setActiveSessionId
    },
    createNewSession,
    setActiveSessionId
  };
}

function renderSidebarElement({
  chat,
  collapsed,
  onToggleCollapsed
}: {
  chat: ChatHomeSidebarChat;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return ChatHomeSidebar({ chat, collapsed, onToggleCollapsed });
}

function getElementProps(element: ReactElement): ElementProps {
  return element.props as ElementProps;
}

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }

  if (isValidElement(node)) {
    return getTextContent(getElementProps(node).children);
  }

  return '';
}

function findElement(node: ReactNode, predicate: (element: ReactElement) => boolean): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findElement(child, predicate);
      if (result) {
        return result;
      }
    }
    return undefined;
  }

  if (!isValidElement(node)) {
    return undefined;
  }

  if (predicate(node)) {
    return node;
  }

  return findElement(getElementProps(node).children, predicate);
}

function getButtonByLabel(node: ReactNode, label: string): ReactElement {
  const button = findElement(
    node,
    element => element.type === 'button' && getElementProps(element)['aria-label'] === label
  );
  if (!button) {
    throw new Error(`Unable to find button with aria-label: ${label}`);
  }
  return button;
}

function getButtonByText(node: ReactNode, text: string): ReactElement {
  const button = findElement(
    node,
    element => element.type === 'button' && getTextContent(getElementProps(element).children).includes(text)
  );
  if (!button) {
    throw new Error(`Unable to find button containing text: ${text}`);
  }
  return button;
}

describe('ChatHomeSidebar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders expanded multi-session groups with account footer', () => {
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
    expect(html).toContain('等待批准');
    expect(html).toContain('chatx-session-item__status--pill');
    expect(html).toContain('chatx-session-item__spinner');
    expect(html).toContain('chatx-session-item--done');
    expect(html).toContain('chatx-session-item__status--dot');
    expect(html).toContain('176******93');
    expect(html).not.toContain('Single frontline session');
    expect(html).not.toContain('正在准备会话');
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

  it('selects a session when a session item is clicked', () => {
    const { chat, setActiveSessionId } = createChatFixture();
    const sidebar = renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() });

    getElementProps(getButtonByText(sidebar, '流程图生成与解读')).onClick?.();

    expect(setActiveSessionId).toHaveBeenCalledWith('session-approval');
  });

  it('creates a session from expanded and collapsed actions', () => {
    const { chat, createNewSession } = createChatFixture();

    getElementProps(
      getButtonByText(renderSidebarElement({ chat, collapsed: false, onToggleCollapsed: vi.fn() }), '开启新对话')
    ).onClick?.();
    getElementProps(
      getButtonByLabel(renderSidebarElement({ chat, collapsed: true, onToggleCollapsed: vi.fn() }), '开启新对话')
    ).onClick?.();

    expect(createNewSession).toHaveBeenCalledTimes(2);
  });

  it('toggles from expanded and collapsed controls', () => {
    const { chat } = createChatFixture();
    const onToggleCollapsed = vi.fn<() => void>();

    getElementProps(
      getButtonByLabel(renderSidebarElement({ chat, collapsed: false, onToggleCollapsed }), '收起侧边栏')
    ).onClick?.();
    getElementProps(
      getButtonByLabel(renderSidebarElement({ chat, collapsed: true, onToggleCollapsed }), '展开侧边栏')
    ).onClick?.();

    expect(onToggleCollapsed).toHaveBeenCalledTimes(2);
  });
});
