import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { installLocalStorageMock } from './local-storage-mock';

describe('Knowledge App shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the login gate when no tokens are stored', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Knowledge');
    expect(html).toContain('登录');
  });

  it('renders the authenticated workspace navigation when tokens exist', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('总览');
    expect(html).toContain('知识库');
    expect(html).toContain('对话实验室');
    expect(html).toContain('评测中心');
  });
});
