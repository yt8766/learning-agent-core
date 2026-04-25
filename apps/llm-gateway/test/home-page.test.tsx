import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page.js';
import type { AdminConsoleData } from '../src/admin/admin-console-data.js';
import { GatewayDashboard } from '../src/components/gateway-dashboard.js';
import { GatewayCenterPage } from '../src/components/gateway-center-pages.js';

describe('llm gateway home page', () => {
  it('renders the shadcn dashboard-01 shell with LLM Gateway operations data', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('大模型网关');
    expect(html).toContain('data-sidebar="sidebar"');
    expect(html).toContain('data-sidebar="menu-button"');
    expect(html).toContain('shadow-none');
    expect(html).not.toContain('border-black');
    expect(html).toContain('运行中枢');
    expect(html).toContain('模型中枢');
    expect(html).toContain('服务商中枢');
    expect(html).toContain('凭证中枢');
    expect(html).toContain('日志与成本');
    expect(html).toContain('连接器与策略');
    expect(html).toContain('审批中枢');
    expect(html).toContain('证据中心');
    expect(html).toContain('退出登录');
    expect(html).not.toContain('Add Model');
    expect(html).not.toContain('Provider Health');
    expect(html).not.toContain('Usage Ledger');
    expect(html).not.toContain('Today requests');
    expect(html).not.toContain('Average latency');
    expect(html).not.toContain('Failure rate');
    expect(html).toContain('今日请求');
    expect(html).toContain('平均延迟');
    expect(html).toContain('失败率');
    expect(html).toContain('请求量、延迟、失败率与兜底策略');
    expect(html).not.toContain('Acme Inc.');
    expect(html).not.toContain('Total Revenue');
    expect(html).not.toContain('Cover page');
  });

  it('renders real shadcn center pages for gateway models, providers, keys, logs, policy, approvals, and evidence', () => {
    const modelsHtml = renderToStaticMarkup(<GatewayCenterPage center="models" />);
    const providersHtml = renderToStaticMarkup(<GatewayCenterPage center="providers" />);
    const keysHtml = renderToStaticMarkup(<GatewayCenterPage center="keys" />);
    const logsHtml = renderToStaticMarkup(<GatewayCenterPage center="logs" />);
    const policyHtml = renderToStaticMarkup(<GatewayCenterPage center="connector-policy" />);
    const approvalsHtml = renderToStaticMarkup(<GatewayCenterPage center="approvals" />);
    const evidenceHtml = renderToStaticMarkup(<GatewayCenterPage center="evidence" />);

    expect(modelsHtml).toContain('别名、服务商模型、能力标签');
    expect(providersHtml).toContain('服务商健康');
    expect(keysHtml).toContain('调用凭证权限');
    expect(logsHtml).toContain('热门模型');
    expect(policyHtml).toContain('服务商策略');
    expect(approvalsHtml).toContain('凭据轮换');
    expect(evidenceHtml).toContain('证据台账');
    expect(
      [modelsHtml, providersHtml, keysHtml, logsHtml, policyHtml, approvalsHtml, evidenceHtml].join('\n')
    ).not.toMatch(/\b(Runtime Center|Models|Providers|API Keys|Usage Ledger|Surface|Status|Owner|Detail)\b/);
  });

  it('renders center pages from admin API shaped data instead of static dashboard samples', () => {
    const data = adminConsoleData();
    const dashboardHtml = renderToStaticMarkup(<GatewayDashboard initialData={data} />);
    const modelsHtml = renderToStaticMarkup(<GatewayCenterPage center="models" data={data} />);
    const providersHtml = renderToStaticMarkup(<GatewayCenterPage center="providers" data={data} />);
    const keysHtml = renderToStaticMarkup(<GatewayCenterPage center="keys" data={data} />);
    const logsHtml = renderToStaticMarkup(<GatewayCenterPage center="logs" data={data} />);

    expect(dashboardHtml).toContain('17');
    expect(modelsHtml).toContain('api-model-from-route');
    expect(providersHtml).toContain('真实服务商');
    expect(keysHtml).toContain('线上调用凭证');
    expect(logsHtml).toContain('api-model-from-log');
    expect([dashboardHtml, modelsHtml, providersHtml, keysHtml, logsHtml].join('\n')).not.toContain('18,420');
  });
});

function adminConsoleData(): AdminConsoleData {
  return {
    keys: [
      {
        id: 'key_live',
        name: '线上调用凭证',
        keyPrefix: 'ak-live',
        status: 'active',
        allowAllModels: false,
        models: ['api-model-from-route'],
        rpmLimit: 60,
        tpmLimit: null,
        dailyTokenLimit: null,
        dailyCostLimit: null,
        requestCountToday: 17,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
        expiresAt: null,
        revokedAt: null
      }
    ],
    providers: [
      {
        id: 'provider_real',
        name: '真实服务商',
        kind: 'openai-compatible',
        status: 'active',
        baseUrl: 'https://api.example.test/v1',
        timeoutMs: 30000,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
        credentialId: 'credential_real',
        credentialKeyPrefix: 'sk-real',
        credentialFingerprint: 'fingerprint',
        credentialKeyVersion: 'env-v1',
        credentialStatus: 'active',
        credentialCreatedAt: '2026-04-25T00:00:00.000Z',
        credentialRotatedAt: null
      }
    ],
    models: [
      {
        id: 'model_real',
        alias: 'api-model-from-route',
        providerId: 'provider_real',
        providerModel: 'vendor-model-real',
        enabled: true,
        contextWindow: 128000,
        capabilities: ['chat_completions'],
        fallbackAliases: [],
        inputPricePer1mTokens: 1,
        outputPricePer1mTokens: 2,
        adminOnly: false,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z'
      }
    ],
    operations: {
      dashboard: {
        summary: {
          requestCount: 17,
          totalTokens: 4567,
          estimatedCost: 0.123456,
          failureRate: 0.12,
          averageLatencyMs: 321
        },
        topModels: [{ model: 'api-model-from-log', requestCount: 17, totalTokens: 4567, estimatedCost: 0.123456 }],
        topKeys: [{ keyId: 'key_live', requestCount: 17, totalTokens: 4567, estimatedCost: 0.123456 }],
        topProviders: [{ provider: 'provider_real', requestCount: 17, totalTokens: 4567, estimatedCost: 0.123456 }]
      },
      logs: [
        {
          id: 'log_real',
          keyId: 'key_live',
          model: 'api-model-from-log',
          provider: 'provider_real',
          status: 'success',
          totalTokens: 4567,
          estimatedCost: 0.123456,
          latencyMs: 321,
          errorMessage: null,
          createdAt: '2026-04-25T00:00:00.000Z'
        }
      ]
    }
  };
}
