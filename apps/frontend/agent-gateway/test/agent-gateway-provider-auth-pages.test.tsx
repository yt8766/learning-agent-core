import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthFilesManagerPage } from '../src/app/pages/AuthFilesManagerPage';
import {
  buildCallbackPlaceholder,
  navigateOAuthLoginWindow,
  OAuthPolicyPage,
  openOAuthLoginWindow,
  refreshFirstOAuthStatus,
  startOAuthProviderLogin,
  submitOAuthCallbackUrl
} from '../src/app/pages/OAuthPolicyPage';
import { ProviderConfigPage, buildProviderConfigRecord } from '../src/app/pages/ProviderConfigPage';
import type { GatewayProviderCredential, GatewayProviderSpecificConfigRecord } from '@agent/core';

describe('Agent Gateway provider and auth management pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders provider config surfaces for compatible discovery and Ampcode mappings', () => {
    const html = renderToStaticMarkup(
      <ProviderConfigPage
        onRefreshModels={() => undefined}
        onSaveProvider={() => undefined}
        onTestModel={() => undefined}
      />
    );

    expect(html).toContain('AI 提供商');
    expect(html).toContain('provider-config-clone');
    expect(html).toContain('provider-empty-state');
    expect(html).toContain('provider-floating-nav');
    expect(html).toContain('Gemini API 密钥');
    expect(html).toContain('Codex API 配置');
    expect(html).toContain('Claude API 配置');
    expect(html).toContain('暂无Gemini密钥');
    expect(html).toContain('暂无Codex配置');
    expect(html).toContain('Gemini');
    expect(html).toContain('Codex');
    expect(html).toContain('Claude');
    expect(html).toContain('Vertex');
    expect(html).toContain('OpenAI 兼容');
    expect(html).toContain('Ampcode 桥接');
    expect(html).toContain('添加密钥');
    expect(html).toContain('添加配置');
    expect(html).toContain('导入配置');
  });

  it('renders provider configs returned by agent-server instead of only empty placeholders', () => {
    const html = renderToStaticMarkup(
      <ProviderConfigPage
        configs={{
          items: [
            {
              providerType: 'gemini',
              id: 'gemini-primary',
              displayName: 'Gemini Primary',
              enabled: true,
              baseUrl: null,
              models: [{ name: 'gemini-2.5-pro', alias: 'gemini-pro' }],
              excludedModels: [],
              credentials: [
                {
                  credentialId: 'gemini-key-1',
                  apiKeyMasked: 'AIza***demo',
                  status: 'valid'
                }
              ]
            }
          ]
        }}
      />
    );

    expect(html).toContain('Gemini Primary');
    expect(html).toContain('gemini-2.5-pro');
    expect(html).toContain('gemini-pro');
    expect(html).toContain('AIza***demo');
    expect(html).not.toContain('暂无Gemini密钥');
  });

  it('builds provider config updates from editable drafts in a stable way', () => {
    const baseConfig: GatewayProviderSpecificConfigRecord = {
      providerType: 'gemini',
      id: 'gemini-config-1',
      displayName: 'Gemini 主配置',
      enabled: true,
      baseUrl: null,
      prefix: '/v1',
      priority: 5,
      headers: { Authorization: 'Bearer old' },
      models: [
        {
          name: 'gemini-2.5-flash',
          alias: 'flash'
        }
      ],
      excludedModels: ['text-bad'],
      credentials: [
        {
          credentialId: 'cred-1',
          apiKeyMasked: 'sk-***',
          status: 'valid'
        } as GatewayProviderCredential
      ],
      testModel: 'gemini-2.5-pro',
      authIndex: 'primary'
    };

    const next = buildProviderConfigRecord(baseConfig, {
      displayName: 'Gemini 主配置-v2',
      enabled: false,
      baseUrl: '',
      prefix: '/new',
      proxyUrl: '',
      priority: '10',
      authIndex: '2',
      testModel: 'gemini-2.5-flash',
      modelsText: 'gemini-2.5-pro -> pro\nopenai-compatible',
      excludedModelsText: 'x\ny',
      headersText: '{"Content-Type":"application/json"}'
    });

    expect(next).toEqual(
      expect.objectContaining({
        id: 'gemini-config-1',
        providerType: 'gemini',
        displayName: 'Gemini 主配置-v2',
        enabled: false,
        baseUrl: null,
        prefix: '/new',
        authIndex: '2',
        testModel: 'gemini-2.5-flash',
        priority: 10,
        excludedModels: ['x', 'y'],
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    expect(next.models).toEqual([{ name: 'gemini-2.5-pro', alias: 'pro' }, { name: 'openai-compatible' }]);
  });

  it('renders auth file manager controls for batch operations and list modes', () => {
    const html = renderToStaticMarkup(
      <AuthFilesManagerPage
        onBatchDelete={() => undefined}
        onBatchDownload={() => undefined}
        onBatchUpload={() => undefined}
        onListModels={() => undefined}
        onPatchFields={() => undefined}
        onToggleStatus={() => undefined}
      />
    );

    expect(html).toContain('认证文件');
    expect(html).toContain('auth-files-clone');
    expect(html).toContain('auth-filter-rail');
    expect(html).toContain('暂无认证文件');
    expect(html).toContain('provider-empty-state');
    expect(html).toContain('点击批量上传导入 OAuth 或服务账号 JSON。');
    expect(html).toContain('批量上传');
    expect(html).toContain('批量下载');
    expect(html).toContain('批量删除');
    expect(html).toContain('状态切换');
    expect(html).toContain('字段修补');
    expect(html).toContain('模型列举');
    expect(html).toContain('筛选');
    expect(html).toContain('搜索');
    expect(html).toContain('分页');
    expect(html).toContain('紧凑');
    expect(html).toContain('关系图');
  });

  it('renders OAuth model alias section for auth files', () => {
    const html = renderToStaticMarkup(
      <AuthFilesManagerPage
        onBatchDelete={() => undefined}
        onBatchDownload={() => undefined}
        onBatchUpload={() => undefined}
        onListModels={() => undefined}
        onPatchFields={() => undefined}
        onSaveOAuthAliases={() => undefined}
        onLoadOAuthAliases={() => undefined}
        onToggleStatus={() => undefined}
      />
    );

    expect(html).toContain('OAuth 模型别名');
    expect(html).toContain('暂无可配置的 OAuth Provider');
  });

  it('renders auth files returned by agent-server', () => {
    const html = renderToStaticMarkup(
      <AuthFilesManagerPage
        authFiles={{
          items: [
            {
              id: 'gemini-oauth-prod',
              providerId: 'gemini',
              providerKind: 'gemini',
              fileName: 'gemini-oauth-prod.json',
              path: '/auth/gemini-oauth-prod.json',
              status: 'valid',
              accountEmail: 'agent@example.com',
              projectId: 'agent-project',
              authIndex: 'gemini-oauth-prod.json',
              disabled: true,
              modelCount: 12,
              note: 'primary oauth credential',
              prefix: '/v1',
              priority: 9,
              proxyUrl: 'socks5://127.0.0.1:1080',
              updatedAt: '2026-05-08T00:00:00.000Z'
            }
          ],
          nextCursor: null
        }}
      />
    );

    expect(html).toContain('gemini-oauth-prod.json');
    expect(html).toContain('agent@example.com');
    expect(html).toContain('agent-project');
    expect(html).toContain('12 models');
    expect(html).toContain('已停用');
    expect(html).toContain('/v1');
    expect(html).toContain('socks5://127.0.0.1:1080');
    expect(html).toContain('primary oauth credential');
  });

  it('renders the supported OAuth login providers and hides removed login modes', () => {
    const html = renderToStaticMarkup(
      <OAuthPolicyPage
        onAddExcludedModel={() => undefined}
        onCreateAlias={() => undefined}
        onForkAlias={() => undefined}
        onRefreshStatus={() => undefined}
        onStartCallbackPolling={() => undefined}
      />
    );

    expect(html).toContain('OAuth 登录');
    expect(html).toContain('oauth-login-clone');
    expect(html).toContain('oauth-card-grid');
    expect(html).toContain('Codex OAuth 登录');
    expect(html).toContain('Anthropic OAuth 登录');
    expect(html).toContain('Antigravity OAuth 登录');
    expect(html).toContain('Gemini CLI OAuth 登录');
    expect(html).toContain('Kimi OAuth 登录');
    expect(html).not.toContain('Vertex JSON 登录');
    expect(html).toContain('Google Cloud 项目 ID (可选)');
    expect(html).not.toContain('选择文件');
    expect(html).not.toContain('授权链接将在开始登录后显示');
    expect(html).not.toContain('回调 URL');
    expect(html).not.toContain('提交回调 URL');
  });

  it('uses provider-native localhost callback placeholders for remote browser OAuth handoff', () => {
    expect(buildCallbackPlaceholder('codex')).toBe('http://localhost:1455/auth/callback?code=...&state=...');
    expect(buildCallbackPlaceholder('claude')).toBe('http://localhost:54545/callback?code=...&state=...');
    expect(buildCallbackPlaceholder('antigravity')).toBe('http://localhost:51121/oauth-callback?code=...&state=...');
    expect(buildCallbackPlaceholder('gemini-cli')).toBe('http://localhost:8085/oauth2callback?code=...&state=...');
  });

  it('opens an OAuth popup synchronously and navigates it after the auth URL is returned', () => {
    const popup = { closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi.fn().mockReturnValue(popup);
    vi.stubGlobal('window', { open });

    const opened = openOAuthLoginWindow();
    navigateOAuthLoginWindow(opened, 'https://auth.example.com/oauth');

    expect(open).toHaveBeenCalledWith('about:blank', '_blank', 'popup=yes,width=1080,height=820');
    expect(popup.location.href).toBe('https://auth.example.com/oauth');
  });

  it('keeps OAuth callback controls collapsed until a provider login has started', () => {
    const html = renderToStaticMarkup(<OAuthPolicyPage />);

    expect(html).toContain('开始 Codex 登录');
    expect(html).not.toContain('Codex 授权链接');
    expect(html).not.toContain('提交回调 URL');
    expect(html).not.toContain('刷新状态');
    expect(html).not.toContain('readOnly');
    expect(html).not.toContain('readonly');
  });

  it('reports a visible OAuth start error when start callbacks are missing', async () => {
    const updates: unknown[] = [];
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };

    await startOAuthProviderLogin({
      providerId: 'codex',
      providerState: {},
      updateProviderState: next => updates.push(next),
      popup: popup as unknown as Window
    });

    expect(updates).toContainEqual(
      expect.objectContaining({
        error: 'OAuth start callback is not wired.',
        status: 'error'
      })
    );
    expect(updates).not.toContainEqual(expect.objectContaining({ status: 'idle' }));
    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it('reports a visible callback submit error when the submit callback is missing', async () => {
    const updates: unknown[] = [];

    await submitOAuthCallbackUrl({
      providerId: 'codex',
      redirectUrl: 'http://localhost:1455/auth/callback?code=ok&state=codex',
      updateProviderState: next => updates.push(next)
    });

    expect(updates).toContainEqual(
      expect.objectContaining({
        callbackError: 'OAuth callback submit handler is not wired.',
        callbackStatus: 'error',
        callbackSubmitting: false
      })
    );
    expect(updates).not.toContainEqual(expect.objectContaining({ callbackStatus: 'success' }));
  });

  it('reports fallback OAuth status polling failures when no provider has an active state', async () => {
    const updates: unknown[] = [];

    await refreshFirstOAuthStatus({
      providerStates: {},
      onRefreshStatus: vi.fn().mockRejectedValue(new Error('status unavailable')),
      refreshProviderStatus: vi.fn(),
      updateProviderState: (providerId, next) => updates.push({ providerId, ...next })
    });

    expect(updates).toContainEqual({
      providerId: 'codex',
      error: 'status unavailable',
      status: 'error'
    });
  });
});
