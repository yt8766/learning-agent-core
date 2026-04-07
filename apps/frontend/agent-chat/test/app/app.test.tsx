import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/chat-home/chat-home-page', () => ({
  ChatHomePage: () => <div>chat-home-page-body</div>
}));

describe('agent-chat app shell', () => {
  it('renders chat home page', async () => {
    const { default: App } = await import('@/app/app');
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('chat-home-page-body');
  });
});
