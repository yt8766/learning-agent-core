import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { buildCodexChatStreamUrl, closeEventSource } from '../src/runtime/codex-chat-stream';
import { CodexChatShell } from '../src/components/codex-chat-shell';

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
    Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    ConfigProvider: Container,
    Dropdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Input,
    Modal
  };
});

vi.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span />,
  DeleteOutlined: () => <span />,
  EditOutlined: () => <span />,
  MoreOutlined: () => <span />,
  PlusOutlined: () => <span />,
  RadarChartOutlined: () => <span />
}));

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
  Sender: ({ placeholder }: { placeholder?: string }) => <textarea placeholder={placeholder} />,
  Welcome: ({ title }: { title?: ReactNode }) => <section>{title}</section>,
  XProvider: ({ children }: { children?: ReactNode }) => <>{children}</>
}));

vi.mock('../src/components/assistant-message', () => ({
  AssistantMessage: ({ message }: { message: { content: string } }) => <article>{message.content}</article>
}));

describe('CodexChatShell', () => {
  it('renders the empty conversation welcome copy', () => {
    const html = renderToStaticMarkup(<CodexChatShell />);

    expect(html).toContain('Codex Chat');
    expect(html).toContain('我是 Codex Chat，很高兴见到你。');
    expect(html).toContain('给 Codex 一个任务，按 Enter 发送');
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
