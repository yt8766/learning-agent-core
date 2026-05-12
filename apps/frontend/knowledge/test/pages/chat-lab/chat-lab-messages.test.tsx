/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x-markdown/es', () => ({
  default: ({ children }: { children: string }) => <div className="markdown">{children}</div>
}));

vi.mock('@ant-design/x/es/actions', () => {
  const Actions = ({ items }: any) => (
    <div className="actions">
      {items?.map((item: any) => (
        <span key={item.key}>{item.label}</span>
      ))}
    </div>
  );
  Actions.Copy = ({ text }: any) => <span className="copy">{text}</span>;
  Actions.Feedback = ({ value, onChange }: any) => (
    <span className="feedback" data-value={value} data-has-change={onChange ? 'true' : 'false'} />
  );
  return { default: Actions };
});

vi.mock('antd', () => ({
  Flex: ({ children, align, gap }: any) => (
    <div className="flex" data-align={align} data-gap={gap}>
      {children}
    </div>
  ),
  Space: ({ children, orientation, size, wrap }: any) => (
    <div className="space" data-orientation={orientation} data-size={size} data-wrap={wrap}>
      {children}
    </div>
  ),
  Spin: ({ size }: any) => <span className="spin" data-size={size} />,
  Tag: ({ children }: any) => <span className="tag">{children}</span>,
  Typography: {
    Link: ({ children, href }: any) => (
      <a className="link" href={href}>
        {children}
      </a>
    ),
    Text: ({ children, strong, type }: any) => {
      if (strong) return <strong data-type={type}>{children}</strong>;
      return <span data-type={type}>{children}</span>;
    }
  },
  theme: {
    defaultAlgorithm: {},
    defaultSeed: {}
  }
}));

import { toBubbleMessage, createChatRoles } from '@/pages/chat-lab/chat-lab-messages';

describe('toBubbleMessage', () => {
  it('creates bubble message for assistant role', () => {
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello from assistant',
      citations: [{ id: 'cite-1', title: 'Doc 1', quote: 'Some quote', score: 0.95 }],
      diagnostics: { retrievalMode: 'hybrid' },
      route: { reason: 'knowledge_match' },
      traceId: 'trace-123'
    };

    const result = toBubbleMessage(message as any, {});

    expect(result.key).toBe('msg-1');
    expect(result.role).toBe('ai');
    expect(result.content).toBe('Hello from assistant');
    expect((result.extraInfo as any).messageId).toBe('msg-1');
    expect((result.extraInfo as any).traceId).toBe('trace-123');
    expect((result.extraInfo as any).citations).toHaveLength(1);
    expect((result.extraInfo as any).diagnostics.retrievalMode).toBe('hybrid');
    expect((result.extraInfo as any).route.reason).toBe('knowledge_match');
  });

  it('creates bubble message for user role', () => {
    const message = {
      id: 'msg-2',
      role: 'user' as const,
      content: 'User question'
    };

    const result = toBubbleMessage(message as any, {});

    expect(result.key).toBe('msg-2');
    expect(result.role).toBe('user');
    expect(result.content).toBe('User question');
  });

  it('creates bubble message for system role', () => {
    const message = {
      id: 'msg-3',
      role: 'system' as const,
      content: 'System message'
    };

    const result = toBubbleMessage(message as any, {});

    expect(result.key).toBe('msg-3');
    expect(result.role).toBe('system');
    expect(result.content).toBe('System message');
  });

  it('includes feedback from feedback map', () => {
    const message = {
      id: 'msg-4',
      role: 'assistant' as const,
      content: 'Response',
      citations: []
    };

    const result = toBubbleMessage(message as any, { 'msg-4': 'like' });

    expect((result.extraInfo as any).feedback).toBe('like');
  });

  it('includes dislike feedback from feedback map', () => {
    const message = {
      id: 'msg-4b',
      role: 'assistant' as const,
      content: 'Response',
      citations: []
    };

    const result = toBubbleMessage(message as any, { 'msg-4b': 'dislike' });

    expect((result.extraInfo as any).feedback).toBe('dislike');
  });

  it('handles missing optional fields', () => {
    const message = {
      id: 'msg-5',
      role: 'assistant' as const,
      content: 'Response'
    };

    const result = toBubbleMessage(message as any, {});

    expect((result.extraInfo as any).citations).toEqual([]);
    expect((result.extraInfo as any).diagnostics).toBeUndefined();
    expect((result.extraInfo as any).route).toBeUndefined();
    expect((result.extraInfo as any).traceId).toBeUndefined();
    expect((result.extraInfo as any).feedback).toBeUndefined();
  });

  it('sets status to success for assistant messages', () => {
    const message = {
      id: 'msg-6',
      role: 'assistant' as const,
      content: 'Done',
      citations: []
    };

    const result = toBubbleMessage(message as any, {});
    expect(result.status).toBe('success');
  });
});

describe('createChatRoles', () => {
  it('returns role configuration with ai, system, and user roles', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    expect(roles.ai).toBeDefined();
    expect(roles.ai.placement).toBe('start');
    expect(roles.ai.variant).toBe('borderless');
    expect(roles.system).toBeDefined();
    expect(roles.system.placement).toBe('start');
    expect(roles.system.variant).toBe('outlined');
    expect(roles.user).toBeDefined();
    expect(roles.user.placement).toBe('end');
    expect(roles.user.variant).toBe('filled');
  });

  it('ai role has contentRender function', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    expect(typeof roles.ai.contentRender).toBe('function');
  });

  it('contentRender renders markdown content', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(<>{roles.ai.contentRender('Hello **world**')}</>);
    expect(html).toContain('markdown');
    expect(html).toContain('Hello **world**');
  });

  it('contentRender handles null content', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(<>{roles.ai.contentRender(null)}</>);
    expect(html).toContain('markdown');
  });

  it('ai role has loadingRender function', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    expect(typeof roles.ai.loadingRender).toBe('function');
  });

  it('loadingRender renders spinner and text', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(<>{roles.ai.loadingRender()}</>);
    expect(html).toContain('spin');
    expect(html).toContain('正在检索知识库...');
  });

  it('ai role has typing function', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    expect(typeof roles.ai.typing).toBe('function');
  });

  it('typing returns false when status is not updating', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const result = roles.ai.typing('content', { status: 'done' });
    expect(result).toBe(false);
  });

  it('typing returns effect when status is updating', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const result = roles.ai.typing('content', { status: 'updating' });
    expect(result).toEqual({ effect: 'typing', interval: 20, step: 5 });
  });

  it('footer returns null when no extraInfo messageId', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const result = roles.ai.footer('content', {});
    expect(result).toBeNull();
  });

  it('footer returns null when extraInfo has no messageId', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const result = roles.ai.footer('content', { extraInfo: { citations: [] } });
    expect(result).toBeNull();
  });

  it('footer renders copy and feedback actions', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>{roles.ai.footer('Hello', { extraInfo: { messageId: 'msg-1', citations: [] } })}</>
    );
    expect(html).toContain('copy');
    expect(html).toContain('actions');
  });

  it('footer renders route tag when present', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: { messageId: 'msg-1', citations: [], route: { reason: 'knowledge_match' } }
        })}
      </>
    );
    expect(html).toContain('knowledge_match');
  });

  it('footer renders diagnostics when present', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: { messageId: 'msg-1', citations: [], diagnostics: { retrievalMode: 'hybrid' } }
        })}
      </>
    );
    expect(html).toContain('hybrid');
  });

  it('footer renders trace link when traceId present', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: { messageId: 'msg-1', citations: [], traceId: 'trace-abc' }
        })}
      </>
    );
    expect(html).toContain('trace-abc');
    expect(html).toContain('/observability?traceId=');
  });

  it('footer renders citation list with citations', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: {
            messageId: 'msg-1',
            citations: [{ id: 'c1', title: 'Doc Title', quote: 'A quote', score: 0.92, uri: 'https://example.com' }]
          }
        })}
      </>
    );
    expect(html).toContain('引用来源');
    expect(html).toContain('Doc Title');
    expect(html).toContain('A quote');
    expect(html).toContain('0.92');
    expect(html).toContain('https://example.com');
  });

  it('footer renders empty citation message when no citations', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: { messageId: 'msg-1', citations: [] }
        })}
      </>
    );
    expect(html).toContain('引用来源：无');
  });

  it('footer handles citation without score', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: {
            messageId: 'msg-1',
            citations: [{ id: 'c1', title: 'Doc', quote: 'Q' }]
          }
        })}
      </>
    );
    expect(html).toContain('Doc');
  });

  it('footer handles citation without uri', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>
        {roles.ai.footer('Hello', {
          extraInfo: {
            messageId: 'msg-1',
            citations: [{ id: 'c1', title: 'Doc', quote: 'Q', score: 0.5 }]
          }
        })}
      </>
    );
    expect(html).toContain('Doc');
    expect(html).toContain('0.50');
  });

  it('footer handles null content', () => {
    const roles = createChatRoles({
      setMessageFeedback: vi.fn(),
      submitFeedback: vi.fn()
    });

    const html = renderToStaticMarkup(
      <>{roles.ai.footer(null, { extraInfo: { messageId: 'msg-1', citations: [] } })}</>
    );
    expect(html).toContain('copy');
  });
});
