import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, KnowledgeRoutes, resolvePostLoginPath, resolveViewFromPath } from '../src/app/App';
import { AuthProvider } from '../src/pages/auth/auth-provider';
import { installLocalStorageMock } from './local-storage-mock';

describe('Knowledge App shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the login gate at the canonical login route when no tokens are stored', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).toContain('Knowledge');
    expect(html).toContain('登录');
    expect(html).toContain('账号');
    expect(html).not.toContain('dev@example.com');
    expect(html).not.toContain('secret');
  });

  it('keeps unauthenticated protected paths from rendering the authenticated workspace', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/knowledge-bases']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).not.toContain('知识库控制台');
    expect(html).not.toContain('知识库治理驾驶舱');
  });

  it('redirects authenticated login visits back to the workspace instead of the 404 route', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).not.toContain('404');
    expect(html).not.toContain('抱歉，您访问的页面不存在。');
  });

  it('renders the authenticated workspace navigation when tokens exist', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('ProUser');
    expect(html).toContain('Knowledge');
    expect(html).toContain('知识库控制台');
    expect(html).toContain('总览');
    expect(html).toContain('Knowledge 运行总览');
    expect(html).toContain('知识库治理驾驶舱');
    expect(html).toContain('检索质量');
    expect(html).toContain('检索质量趋势');
    expect(html).toContain('文档摄取趋势');
    expect(html).toContain('文档摄取');
    expect(html).toContain('治理策略');
    expect(html).toContain('知识库');
    expect(html).toContain('文档');
    expect(html).toContain('对话实验室');
    expect(html).toContain('观测中心');
    expect(html).toContain('评测中心');
    expect(html).toContain('设置');
    expect(html).toContain('个人设置');
    expect(html).toContain('退出登录');
    expect(html).not.toContain('主题设置');
    expect(html).not.toContain('异常页');
    expect(html).not.toContain('exception403');
    expect(html).not.toContain('exception404');
    expect(html).not.toContain('exception500');
    expect(html).not.toContain('管理页');
    expect(html).not.toContain('基础表单');
    expect(html).not.toContain('Ant Design Pro Cheatsheet');
    expect(html).not.toContain('欢迎使用 Ant Design Pro V6');
    expect(html).not.toContain('github.com/ant-design/ant-design-pro');
    expect(html).not.toContain('data-menu-id="rc-menu-uuid-ai"');
    expect(html).not.toContain('data-menu-id="rc-menu-uuid-welcome"');
    expect(html).not.toContain('aria-label="源码"');
    expect(html).not.toContain('aria-label="语言"');
  });

  it('does not map exception routes into a sidebar navigation item', () => {
    expect(resolveViewFromPath('/exception/403')).toBeUndefined();
    expect(resolveViewFromPath('/exception/404')).toBeUndefined();
    expect(resolveViewFromPath('/exception/500')).toBeUndefined();
    expect(resolveViewFromPath('/missing-page')).toBeUndefined();
  });

  it('resolves the post-login destination from protected route state', () => {
    expect(resolvePostLoginPath({ from: { pathname: '/knowledge-bases' } })).toBe('/knowledge-bases');
    expect(resolvePostLoginPath({ from: { pathname: '/login' } })).toBe('/');
    expect(resolvePostLoginPath(undefined)).toBe('/');
  });
});
