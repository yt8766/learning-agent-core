import { readFileSync } from 'node:fs';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, KnowledgeRoutes, pathByView, resolvePostLoginPath, resolveViewFromPath } from '../src/app/App';
import { KnowledgeApiProvider } from '../src/api/knowledge-api-provider';
import { MockKnowledgeApiClient } from '../src/api/mock-knowledge-api-client';
import { AuthProvider } from '../src/pages/auth/auth-provider';
import { installLocalStorageMock } from './local-storage-mock';

vi.mock('@ant-design/x-markdown', () => ({
  default({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  }
}));

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

  it('renders the knowledge login page with display-only auxiliary login options', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).toContain('RAG 企业知识库');
    expect(html).toContain('欢迎登录');
    expect(html).toContain('请输入账号 / 邮箱');
    expect(html).toContain('请输入密码');
    expect(html).toContain('首次使用请联系管理员开通账号');
    expect(html).toContain('记住我');
    expect(html).toContain('忘记密码？');
    expect(html).toContain('其他登录方式');
    expect(html).toContain('钉钉登录');
    expect(html).toContain('飞书登录');
    expect(html).toContain('企业微信登录');
    expect(html).toContain('aria-label="账号"');
    expect(html).toContain('aria-label="密码"');
    expect(html).not.toContain('账号密码登录');
    expect(html).not.toContain('短信验证码登录');
    expect(html).not.toContain('中文 / EN');
    expect(html).not.toContain('验证码');
    expect(html).not.toContain('SSO 单点登录');
  });

  it('keeps the login brand header fixed while the page scrolls', () => {
    const css = readFileSync(new URL('../src/pages/auth/login-page.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.knowledge-login-header\s*\{[^}]*position:\s*fixed;/s);
    expect(css).toMatch(/\.knowledge-login-wrap\s*\{[^}]*padding:\s*140px 46px 40px;/s);
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
    expect(html).toContain('智能代理');
    expect(html).toContain('用户管理');
    expect(html).toContain('对话实验室');
    expect(html).toContain('观测中心');
    expect(html).toContain('评测中心');
    expect(html).toContain('系统设置');
    expect(html).toContain('模型配置');
    expect(html).toContain('API 密钥');
    expect(html).toContain('存储管理');
    expect(html).toContain('安全策略');
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

  it('maps users and settings subroutes into their sidebar views', () => {
    expect(pathByView.users).toBe('/users');
    expect(pathByView.settingsModels).toBe('/settings/models');
    expect(pathByView.settingsKeys).toBe('/settings/keys');
    expect(pathByView.settingsStorage).toBe('/settings/storage');
    expect(pathByView.settingsSecurity).toBe('/settings/security');

    expect(resolveViewFromPath('/users')).toBe('users');
    expect(resolveViewFromPath('/settings/models')).toBe('settingsModels');
    expect(resolveViewFromPath('/settings/keys')).toBe('settingsKeys');
    expect(resolveViewFromPath('/settings/storage')).toBe('settingsStorage');
    expect(resolveViewFromPath('/settings/security')).toBe('settingsSecurity');
  });

  it('renders knowledge governance pages for users and settings subroutes', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const cases = [
      { path: '/users', expected: ['用户管理', '邀请用户', '知识库权限'] },
      { path: '/settings/models', expected: ['模型配置', '添加提供商'] },
      { path: '/settings/keys', expected: ['API 密钥', '新建密钥'] },
      { path: '/settings/storage', expected: ['存储管理', '存储后端'] },
      { path: '/settings/security', expected: ['安全策略', '安全评分', '访问与审计'] }
    ];

    for (const item of cases) {
      const html = renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <KnowledgeApiProvider api={new MockKnowledgeApiClient()}>
            <AuthProvider>
              <MemoryRouter initialEntries={[item.path]}>
                <KnowledgeRoutes />
              </MemoryRouter>
            </AuthProvider>
          </KnowledgeApiProvider>
        </QueryClientProvider>
      );

      for (const expected of item.expected) {
        expect(html).toContain(expected);
      }
    }
  });

  it('renders the Chat Lab as an AI assistant experiment surface', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <KnowledgeApiProvider api={new MockKnowledgeApiClient()}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/chat-lab']}>
              <KnowledgeRoutes />
            </MemoryRouter>
          </AuthProvider>
        </KnowledgeApiProvider>
      </QueryClientProvider>
    );

    expect(html).toContain('你好，我是 Knowledge');
    expect(html).not.toContain('你好，我是 Kimi');
    expect(html).not.toContain('深度思考');
    expect(html).not.toContain('联网搜索');
  });

  it('resolves the post-login destination from protected route state', () => {
    expect(resolvePostLoginPath({ from: { pathname: '/knowledge-bases' } })).toBe('/knowledge-bases');
    expect(resolvePostLoginPath({ from: { pathname: '/login' } })).toBe('/');
    expect(resolvePostLoginPath(undefined)).toBe('/');
  });
});
