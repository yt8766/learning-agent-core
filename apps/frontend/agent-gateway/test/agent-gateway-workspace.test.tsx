import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { GatewaySnapshot } from '@agent/core';
import { describe, expect, it } from 'vitest';
import { GatewayWorkspace } from '../src/app/GatewayWorkspace';
import type { GatewayViewId } from '../src/app/gateway-view-model';

describe('Agent Gateway workspace', () => {
  it('renders all operational centers from loaded gateway data', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/gateway']}>
        <GatewayWorkspace
          activeView="dashboard"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('仪表盘');
    expect(html).toContain('调用方管理');
    expect(html).toContain('配置面板');
    expect(html).toContain('AI提供商');
    expect(html).toContain('认证文件');
    expect(html).toContain('OAuth登录');
    expect(html).toContain('配额管理');
    expect(html).toContain('中心信息');
    expect(html).not.toContain('API Keys');
    expect(html).not.toContain('日志与探测');
  });

  it('renders page navigation as router links', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/auth-files']}>
        <GatewayWorkspace
          activeView="authFiles"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/auth-files"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('<button aria-current="page"');
  });

  it('renders the restored visual shell with icon navigation landmarks', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/gateway']}>
        <GatewayWorkspace
          activeView="dashboard"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('gateway-shell-restored');
    expect(html).toContain('pure-white-shell');
    expect(html).toContain('gateway-brand-mark');
    expect(html).toContain('view-nav-icon');
    expect(html).toContain('workspace-observer-strip');
  });

  it.each([
    ['config', 'config.yaml'],
    ['clients', 'Acme Runtime'],
    ['aiProviders', 'Ampcode'],
    ['authFiles', '批量上传'],
    ['oauth', 'Fork 别名'],
    ['quota', '10 / 100 tokens'],
    ['system', 'gpt-main']
  ] satisfies Array<[GatewayViewId, string]>)('renders %s center details', (activeView, expectedText) => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView={activeView}
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{
          items: [
            {
              id: 'log-1',
              occurredAt: '2026-05-08T00:01:00.000Z',
              level: 'info',
              stage: 'proxy',
              provider: 'OpenAI',
              message: 'relay ok',
              inputTokens: 4,
              outputTokens: 8
            }
          ]
        }}
        usage={{
          items: [
            {
              id: 'usage-1',
              provider: 'OpenAI',
              date: '2026-05-08',
              requestCount: 1,
              inputTokens: 4,
              outputTokens: 8,
              estimatedCostUsd: 0.01
            }
          ]
        }}
        apiKeys={{
          items: [
            {
              id: 'proxy-key-0',
              name: 'Proxy key 1',
              prefix: 'sk-***abc',
              status: 'active',
              scopes: ['proxy:invoke'],
              createdAt: '2026-05-08T00:00:00.000Z',
              lastUsedAt: null,
              expiresAt: null,
              usage: { requestCount: 0, lastRequestAt: null }
            }
          ]
        }}
        clients={[
          {
            id: 'client-acme',
            name: 'Acme Runtime',
            status: 'active',
            tags: ['internal'],
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z'
          }
        ]}
        clientQuotas={{
          'client-acme': {
            clientId: 'client-acme',
            period: 'monthly',
            tokenLimit: 100,
            requestLimit: 10,
            usedTokens: 10,
            usedRequests: 1,
            resetAt: '2026-06-01T00:00:00.000Z',
            status: 'normal'
          }
        }}
        clientApiKeys={{
          'client-acme': {
            items: [
              {
                id: 'key-client-acme-runtime',
                clientId: 'client-acme',
                name: 'runtime',
                prefix: 'agp_live',
                status: 'active',
                scopes: ['models.read', 'chat.completions'],
                createdAt: '2026-05-10T00:00:00.000Z',
                expiresAt: null,
                lastUsedAt: null
              }
            ]
          }
        }}
        clientLogs={{ 'client-acme': { items: [] } }}
        rawConfig={{ content: 'debug: true\n', format: 'yaml', version: 'config-1' }}
        systemInfo={{
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }}
        modelGroups={[
          {
            providerId: 'OpenAI',
            providerKind: 'custom',
            models: [{ id: 'gpt-main', displayName: 'gpt-main', providerKind: 'custom', available: true }]
          }
        ]}
      />
    );

    expect(html).toContain(expectedText);
  });

  it.each([['quota', '保存配额']] satisfies Array<[GatewayViewId, string]>)(
    'renders write controls for %s center',
    (activeView, expectedText) => {
      const html = renderToStaticMarkup(
        <GatewayWorkspace
          activeView={activeView}
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      );

      expect(html).toContain(expectedText);
      expect(html).toContain('删除');
    }
  );

  it('renders auth file manager lifecycle actions in auth files center', () => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="authFiles"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{ items: [] }}
        usage={{ items: [] }}
      />
    );

    expect(html).toContain('批量上传');
    expect(html).toContain('状态切换');
    expect(html).toContain('模型列举');
  });

  it('passes agent-server provider configs and auth files into restored management pages', () => {
    const providerHtml = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="aiProviders"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{ items: [] }}
        usage={{ items: [] }}
        providerConfigs={{
          items: [
            {
              providerType: 'codex',
              id: 'codex-main',
              displayName: 'Codex Main',
              enabled: true,
              baseUrl: null,
              models: [{ name: 'codex-mini' }],
              excludedModels: [],
              credentials: [{ credentialId: 'codex-session', authIndex: 'codex-auth.json', status: 'valid' }]
            }
          ]
        }}
      />
    );
    const authHtml = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="authFiles"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{ items: [] }}
        usage={{ items: [] }}
        authFiles={{
          items: [
            {
              id: 'codex-auth',
              providerId: 'codex',
              providerKind: 'codex',
              fileName: 'codex-auth.json',
              path: '/auth/codex-auth.json',
              status: 'valid',
              accountEmail: 'codex@example.com',
              projectId: null,
              modelCount: 8,
              updatedAt: '2026-05-08T00:00:00.000Z'
            }
          ],
          nextCursor: null
        }}
      />
    );

    expect(providerHtml).toContain('Codex Main');
    expect(providerHtml).toContain('codex-mini');
    expect(authHtml).toContain('codex-auth.json');
    expect(authHtml).toContain('codex@example.com');
  });

  it('renders workflow controls for destructive and async operations', () => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="dashboard"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{ items: [] }}
        usage={{ items: [] }}
        notices={[{ id: 'notice-1', level: 'success', message: '保存成功' }]}
        confirmDialog={{
          title: '清空日志',
          message: '确认清空 request logs?',
          confirmLabel: '清空',
          cancelLabel: '取消'
        }}
      />
    );

    expect(html).toContain('保存成功');
    expect(html).toContain('确认清空 request logs?');
  });
});

const snapshot: GatewaySnapshot = {
  observedAt: '2026-05-08T00:00:00.000Z',
  runtime: {
    mode: 'proxy',
    status: 'healthy',
    activeProviderCount: 1,
    degradedProviderCount: 0,
    requestPerMinute: 2,
    p95LatencyMs: 120
  },
  config: {
    inputTokenStrategy: 'preprocess',
    outputTokenStrategy: 'postprocess',
    retryLimit: 2,
    circuitBreakerEnabled: true,
    auditEnabled: true
  },
  providerCredentialSets: [
    {
      id: 'openai-primary',
      provider: 'OpenAI',
      modelFamilies: ['gpt-main'],
      status: 'healthy',
      priority: 1,
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 60000
    }
  ],
  credentialFiles: [
    {
      id: 'env',
      provider: 'OpenAI',
      path: '.env',
      status: 'valid',
      lastCheckedAt: '2026-05-08T00:00:00.000Z'
    }
  ],
  quotas: [
    {
      id: 'daily',
      provider: 'OpenAI',
      scope: 'daily',
      usedTokens: 10,
      limitTokens: 100,
      resetAt: '2026-05-09T00:00:00.000Z',
      status: 'normal'
    }
  ]
};
