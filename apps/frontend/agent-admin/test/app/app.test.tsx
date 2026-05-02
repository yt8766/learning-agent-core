import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/dashboard/dashboard-page', () => ({
  DashboardPage: () => <div>dashboard-page-body</div>
}));

function renderAppAt(pathname: string, hash = '') {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { hash, pathname }
  });
  return renderRouterAt(pathname);
}

async function renderRouterAt(pathname: string) {
  const { adminRoutes } = await import('@/app/admin-routes');
  function TestAdminRoutes() {
    return useRoutes(adminRoutes);
  }
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <TestAdminRoutes />
    </MemoryRouter>
  );
}

async function authenticateAdmin() {
  const { adminAuthStore } = await import('@/pages/auth/store/admin-auth-store');
  adminAuthStore.setAuthenticated(
    {
      id: 'admin_001',
      username: 'admin',
      displayName: '平台管理员',
      roles: ['super_admin'],
      status: 'enabled'
    },
    {
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-04-30T12:15:00.000Z',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
    },
    { persist: false }
  );
}

describe('agent-admin app shell', () => {
  afterEach(async () => {
    const { adminAuthStore } = await import('@/pages/auth/store/admin-auth-store');
    adminAuthStore.clear('anonymous');
  });

  it('renders the branded Chinese admin login page only on /login before authentication', async () => {
    const html = await renderAppAt('/login');

    expect(html).toContain('Agent 管理台');
    expect(html).toContain('Agent 管理台标识');
    expect(html).toContain('登入');
    expect(html).toContain('请在下方输入您的账号和密码登录后台。');
    expect(html).toContain('账号');
    expect(html).toContain('请输入账号');
    expect(html).toContain('密码');
    expect(html).toContain('显示密码');
    expect(html).toContain('点击登录，即表示您同意我们的');
    expect(html).toContain('服务条款');
    expect(html).toContain('隐私政策');
    expect(html).not.toContain('登录管理后台');
    expect(html).not.toContain('Shadcn 管理员');
    expect(html).not.toContain('电子邮件');
    expect(html).not.toContain('GitHub');
    expect(html).not.toContain('Facebook');
    expect(html).not.toContain('立即注册');
    expect(html).toContain('min-h-screen');
  });

  it('normalizes /login URLs that still carry legacy dashboard hashes before rendering login', async () => {
    const html = await renderAppAt('/login', '#/learning');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('redirects protected admin routes to /login before authentication without rendering 401', async () => {
    const html = await renderAppAt('/');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('401');
    expect(html).not.toContain('Unauthorized Access');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('normalizes authenticated /login hash URLs back to the dashboard root', async () => {
    await authenticateAdmin();
    const html = await renderAppAt('/login', '#/learning');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('Agent 管理台标识');
    expect(html).not.toContain('dashboard-page-body');
  });

  it('renders authenticated dashboard center paths without hash routing', async () => {
    await authenticateAdmin();
    const html = await renderAppAt('/learning');

    expect(html).toContain('dashboard-page-body');
    expect(html).not.toContain('404');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('declares protected admin center paths through React Router route objects', async () => {
    await authenticateAdmin();
    const html = await renderRouterAt('/approvals');

    expect(html).toContain('dashboard-page-body');
    expect(html).not.toContain('404');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 401 error page on /401', async () => {
    const html = await renderAppAt('/401');

    expect(html).toContain('401');
    expect(html).toContain('Unauthorized Access');
    expect(html).toContain('Please log in with the appropriate credentials');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 403 error page on /403', async () => {
    const html = await renderAppAt('/403');

    expect(html).toContain('403');
    expect(html).toContain('Access Forbidden');
    expect(html).toContain('You don&#x27;t have necessary permission');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 404 error page for unknown routes', async () => {
    const html = await renderAppAt('/missing-admin-route');

    expect(html).toContain('404');
    expect(html).toContain('Oops! Page Not Found!');
    expect(html).toContain('It seems like the page you&#x27;re looking for');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 500 error page on /500', async () => {
    const html = await renderAppAt('/500');

    expect(html).toContain('500');
    expect(html).toContain('Oops! Something went wrong :&#x27;)');
    expect(html).toContain('We apologize for the inconvenience.');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 503 maintenance page on /503', async () => {
    const html = await renderAppAt('/503');

    expect(html).toContain('503');
    expect(html).toContain('Website is under maintenance!');
    expect(html).toContain('The site is not available at the moment.');
    expect(html).toContain('Learn more');
    expect(html).not.toContain('Back to Home');
  });
});
