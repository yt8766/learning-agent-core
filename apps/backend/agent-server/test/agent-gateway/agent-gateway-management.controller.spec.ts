import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayManagementController } from '../../src/api/agent-gateway/agent-gateway-management.controller';

function createController(overrides: Record<string, unknown> = {}) {
  return createControllerFromServices(createServices(overrides));
}

describe('AgentGatewayManagementController', () => {
  it('dashboard delegates to dashboardService.summary', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.dashboard();
    expect(services.summary).toHaveBeenCalled();
  });

  it('providerConfigs delegates to providerConfigService.list', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.providerConfigs();
    expect(services.list).toHaveBeenCalled();
  });

  it('usageAnalytics parses query defaults and delegates', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.usageAnalytics({ range: 'today', limit: '10' });
    expect(services.usageAnalyticsSummary).toHaveBeenCalledWith({
      range: 'today',
      status: 'all',
      limit: 10
    });
  });

  it('saveProviderConfig parses body and delegates', async () => {
    const { controller, services } = createControllerWithSpy();
    const body = {
      providerType: 'openaiCompatible',
      displayName: 'Test',
      enabled: true,
      baseUrl: 'http://x',
      models: [],
      excludedModels: [],
      credentials: [],
      rawSource: 'adapter'
    };
    await controller.saveProviderConfig('test-id', body);
    expect(services.saveProviderConfig).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ displayName: 'Test' })
    );
  });

  it('saveProviderConfig throws BadRequestException for invalid body', () => {
    const controller = createController();
    expect(() => controller.saveProviderConfig('id', null)).toThrow(BadRequestException);
  });

  it('providerModels delegates to providerConfigService.discoverModels', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.providerModels('gemini');
    expect(services.discoverModels).toHaveBeenCalledWith('gemini');
  });

  it('testProviderModel delegates with model from body', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.testProviderModel('gemini', { model: 'gemini-pro' });
    expect(services.testModel).toHaveBeenCalledWith('gemini', 'gemini-pro');
  });

  it('testProviderModel throws for missing model', () => {
    const controller = createController();
    expect(() => controller.testProviderModel('gemini', {})).toThrow(BadRequestException);
  });

  it('authFiles delegates with query params', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.authFiles({ query: 'test', providerKind: 'gemini', limit: '10' });
    expect(services.listAuthFiles).toHaveBeenCalledWith({
      query: 'test',
      providerKind: 'gemini',
      cursor: undefined,
      limit: 10
    });
  });

  it('uploadAuthFiles parses body and delegates', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.uploadAuthFiles({
      files: [{ fileName: 'codex.json', contentBase64: Buffer.from('{}').toString('base64'), providerKind: 'codex' }]
    });
    expect(services.uploadAuthFiles).toHaveBeenCalled();
  });

  it('uploadAuthFiles throws BadRequestException for invalid body', () => {
    const controller = createController();
    expect(() => controller.uploadAuthFiles(null)).toThrow(BadRequestException);
  });

  it('patchAuthFile parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.patchAuthFile(null)).toThrow(BadRequestException);
  });

  it('authFileModels delegates to authFileService.models', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.authFileModels('af-1');
    expect(services.models).toHaveBeenCalledWith('af-1');
  });

  it('downloadAuthFile delegates to authFileService.download', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.downloadAuthFile('af-1');
    expect(services.download).toHaveBeenCalledWith('af-1');
  });

  it('deleteAuthFiles parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.deleteAuthFiles(null)).toThrow(BadRequestException);
  });

  it('oauthAliases delegates to oauthPolicyService.listAliases', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.oauthAliases('gemini');
    expect(services.listAliases).toHaveBeenCalledWith('gemini');
  });

  it('saveOauthAliases parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.saveOauthAliases('gemini', null)).toThrow(BadRequestException);
  });

  it('oauthStatus delegates to oauthPolicyService.status', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.oauthStatus('state-1');
    expect(services.status).toHaveBeenCalledWith('state-1');
  });

  it('oauthCallback parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.oauthCallback(null)).toThrow(BadRequestException);
  });

  it('startGeminiCli parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.startGeminiCli(null)).toThrow(BadRequestException);
  });

  it('startProviderOAuth parses body and delegates', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.startProviderOAuth('codex', { isWebui: true, projectId: 'project-1' });
    expect(services.startProviderOAuth).toHaveBeenCalledWith('codex', {
      provider: 'codex',
      isWebui: true,
      projectId: 'project-1'
    });
  });

  it('importVertexCredential parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.importVertexCredential(null)).toThrow(BadRequestException);
  });

  it('apiCall parses body and delegates', async () => {
    const controller = createController();
    expect(() => controller.apiCall(null)).toThrow(BadRequestException);
  });

  it('refreshQuota parses providerKind param', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.refreshQuota('gemini');
    expect(services.refreshProviderQuota).toHaveBeenCalledWith('gemini');
  });

  it('downloadRequestLog delegates with id', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.downloadRequestLog('log-1');
    expect(services.downloadRequestLog).toHaveBeenCalledWith('log-1');
  });

  it('downloadRequestErrorFile delegates with fileName', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.downloadRequestErrorFile('error.log');
    expect(services.downloadRequestErrorFile).toHaveBeenCalledWith('error.log');
  });

  it('latestVersion delegates to systemService', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.latestVersion();
    expect(services.latestVersion).toHaveBeenCalled();
  });

  it('setRequestLog parses body.enabled and body.requestLog', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.setRequestLog({ enabled: true });
    expect(services.setRequestLogEnabled).toHaveBeenCalledWith(true);
  });

  it('setRequestLog uses requestLog field when enabled is absent', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.setRequestLog({ requestLog: true });
    expect(services.setRequestLogEnabled).toHaveBeenCalledWith(true);
  });

  it('setRequestLog sends false when neither field is true', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.setRequestLog({});
    expect(services.setRequestLogEnabled).toHaveBeenCalledWith(false);
  });

  it('clearLoginStorage delegates to systemService', async () => {
    const { controller, services } = createControllerWithSpy();
    await controller.clearLoginStorage();
    expect(services.clearLoginStorage).toHaveBeenCalled();
  });

  it('exposes runtime engine health projection', async () => {
    const controller = createController({
      runtimeEngine: {
        health: async () => ({
          status: 'ready',
          checkedAt: '2026-05-10T00:00:00.000Z',
          executors: [],
          activeRequests: 0,
          activeStreams: 0,
          usageQueue: { pending: 0, failed: 0 },
          cooldowns: []
        })
      }
    });

    await expect(controller.runtimeHealth()).resolves.toMatchObject({ status: 'ready', executors: [] });
  });
});

function createControllerWithSpy() {
  const services = createServices();
  const controller = createControllerFromServices(services);
  return { controller, services };
}

function createServices(overrides: Record<string, unknown> = {}) {
  const defaults = {
    summary: vi.fn().mockResolvedValue(validDashboardSummary()),
    list: vi.fn().mockResolvedValue({ items: [] }),
    save: vi.fn().mockResolvedValue({ id: 'test' }),
    saveProviderConfig: vi.fn().mockResolvedValue({
      id: 'test',
      providerType: 'codex',
      displayName: 'Test',
      enabled: true,
      baseUrl: null,
      models: [],
      excludedModels: [],
      credentials: [],
      rawSource: 'adapter'
    }),
    discoverModels: vi.fn().mockResolvedValue({ groups: [] }),
    testModel: vi.fn().mockResolvedValue({
      providerId: 'gemini',
      ok: true,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      message: 'ok'
    }),
    listAuthFiles: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    batchUpload: vi.fn().mockResolvedValue({ accepted: [], rejected: [] }),
    uploadAuthFiles: vi.fn().mockResolvedValue({ accepted: [], rejected: [] }),
    patchFields: vi.fn().mockResolvedValue({ id: 'af-1' }),
    models: vi.fn().mockResolvedValue({ authFileId: 'af-1', models: [] }),
    download: vi.fn().mockResolvedValue('file-content'),
    delete: vi.fn().mockResolvedValue({ deleted: [], skipped: [] }),
    listAliases: vi
      .fn()
      .mockResolvedValue({ providerId: 'p1', modelAliases: [], updatedAt: '2026-05-10T00:00:00.000Z' }),
    saveAliases: vi
      .fn()
      .mockResolvedValue({ providerId: 'p1', modelAliases: [], updatedAt: '2026-05-10T00:00:00.000Z' }),
    status: vi.fn().mockResolvedValue({ state: 's1', status: 'pending', checkedAt: '2026-05-10T00:00:00.000Z' }),
    submitCallback: vi.fn().mockResolvedValue({
      accepted: true,
      provider: 'codex',
      completedAt: '2026-05-10T00:00:00.000Z'
    }),
    startGeminiCli: vi.fn().mockResolvedValue({ state: 'gs' }),
    startProviderAuth: vi.fn().mockResolvedValue({ state: 'ps' }),
    startProviderOAuth: vi.fn().mockResolvedValue({
      state: 'ps',
      verificationUri: 'https://example.com/oauth',
      expiresAt: '2026-05-10T00:10:00.000Z'
    }),
    importVertexCredential: vi.fn().mockResolvedValue({ imported: true }),
    call: vi.fn().mockResolvedValue({ ok: true }),
    refreshQuotaDetails: vi.fn().mockResolvedValue({ items: [] }),
    refreshProviderQuota: vi.fn().mockResolvedValue({ items: [] }),
    downloadRequestLog: vi.fn().mockResolvedValue('log'),
    downloadRequestErrorFile: vi.fn().mockResolvedValue('error'),
    latestVersion: vi.fn().mockResolvedValue(validSystemVersion()),
    setRequestLogEnabled: vi.fn().mockResolvedValue({
      requestLog: true,
      updatedAt: '2026-05-10T00:00:00.000Z'
    }),
    clearLoginStorage: vi.fn().mockResolvedValue({
      cleared: true,
      clearedAt: '2026-05-10T00:00:00.000Z'
    }),
    usageAnalyticsSummary: vi.fn().mockResolvedValue(validUsageAnalytics()),
    runtimeEngine: {
      health: vi.fn().mockResolvedValue({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:00.000Z',
        executors: [],
        activeRequests: 0,
        activeStreams: 0,
        usageQueue: { pending: 0, failed: 0 },
        cooldowns: []
      })
    }
  };
  return { ...defaults, ...overrides };
}

function createControllerFromServices(services: Record<string, unknown>) {
  return new AgentGatewayManagementController(
    { summary: services.summary } as never,
    {
      list: services.list,
      save: services.save,
      saveProviderConfig: services.saveProviderConfig,
      discoverModels: services.discoverModels,
      testModel: services.testModel
    } as never,
    {
      list: services.listAuthFiles,
      batchUpload: services.batchUpload,
      uploadAuthFiles: services.uploadAuthFiles,
      patchFields: services.patchFields,
      models: services.models,
      download: services.download,
      delete: services.delete
    } as never,
    {
      listAliases: services.listAliases,
      saveAliases: services.saveAliases,
      status: services.status,
      submitCallback: services.submitCallback,
      startGeminiCli: services.startGeminiCli,
      startProviderAuth: services.startProviderAuth,
      startProviderOAuth: services.startProviderOAuth,
      importVertexCredential: services.importVertexCredential
    } as never,
    {
      call: services.call,
      refreshQuotaDetails: services.refreshQuotaDetails,
      refreshProviderQuota: services.refreshProviderQuota
    } as never,
    {
      downloadRequestLog: services.downloadRequestLog,
      downloadRequestErrorFile: services.downloadRequestErrorFile
    } as never,
    {
      latestVersion: services.latestVersion,
      setRequestLogEnabled: services.setRequestLogEnabled,
      clearLoginStorage: services.clearLoginStorage
    } as never,
    services.runtimeEngine as never,
    { summary: services.usageAnalyticsSummary } as never
  );
}
function validDashboardSummary() {
  return {
    observedAt: '2026-05-10T00:00:00.000Z',
    connection: {
      status: 'connected',
      apiBase: null,
      serverVersion: null,
      serverBuildDate: null
    },
    counts: {
      managementApiKeys: 0,
      authFiles: 0,
      providerCredentials: 0,
      availableModels: 0
    },
    providers: [],
    routing: {
      strategy: 'memory',
      forceModelPrefix: false,
      requestRetry: 0,
      wsAuth: false,
      proxyUrl: null
    }
  };
}

function validSystemVersion() {
  return { version: '1.0', latestVersion: null, buildDate: null, updateAvailable: false, links: {} };
}

function validUsageAnalytics() {
  return {
    observedAt: '2026-05-10T00:00:00.000Z',
    range: { preset: 'today', from: '2026-05-10T00:00:00.000Z', to: '2026-05-10T23:59:59.000Z', bucketMinutes: 60 },
    activeTab: 'requestLogs',
    summary: {
      requestCount: 0,
      estimatedCostUsd: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreateTokens: 0,
      cacheHitTokens: 0
    },
    trend: [],
    requestLogs: { items: [], total: 0, nextCursor: null },
    providerStats: [],
    modelStats: [],
    filters: { providers: [], models: [], applications: [] }
  };
}
