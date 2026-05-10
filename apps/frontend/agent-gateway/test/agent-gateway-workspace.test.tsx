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
          activeView="overview"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('总览');
    expect(html).toContain('上游方');
    expect(html).toContain('认证文件');
    expect(html).toContain('配额');
    expect(html).toContain('调用管线');
    expect(html).toContain('日志与探测');
    expect(html).toContain('连接');
    expect(html).toContain('配置');
    expect(html).toContain('API Keys');
    expect(html).toContain('Provider Config');
    expect(html).toContain('Auth Files');
    expect(html).toContain('OAuth Policy');
    expect(html).toContain('系统');
    expect(html).toContain('OpenAI');
  });

  it('renders page navigation as router links', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/gateway/logs']}>
        <GatewayWorkspace
          activeView="logs"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('href="/gateway/dashboard"');
    expect(html).toContain('href="/gateway/logs"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('<button aria-current="page"');
  });

  it('renders the restored visual shell with icon navigation landmarks', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/gateway']}>
        <GatewayWorkspace
          activeView="overview"
          onActiveViewChange={() => undefined}
          onLogout={() => undefined}
          snapshot={snapshot}
          logs={{ items: [] }}
          usage={{ items: [] }}
        />
      </MemoryRouter>
    );

    expect(html).toContain('gateway-shell-restored');
    expect(html).toContain('gateway-brand-mark');
    expect(html).toContain('view-nav-icon');
    expect(html).toContain('workspace-observer-strip');
  });

  it.each([
    ['connection', 'Management API'],
    ['config', 'config.yaml'],
    ['apiKeys', 'sk-***abc'],
    ['providers', 'https://api.openai.com/v1'],
    ['providerConfig', 'Ampcode'],
    ['credentials', '.env'],
    ['authFilesManager', 'Batch upload'],
    ['oauthPolicy', 'Fork alias'],
    ['quotas', '10 / 100 tokens'],
    ['pipeline', 'Accounting'],
    ['logs', 'Logs Manager'],
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

  it.each([
    ['providers', '保存上游方'],
    ['credentials', '保存认证文件'],
    ['quotas', '保存配额']
  ] satisfies Array<[GatewayViewId, string]>)('renders write controls for %s center', (activeView, expectedText) => {
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
  });

  it('renders OAuth lifecycle actions in credential files center', () => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="credentials"
        onActiveViewChange={() => undefined}
        onLogout={() => undefined}
        snapshot={snapshot}
        logs={{ items: [] }}
        usage={{ items: [] }}
      />
    );

    expect(html).toContain('开始授权');
    expect(html).toContain('完成授权');
    expect(html).toContain('刷新状态');
  });

  it('renders workflow controls for destructive and async operations', () => {
    const html = renderToStaticMarkup(
      <GatewayWorkspace
        activeView="overview"
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
