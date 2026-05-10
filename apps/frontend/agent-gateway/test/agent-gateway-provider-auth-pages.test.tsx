import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthFilesManagerPage } from '../src/app/pages/AuthFilesManagerPage';
import { OAuthPolicyPage } from '../src/app/pages/OAuthPolicyPage';
import { ProviderConfigPage } from '../src/app/pages/ProviderConfigPage';

describe('Agent Gateway provider and auth management pages', () => {
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
    expect(html).toContain('auth-file-card');
    expect(html).toContain('Gemini OAuth');
    expect(html).toContain('Codex 会话');
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
              modelCount: 12,
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
    expect(html).toContain('Claude OAuth 登录');
    expect(html).toContain('Antigravity OAuth 登录');
    expect(html).toContain('Kimi OAuth 登录');
    expect(html).not.toContain('Gemini CLI OAuth 登录');
    expect(html).not.toContain('Vertex JSON 登录');
    expect(html).not.toContain('Project ID');
    expect(html).not.toContain('选择文件');
    expect(html).not.toContain('授权链接将在开始登录后显示');
    expect(html).not.toContain('Callback URL');
    expect(html).not.toContain('提交回调 URL');
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
});
