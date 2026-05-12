import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  GatewayAuthFileBatchUploadRequest,
  GatewayProviderSpecificConfigRecord,
  GatewaySnapshot
} from '@agent/core';
import { describe, expect, it, vi } from 'vitest';
import type { AgentGatewayApiClient } from '../src/api/agent-gateway-api';
import { renderActivePage, type GatewayPageData } from '../src/app/GatewayWorkspacePages';
import { GATEWAY_VIEWS } from '../src/app/gateway-view-model';
import { OAuthPolicyPage } from '../src/app/pages/OAuthPolicyPage';
import { QuotasPage } from '../src/app/pages/QuotasPage';
import { SystemPage } from '../src/app/pages/SystemPage';

describe('Agent Gateway production parity pages', () => {
  it('renders full CPAMC parity navigation under Agent Gateway semantics', () => {
    expect(GATEWAY_VIEWS.map(view => view.id)).toEqual([
      'dashboard',
      'runtime',
      'clients',
      'usageStats',
      'config',
      'aiProviders',
      'authFiles',
      'oauth',
      'migration',
      'quota',
      'logs',
      'system'
    ]);
  });

  it('uploads caller-provided auth files instead of a demo JSON payload', async () => {
    const batchUploadAuthFiles = vi.fn<AgentGatewayApiClient['batchUploadAuthFiles']>().mockResolvedValue({
      accepted: [],
      rejected: []
    });
    const onGatewayDataChanged = vi.fn();
    const page = renderActivePage('authFiles', snapshot, {
      ...basePageData,
      api: { batchUploadAuthFiles } as Partial<AgentGatewayApiClient> as AgentGatewayApiClient,
      onGatewayDataChanged
    }) as ReactElement<{ onBatchUpload: (files: GatewayAuthFileBatchUploadRequest['files']) => void }>;

    page.props.onBatchUpload([
      { fileName: 'codex-prod.json', contentBase64: 'eyJwcm9kIjp0cnVlfQ==', providerKind: 'codex' }
    ]);

    expect(batchUploadAuthFiles).toHaveBeenCalledWith({
      files: [{ fileName: 'codex-prod.json', contentBase64: 'eyJwcm9kIjp0cnVlfQ==', providerKind: 'codex' }]
    });
    expect(batchUploadAuthFiles).not.toHaveBeenCalledWith({
      files: [{ fileName: 'agent-gateway-upload.json', contentBase64: 'e30=' }]
    });
    await Promise.resolve();
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('passes the edited provider config record to save mutations', async () => {
    const saveProviderConfig = vi
      .fn<AgentGatewayApiClient['saveProviderConfig']>()
      .mockImplementation(async config => config);
    const onGatewayDataChanged = vi.fn();
    const codexConfig = providerConfig('codex-main', 'Codex Main');
    const page = renderActivePage('aiProviders', snapshot, {
      ...basePageData,
      api: { saveProviderConfig } as Partial<AgentGatewayApiClient> as AgentGatewayApiClient,
      onGatewayDataChanged
    }) as ReactElement<{ onSaveProvider: (config: GatewayProviderSpecificConfigRecord) => void }>;

    page.props.onSaveProvider(codexConfig);

    expect(saveProviderConfig).toHaveBeenCalledWith(codexConfig);
    await Promise.resolve();
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('renders quota cards for every provider quota instead of only the first row', () => {
    const html = renderToStaticMarkup(
      <QuotasPage
        quotas={[quota('quota-codex-main', 'codex', 120, 1000), quota('quota-claude-main', 'claude', 80, 500)]}
      />
    );

    expect(html).toContain('<h3>quota-codex-main</h3>');
    expect(html).toContain('120 / 1000 tokens');
    expect(html).toContain('<h3>quota-claude-main</h3>');
    expect(html).toContain('80 / 500 tokens');
  });

  it('renders OAuth provider cards with pending, completed, and error status projections', () => {
    const html = renderToStaticMarkup(
      <OAuthPolicyPage
        providerStatuses={{
          codex: { state: 'codex-flow', status: 'pending', checkedAt: '2026-05-11T00:00:00.000Z' },
          claude: { state: 'claude-flow', status: 'completed', checkedAt: '2026-05-11T00:01:00.000Z' },
          kimi: { state: 'kimi-flow', status: 'error', checkedAt: '2026-05-11T00:02:00.000Z' }
        }}
      />
    );

    expect(html).toContain('等待验证中');
    expect(html).toContain('验证成功');
    expect(html).toContain('验证失败');
  });

  it('starts Gemini CLI OAuth through the Gemini-specific API instead of falling back to Codex', async () => {
    const startGeminiCliOAuth = vi.fn<AgentGatewayApiClient['startGeminiCliOAuth']>().mockResolvedValue({
      state: 'gemini-flow',
      verificationUri: 'http://localhost:8085/oauth2callback?code=abc&state=gemini-flow',
      expiresAt: '2026-05-11T00:10:00.000Z'
    });
    const startProviderOAuth = vi.fn<AgentGatewayApiClient['startProviderOAuth']>();
    const onGatewayDataChanged = vi.fn();
    const page = renderActivePage('oauth', snapshot, {
      ...basePageData,
      api: {
        startGeminiCliOAuth,
        startProviderOAuth
      } as Partial<AgentGatewayApiClient> as AgentGatewayApiClient,
      onGatewayDataChanged
    }) as ReactElement<{
      onStartOAuth: (providerId: 'gemini-cli', options?: { projectId?: string }) => Promise<unknown>;
    }>;

    await page.props.onStartOAuth('gemini-cli', { projectId: 'ALL' });

    expect(startGeminiCliOAuth).toHaveBeenCalledWith({ projectId: 'ALL' });
    expect(startProviderOAuth).not.toHaveBeenCalled();
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('renders runtime executor status and production boundary on the system page', () => {
    const html = renderToStaticMarkup(
      <SystemPage
        info={basePageData.systemInfo!}
        modelGroups={[]}
        runtimeHealth={{
          status: 'degraded',
          checkedAt: '2026-05-11T00:00:00.000Z',
          executors: [
            {
              providerKind: 'codex',
              status: 'ready',
              checkedAt: '2026-05-11T00:00:00.000Z',
              activeRequests: 2,
              supportsStreaming: true,
              message: 'production executor online'
            },
            {
              providerKind: 'claude',
              status: 'error',
              checkedAt: '2026-05-11T00:00:00.000Z',
              activeRequests: 0,
              supportsStreaming: false,
              message: 'credential unavailable'
            }
          ],
          activeRequests: 2,
          activeStreams: 1,
          usageQueue: { pending: 3, failed: 1 },
          cooldowns: [
            {
              subjectType: 'client',
              subjectId: 'client-prod',
              reason: 'quota_exceeded',
              recordedAt: '2026-05-11T00:00:00.000Z'
            }
          ]
        }}
      />
    );

    expect(html).toContain('Production Runtime Boundary');
    expect(html).toContain('codex');
    expect(html).toContain('ready');
    expect(html).toContain('production executor online');
    expect(html).toContain('claude');
    expect(html).toContain('credential unavailable');
  });
});

function providerConfig(id: string, displayName: string): GatewayProviderSpecificConfigRecord {
  return {
    providerType: 'codex',
    id,
    displayName,
    enabled: true,
    baseUrl: null,
    models: [{ name: 'codex-mini', alias: 'codex-mini-prod' }],
    excludedModels: [],
    credentials: [{ credentialId: `${id}-credential`, authIndex: `${id}.json`, status: 'valid' }]
  };
}

function quota(id: string, provider: string, usedTokens: number, limitTokens: number) {
  return {
    id,
    provider,
    scope: 'auth-file:main',
    usedTokens,
    limitTokens,
    resetAt: '2026-05-12T00:00:00.000Z',
    status: 'normal' as const
  };
}

const basePageData: GatewayPageData = {
  apiKeys: { items: [] },
  authFiles: { items: [], nextCursor: null },
  clientApiKeys: {},
  clientLogs: {},
  clientQuotas: {},
  clients: [],
  dashboard: null,
  modelGroups: [],
  onLogout: () => undefined,
  providerConfigs: { items: [] },
  quotaDetails: { items: [] },
  rawConfig: null,
  runtimeHealth: null,
  systemInfo: {
    version: '1.2.3',
    buildDate: '2026-05-01',
    latestVersion: '1.2.4',
    updateAvailable: true,
    links: { help: 'https://help.router-for.me/' }
  }
};

const snapshot: GatewaySnapshot = {
  observedAt: '2026-05-11T00:00:00.000Z',
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
  providerCredentialSets: [],
  credentialFiles: [],
  quotas: []
};
