import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  GatewayAuthFileListResponse,
  GatewayAuthFileBatchUploadRequest,
  GatewayClient,
  GatewayMigrationApplyResponse,
  GatewayMigrationPreview,
  GatewayOAuthCallbackResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayQuota,
  GatewayRuntimeHealthResponse,
  GatewaySnapshot
} from '@agent/core';
import { describe, expect, it, vi } from 'vitest';
import type {
  AgentGatewayApiClient,
  GatewayMigrationApplyRequest,
  GatewayMigrationPreviewRequest
} from '../src/api/agent-gateway-api';
import { renderActivePage, type GatewayPageData } from '../src/app/GatewayWorkspacePages';
import { AuthFilesManagerPage } from '../src/app/pages/AuthFilesManagerPage';
import { ClientsPage } from '../src/app/pages/ClientsPage';
import { MigrationPage } from '../src/app/pages/MigrationPage';

interface OperationSmokeProps {
  health?: GatewayRuntimeHealthResponse | null;
  onApply?: (request: GatewayMigrationApplyRequest) => Promise<GatewayMigrationApplyResponse>;
  onBatchDelete?: () => void;
  onBatchDownload?: () => void;
  onBatchUpload?: (files: GatewayAuthFileBatchUploadRequest['files']) => void;
  onCheckLatestVersion?: () => Promise<unknown> | void;
  onClearLogs?: () => Promise<unknown> | void;
  onClearLocalLoginStorage?: () => Promise<unknown> | void;
  modelGroups?: unknown[];
  onCreateApiKey?: (clientId: string) => Promise<unknown> | void;
  onCreateClient?: (request: { name: string; ownerEmail?: string }) => Promise<unknown> | void;
  onEnableRequestLog?: () => Promise<unknown> | void;
  onListModels?: (authFileId: string) => void;
  onPatchFields?: (authFileId: string) => void;
  onPreview?: (request: GatewayMigrationPreviewRequest) => Promise<GatewayMigrationPreview>;
  onRefreshModels?: (...args: string[]) => Promise<unknown> | void;
  onAddProvider?: (providerId: string) => Promise<unknown> | void;
  onRefreshProviderQuota?: (providerKind: string) => Promise<unknown> | void;
  onSave?: () => Promise<unknown> | void;
  onSaveProvider?: (config: GatewayProviderSpecificConfigRecord) => Promise<unknown> | void;
  onRefreshStatus?: (state: string) => Promise<GatewayOAuthStatusResponse | undefined> | void;
  onStartOAuth?: (providerId: string) => Promise<GatewayProviderOAuthStartResponse>;
  onSubmitCallback?: (providerId: string, redirectUrl: string) => Promise<GatewayOAuthCallbackResponse>;
  onTestModel?: (providerId: string, model: string) => Promise<unknown> | void;
  onToggleStatus?: (authFileId: string, nextDisabled?: boolean) => void;
  onUpdateQuota?: (quota: GatewayQuota) => Promise<unknown> | void;
}

describe('Agent Gateway real operation smoke', () => {
  it('routes migration preview/apply through AgentGatewayApiClient and invalidates gateway data', async () => {
    const preview: GatewayMigrationPreview = {
      source: { apiBase: 'https://router.example.com', serverVersion: 'cli-proxy-1.2.3', checkedAt: iso },
      resources: [
        {
          kind: 'providerConfig',
          sourceId: 'codex',
          targetId: null,
          action: 'create',
          safe: true,
          summary: 'Codex Production'
        }
      ],
      conflicts: [],
      totals: { create: 1, update: 0, skip: 0, conflict: 0 }
    };
    const applyResult: GatewayMigrationApplyResponse = {
      migrationId: 'migration-1',
      appliedAt: iso,
      imported: [{ kind: 'providerConfig', sourceId: 'codex', targetId: 'codex' }],
      skipped: [],
      failed: [],
      warnings: []
    };
    const api = createApi({
      previewMigration: vi.fn().mockResolvedValue(preview),
      applyMigration: vi.fn().mockResolvedValue(applyResult)
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('migration', { api, onGatewayDataChanged });

    await expect(
      page.props.onPreview!({ apiBase: 'https://router.example.com', managementKey: 'mgmt-secret' })
    ).resolves.toBe(preview);
    await expect(
      page.props.onApply!({
        apiBase: 'https://router.example.com',
        managementKey: 'mgmt-secret',
        selectedSourceIds: ['codex'],
        confirmUnsafeConflicts: false
      })
    ).resolves.toBe(applyResult);

    expect(api.previewMigration).toHaveBeenCalledWith({
      apiBase: 'https://router.example.com',
      managementKey: 'mgmt-secret'
    });
    expect(api.applyMigration).toHaveBeenCalledWith({
      apiBase: 'https://router.example.com',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex'],
      confirmUnsafeConflicts: false
    });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(2);
  });

  it('routes raw config save through AgentGatewayApiClient and invalidates gateway data', async () => {
    const api = createApi({
      saveRawConfig: vi.fn().mockResolvedValue({ content: 'providers: []\n', format: 'yaml', version: 'cfg-2' })
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('config', {
      api,
      onGatewayDataChanged,
      rawConfig: { content: 'providers: []\n', format: 'yaml', version: 'cfg-1' }
    });

    await expect(page.props.onSave!()).resolves.toMatchObject({ version: 'cfg-2' });

    expect(api.saveRawConfig).toHaveBeenCalledWith({ content: 'providers: []\n', expectedVersion: 'cfg-1' });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('routes log clear through AgentGatewayApiClient and invalidates gateway data', async () => {
    const api = createApi({
      clearLogs: vi.fn().mockResolvedValue({ cleared: true, clearedAt: iso })
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('logs', { api, onGatewayDataChanged });

    await expect(page.props.onClearLogs!()).resolves.toEqual({ cleared: true, clearedAt: iso });

    expect(api.clearLogs).toHaveBeenCalledTimes(1);
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps migration preview clickable so missing inputs produce page errors instead of a dead disabled button', () => {
    const html = renderToStaticMarkup(<MigrationPage />);

    expect(html).toContain('预览迁移');
    expect(html).not.toContain('disabled=""');
  });

  it('renders the empty auth-file state as an upload action', () => {
    const html = renderToStaticMarkup(<AuthFilesManagerPage authFiles={{ items: [], nextCursor: null }} />);

    expect(html).toContain('auth-empty-upload');
    expect(html).toContain('点击批量上传导入 OAuth 或服务账号 JSON');
  });

  it('renders auth-file operation buttons as explicit controls with feedback state instead of inert decoration', () => {
    const html = renderToStaticMarkup(<AuthFilesManagerPage authFiles={authFilesResponse} />);

    expect(html).toContain('role="status"');
    expect(html).toContain('等待操作');
    expect(html).toContain('重置筛选');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('value="updated" selected=""');
    expect(html).toContain('aria-label="下载 codex-auth.json"');
    expect(html).not.toContain('>刷新</button>');
  });

  it('does not report client mutations as successful when no API callback is wired', () => {
    const html = renderToStaticMarkup(<ClientsPage clients={[]} />);

    expect(html).toContain('data-missing-operation="新建调用方"');
    expect(html).toContain('data-missing-operation="保存调用方额度"');
  });

  it('does not provide hardcoded migration or OAuth payloads when the API client is unavailable', async () => {
    const migrationPage = activePage('migration');
    await expect(
      migrationPage.props.onPreview!({ apiBase: 'https://router.example.com', managementKey: 'mgmt-secret' })
    ).rejects.toThrow('AgentGatewayApiClient');

    const oauthPage = activePage('oauth');
    await expect(oauthPage.props.onStartOAuth!('codex')).rejects.toThrow('AgentGatewayApiClient');
    await expect(oauthPage.props.onSubmitCallback!('codex', 'http://localhost/callback?code=ok')).rejects.toThrow(
      'AgentGatewayApiClient'
    );
  });

  it('routes OAuth start/status/callback operations through AgentGatewayApiClient and invalidates gateway data', async () => {
    const api = createApi({
      startProviderOAuth: vi.fn().mockResolvedValue({
        state: 'codex-state',
        verificationUri: 'https://auth.example.com/codex',
        expiresAt: iso
      }),
      oauthStatus: vi.fn().mockResolvedValue({ state: 'codex-state', status: 'completed', updatedAt: iso }),
      submitOAuthCallback: vi.fn().mockResolvedValue({ accepted: true, provider: 'codex', completedAt: iso })
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('oauth', { api, onGatewayDataChanged });

    await expect(page.props.onStartOAuth!('codex')).resolves.toMatchObject({ state: 'codex-state' });
    await expect(page.props.onRefreshStatus!('codex-state')).resolves.toMatchObject({ status: 'completed' });
    await expect(page.props.onSubmitCallback!('claude', 'http://localhost/callback?code=ok')).resolves.toMatchObject({
      accepted: true
    });

    expect(api.startProviderOAuth).toHaveBeenCalledWith('codex');
    expect(api.oauthStatus).toHaveBeenCalledWith('codex-state');
    expect(api.submitOAuthCallback).toHaveBeenCalledWith({
      provider: 'anthropic',
      redirectUrl: 'http://localhost/callback?code=ok'
    });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(2);
  });

  it('routes auth file upload and record mutations through AgentGatewayApiClient and invalidates gateway data', async () => {
    const api = createApi({
      batchUploadAuthFiles: vi.fn().mockResolvedValue({ items: [], failed: [] }),
      authFileModels: vi.fn().mockResolvedValue({ items: [] }),
      patchAuthFileFields: vi.fn().mockResolvedValue({ id: 'codex-auth' }),
      deleteAuthFiles: vi.fn().mockResolvedValue({ deleted: ['codex-auth.json'], missing: [] }),
      downloadAuthFile: vi.fn().mockResolvedValue('{}')
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('authFiles', {
      api,
      authFiles: authFilesResponse,
      onGatewayDataChanged
    });

    page.props.onBatchUpload!([{ fileName: 'codex-auth.json', contentBase64: 'e30=', providerKind: 'codex' }]);
    page.props.onListModels!('codex-auth');
    page.props.onPatchFields!('codex-auth');
    page.props.onToggleStatus!('codex-auth');
    page.props.onBatchDelete!();
    page.props.onBatchDownload!();
    await flushPromises();

    expect(api.batchUploadAuthFiles).toHaveBeenCalledWith({
      files: [{ fileName: 'codex-auth.json', contentBase64: 'e30=', providerKind: 'codex' }]
    });
    expect(api.authFileModels).toHaveBeenCalledWith('codex-auth');
    expect(api.patchAuthFileFields).toHaveBeenCalledWith({
      authFileId: 'codex-auth',
      metadata: { touchedBy: 'agent-gateway-ui' }
    });
    expect(api.patchAuthFileFields).toHaveBeenCalledWith({ authFileId: 'codex-auth', disabled: true });
    expect(api.deleteAuthFiles).toHaveBeenCalledWith({ names: ['codex-auth.json'] });
    expect(api.downloadAuthFile).toHaveBeenCalledWith('codex-auth');
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(5);
  });

  it('routes quota refresh and client key creation through AgentGatewayApiClient and invalidates gateway data', async () => {
    const api = createApi({
      refreshQuotaDetails: vi.fn().mockResolvedValue({ items: [] }),
      updateQuota: vi.fn().mockResolvedValue(quota),
      createClientApiKey: vi.fn().mockResolvedValue({
        apiKey: {
          id: 'key-1',
          clientId: client.id,
          name: 'runtime key',
          prefix: 'agp_live',
          status: 'active',
          scopes: ['models.read'],
          createdAt: iso,
          expiresAt: null,
          lastUsedAt: null
        },
        secret: 'agp_live_secret'
      })
    });
    const onGatewayDataChanged = vi.fn();

    const quotaPage = activePage('quota', { api, onGatewayDataChanged });
    await expect(quotaPage.props.onRefreshProviderQuota!('codex')).resolves.toEqual({ items: [] });
    await expect(quotaPage.props.onUpdateQuota!({ ...quota, limitTokens: 200 })).resolves.toBe(quota);

    const clientsPage = activePage('clients', {
      api,
      clients: [client],
      onGatewayDataChanged
    });
    clientsPage.props.onCreateApiKey!(client.id);
    await flushPromises();

    expect(api.refreshQuotaDetails).toHaveBeenCalledWith('codex');
    expect(api.updateQuota).toHaveBeenCalledWith({ ...quota, limitTokens: 200 });
    expect(api.createClientApiKey).toHaveBeenCalledWith(client.id, {
      name: 'runtime key',
      scopes: ['models.read', 'chat.completions']
    });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(3);
  });

  it('routes client creation through AgentGatewayApiClient and does not silently swallow the operation', async () => {
    const api = createApi({
      createClient: vi.fn().mockResolvedValue(client)
    });
    const onGatewayDataChanged = vi.fn();
    const clientsPage = activePage('clients', {
      api,
      clients: [],
      onGatewayDataChanged
    });

    await expect(clientsPage.props.onCreateClient!({ name: 'Acme Runtime' })).resolves.toBeUndefined();

    expect(api.createClient).toHaveBeenCalledWith({ name: 'Acme Runtime' });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('routes provider config buttons through AgentGatewayApiClient instead of rendering dead actions', async () => {
    const providerConfig: GatewayProviderSpecificConfigRecord = {
      id: 'openai-compatible',
      providerType: 'openaiCompatible',
      displayName: 'OpenAI Compatible',
      enabled: true,
      baseUrl: 'https://router.example.com/v1',
      models: [{ name: 'gpt-real' }],
      excludedModels: [],
      credentials: []
    };
    const api = createApi({
      providerConfigModels: vi.fn().mockResolvedValue({ groups: [] }),
      saveProviderConfig: vi.fn().mockResolvedValue(providerConfig),
      testProviderModel: vi.fn().mockResolvedValue({ ok: true })
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('aiProviders', {
      api,
      providerConfigs: { items: [providerConfig] },
      onGatewayDataChanged
    });

    await expect(page.props.onRefreshModels!('openai-compatible')).resolves.toEqual({ groups: [] });
    await expect(page.props.onSaveProvider!(providerConfig)).resolves.toBe(providerConfig);
    await expect(page.props.onTestModel!('openai-compatible', 'gpt-real')).resolves.toEqual({ ok: true });

    expect(api.providerConfigModels).toHaveBeenCalledWith('openai-compatible');
    expect(api.saveProviderConfig).toHaveBeenCalledWith(providerConfig);
    expect(api.testProviderModel).toHaveBeenCalledWith('openai-compatible', 'gpt-real');
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(3);
  });

  it('maps provider section id to providerType when creating a new provider config', async () => {
    const api = createApi({
      saveProviderConfig: vi.fn(async config => config)
    });
    const onGatewayDataChanged = vi.fn();
    const page = activePage('aiProviders', {
      api,
      onGatewayDataChanged
    });

    await expect(page.props.onAddProvider!('openai-compatible')).resolves.toMatchObject({
      providerType: 'openaiCompatible',
      id: 'openai-compatible',
      displayName: 'OpenAI Compatible',
      enabled: true,
      baseUrl: null,
      models: [],
      excludedModels: [],
      credentials: []
    });

    expect(api.saveProviderConfig).toHaveBeenCalledWith({
      providerType: 'openaiCompatible',
      id: 'openai-compatible',
      displayName: 'OpenAI Compatible',
      enabled: true,
      baseUrl: null,
      models: [],
      excludedModels: [],
      credentials: []
    });
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(1);
  });

  it('does not synthesize system models from snapshot provider families when backend discovery is empty', () => {
    const page = activePage('system', {
      modelGroups: [],
      systemInfo: {
        version: '1.2.3',
        buildDate: '2026-05-01',
        latestVersion: null,
        updateAvailable: false,
        links: { help: 'https://help.router-for.me/' }
      }
    });

    expect(page.props.modelGroups).toEqual([]);
  });

  it('routes system page actions through AgentGatewayApiClient and reports through returned promises', async () => {
    const latestVersion = {
      version: '1.2.3',
      latestVersion: '1.2.4',
      buildDate: '2026-05-01',
      updateAvailable: true,
      links: { help: 'https://help.router-for.me/' }
    };
    const api = createApi({
      latestVersion: vi.fn().mockResolvedValue(latestVersion),
      discoverModels: vi.fn().mockResolvedValue({ groups: [] }),
      setRequestLogEnabled: vi.fn().mockResolvedValue({ requestLog: true, updatedAt: iso }),
      clearLoginStorage: vi.fn().mockResolvedValue({ cleared: true, clearedAt: iso })
    });
    const onGatewayDataChanged = vi.fn();
    const onLogout = vi.fn();
    const page = activePage('system', {
      api,
      onGatewayDataChanged,
      onLogout
    });

    await expect(page.props.onCheckLatestVersion!()).resolves.toBe(latestVersion);
    await expect(page.props.onRefreshModels!()).resolves.toEqual({ groups: [] });
    await expect(page.props.onEnableRequestLog!()).resolves.toEqual({ requestLog: true, updatedAt: iso });
    await expect(page.props.onClearLocalLoginStorage!()).resolves.toEqual({ cleared: true, clearedAt: iso });

    expect(api.latestVersion).toHaveBeenCalledTimes(1);
    expect(api.discoverModels).toHaveBeenCalledTimes(1);
    expect(api.setRequestLogEnabled).toHaveBeenCalledWith(true);
    expect(api.clearLoginStorage).toHaveBeenCalledTimes(1);
    expect(onGatewayDataChanged).toHaveBeenCalledTimes(3);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('renders runtime page from runtime health query data without mutation callbacks', () => {
    const page = activePage('runtime', {
      runtimeHealth: {
        status: 'ready',
        checkedAt: iso,
        executors: [
          {
            providerKind: 'codex',
            status: 'ready',
            checkedAt: iso,
            activeRequests: 0,
            supportsStreaming: true
          }
        ],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: 0, failed: 0 },
        cooldowns: []
      }
    });

    expect(page.props.health).toMatchObject({
      status: 'ready',
      executors: [{ providerKind: 'codex', supportsStreaming: true }]
    });
  });
});

function activePage(
  activeView: Parameters<typeof renderActivePage>[0],
  overrides: Partial<GatewayPageData> = {}
): ReactElement<OperationSmokeProps> {
  const page = renderActivePage(activeView, snapshot, {
    apiKeys: { items: [] },
    authFiles: { items: [], nextCursor: null },
    clientApiKeys: {},
    clientLogs: {},
    clientQuotas: {},
    clients: [],
    dashboard: null,
    modelGroups: [],
    onLogout: vi.fn(),
    providerConfigs: { items: [] },
    quotaDetails: { items: [] },
    rawConfig: null,
    runtimeHealth: null,
    systemInfo: null,
    ...overrides
  });
  expect(isValidElement(page)).toBe(true);
  return page as ReactElement<OperationSmokeProps>;
}

function createApi(methods: Partial<Record<keyof AgentGatewayApiClient, unknown>>): AgentGatewayApiClient {
  return methods as AgentGatewayApiClient;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const iso = '2026-05-11T00:00:00.000Z';

const client: GatewayClient = {
  id: 'client-acme',
  name: 'Acme Runtime',
  status: 'active',
  tags: ['internal'],
  createdAt: iso,
  updatedAt: iso
};

const quota: GatewayQuota = {
  id: 'codex-daily',
  provider: 'codex',
  scope: 'daily',
  usedTokens: 10,
  limitTokens: 100,
  resetAt: iso,
  status: 'normal'
};

const authFilesResponse: GatewayAuthFileListResponse = {
  items: [
    {
      id: 'codex-auth',
      providerId: 'codex',
      providerKind: 'codex',
      fileName: 'codex-auth.json',
      path: '/auth/codex-auth.json',
      status: 'valid',
      accountEmail: 'agent@example.com',
      projectId: null,
      modelCount: 8,
      updatedAt: iso
    }
  ],
  nextCursor: null
};

const snapshot: GatewaySnapshot = {
  observedAt: iso,
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
      id: 'codex-primary',
      provider: 'codex',
      modelFamilies: ['codex-mini'],
      status: 'healthy',
      priority: 1,
      baseUrl: 'https://api.example.com/v1',
      timeoutMs: 60000
    }
  ],
  credentialFiles: [],
  quotas: [quota]
};
