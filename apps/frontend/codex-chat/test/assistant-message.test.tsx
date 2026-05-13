import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AssistantMessage } from '../src/components/assistant-message';
import { copyMessageText } from '../src/components/message-actions';
import type { CodexChatMessage } from '../src/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content }: { content?: string }) => <div>{content}</div>
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    icon,
    type,
    ...props
  }: {
    children?: ReactNode;
    icon?: ReactNode;
    type?: string;
    [key: string]: unknown;
  }) => (
    <button data-type={type} type="button" {...props}>
      {icon}
      {children}
    </button>
  ),
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}));

describe('AssistantMessage', () => {
  it('renders assistant replies like vercel chatbot without default step cards', () => {
    const message: CodexChatMessage = {
      role: 'assistant',
      content: '最终回答',
      reasoning: '先检查上下文，再组织回复。',
      steps: [
        {
          id: 'inspect',
          title: '读取上下文',
          description: '查看已有会话和消息。',
          status: 'completed',
          agentLabel: '户部'
        },
        {
          id: 'run',
          title: '执行验证',
          status: 'running'
        }
      ]
    };

    const html = renderToStaticMarkup(<AssistantMessage message={message} streaming />);

    expect(html).toContain('codex-preview-message');
    expect(html).toContain('codex-assistant-avatar');
    expect(html).toContain('data-testid="message-content"');
    expect(html).toContain('最终回答');
    expect(html).toContain('data-testid="message-reasoning"');
    expect(html).toContain('<details');
    expect(html).toContain('open=""');
    expect(html).toContain('思考中');
    expect(html).toContain('data-chatbot-icon="sparkles"');
    expect(html).toContain('data-chatbot-icon="chevron-down"');
    expect(html).not.toContain('codex-tool-card');
    expect(html).not.toContain('流式生成中');
    expect(html).not.toContain('推进任务');
    expect(html).toContain('复制');
    expect(html).toContain('data-chatbot-icon="copy"');
    expect(html).toContain('data-chatbot-icon="thumb-up"');
    expect(html).toContain('data-chatbot-icon="thumb-down"');
    expect(html).toContain('aria-label="赞同回复"');
    expect(html).toContain('aria-label="不赞同回复"');
  });

  it('renders the upstream-style thinking placeholder before text arrives', () => {
    const html = renderToStaticMarkup(<AssistantMessage message={{ role: 'assistant', content: '' }} streaming />);

    expect(html).toContain('Thinking...');
    expect(html).not.toContain('正在组织回答');
    expect(html).not.toContain('理解问题');
  });

  it('renders approval card without changing the message contract', () => {
    const html = renderToStaticMarkup(
      <AssistantMessage
        message={{
          role: 'assistant',
          content: 'run_terminal 需要人工审批',
          approvalPending: true
        }}
      />
    );

    expect(html).toContain('等待人工审批');
    expect(html).toContain('执行');
    expect(html).toContain('取消');
    expect(html).toContain('codex-approval-card');
  });

  it('does not throw when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copyMessageText('可复制内容')).resolves.toBe(false);
  });
});
