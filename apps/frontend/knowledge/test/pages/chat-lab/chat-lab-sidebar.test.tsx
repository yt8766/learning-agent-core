/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x/es/conversations', () => ({
  default: ({ items, activeKey }: any) => (
    <div className="conversations" data-active={activeKey}>
      {items?.map((item: any) => (
        <span key={item.key}>{item.label}</span>
      ))}
    </div>
  )
}));

vi.mock('antd', () => ({
  Button: ({ children, icon, onClick, type }: any) => (
    <button className={`btn ${type ?? ''}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}));

import { ChatLabSidebar } from '@/pages/chat-lab/chat-lab-sidebar';

const defaultProps = {
  activeConversationKey: 'conv-1',
  chatConversations: [
    { key: 'conv-1', label: 'Chat 1' },
    { key: 'conv-2', label: 'Chat 2' }
  ],
  createConversation: vi.fn(() => ({ key: 'new-conv', label: '新会话' })),
  knowledgeBases: [
    {
      id: 'kb-1',
      name: 'Tech Docs',
      workspaceId: 'w1',
      tags: [],
      visibility: 'private',
      status: 'active',
      documentCount: 5,
      chunkCount: 100,
      readyDocumentCount: 5,
      failedDocumentCount: 0,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'kb-2',
      name: 'User Guides',
      workspaceId: 'w1',
      tags: [],
      visibility: 'private',
      status: 'active',
      documentCount: 3,
      chunkCount: 50,
      readyDocumentCount: 3,
      failedDocumentCount: 0,
      createdAt: '',
      updatedAt: ''
    }
  ] as any,
  removeConversation: vi.fn(),
  renameConversation: vi.fn(),
  setActiveConversationKey: vi.fn(),
  setSelectedMentions: vi.fn()
};

describe('ChatLabSidebar', () => {
  it('renders sidebar with conversations', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} />);
    expect(html).toContain('knowledge-chat-codex-sidebar');
    expect(html).toContain('Chat 1');
    expect(html).toContain('Chat 2');
  });

  it('renders new conversation button', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} />);
    expect(html).toContain('新会话');
  });

  it('renders knowledge bases section', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} />);
    expect(html).toContain('知识库');
    expect(html).toContain('Tech Docs');
    expect(html).toContain('User Guides');
  });

  it('renders conversations section title', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} />);
    expect(html).toContain('对话');
  });

  it('renders with empty conversations', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} chatConversations={[]} />);
    expect(html).toContain('新会话');
    expect(html).toContain('conversations');
  });

  it('renders with empty knowledge bases', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} knowledgeBases={[]} />);
    expect(html).toContain('知识库');
  });

  it('renders conversation labels', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} />);
    expect(html).toContain('Chat 1');
    expect(html).toContain('Chat 2');
  });

  it('sets active conversation key', () => {
    const html = renderToStaticMarkup(<ChatLabSidebar {...defaultProps} activeConversationKey="conv-2" />);
    expect(html).toContain('data-active="conv-2"');
  });
});
