import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { adminRoutes } from '@/app/admin-routes';
import { adminAuthStore } from '@/pages/auth/store/admin-auth-store';
import { useAgentGatewayStore } from '@/pages/agent-gateway/agent-gateway-store';

function renderAdminRoute(pathname: string) {
  function TestAdminRoutes() {
    return useRoutes(adminRoutes);
  }

  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <TestAdminRoutes />
    </MemoryRouter>
  );
}

function authenticateAdmin() {
  adminAuthStore.setAuthenticated(
    {
      id: 'admin-gateway-test',
      username: 'gateway-admin',
      displayName: 'Agent Gateway 管理员',
      roles: ['super_admin'],
      status: 'enabled'
    },
    {
      tokenType: 'Bearer',
      accessToken: 'gateway-access-token',
      accessTokenExpiresAt: '2026-05-30T12:15:00.000Z',
      refreshToken: 'gateway-refresh-token',
      refreshTokenExpiresAt: '2026-06-30T12:00:00.000Z'
    },
    { persist: false }
  );
}

describe('agent gateway admin routes', () => {
  beforeEach(() => {
    adminAuthStore.clear();
    useAgentGatewayStore.setState({ authFileFilter: 'AgentFlow', configTab: 'visual' });
    authenticateAdmin();
  });

  it('renders the Agent Gateway dashboard at the root route', () => {
    const markup = renderAdminRoute('/');

    expect(markup).toContain('AGMC');
    expect(markup).not.toContain('CPAMC');
    expect(markup).toContain('欢迎回来');
    expect(markup).toContain('系统概览');
  });

  it('renders exactly seven white-sidebar navigation options with local naming', () => {
    const markup = renderAdminRoute('/system');

    expect(markup.match(/data-gateway-nav-item=/g)).toHaveLength(7);
    expect(markup).toContain('仪表盘');
    expect(markup).toContain('配置面板');
    expect(markup).toContain('AI提供商');
    expect(markup).toContain('认证文件');
    expect(markup).toContain('OAuth登录');
    expect(markup).toContain('配额管理');
    expect(markup).toContain('中心信息');
  });

  it.each([
    ['/ai-providers', 'AI 提供商配置'],
    ['/auth-files', '认证文件管理'],
    ['/oauth', 'OAuth登录'],
    ['/quota', '配额管理'],
    ['/system', '中心信息']
  ])('renders %s as a gateway management page', (path, heading) => {
    const markup = renderAdminRoute(path);

    expect(markup).toContain('AGMC');
    expect(markup).toContain(heading);
  });

  it('uses the Agent Gateway zustand store for page UI state', () => {
    useAgentGatewayStore.setState({ authFileFilter: 'Codex', configTab: 'source' });

    const configMarkup = renderAdminRoute('/config');
    const authFilesMarkup = renderAdminRoute('/auth-files');

    expect(configMarkup).toContain('配置编辑模式');
    expect(authFilesMarkup).toContain('Codex');
    expect(useAgentGatewayStore.getState().configTab).toBe('source');
    expect(useAgentGatewayStore.getState().authFileFilter).toBe('Codex');
  });
});
