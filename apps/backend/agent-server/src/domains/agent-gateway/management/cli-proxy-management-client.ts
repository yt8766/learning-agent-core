import { Injectable } from '@nestjs/common';
import type {
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayClearLogsResponse,
  GatewayClearLoginStorageResponse,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayDeleteApiKeyRequest,
  GatewayGeminiCliOAuthStartRequest,
  GatewayLogFileListResponse,
  GatewayLogSearchRequest,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartRequest,
  GatewayProbeResponse,
  GatewayProviderKind,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayReplaceApiKeysRequest,
  GatewayRequestLogListResponse,
  GatewayRequestLogSettingResponse,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayUpdateApiKeyRequest,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';
import type {
  AgentGatewayManagementClient,
  GatewayAuthFileListQuery,
  GatewayStartOAuthProjection
} from './agent-gateway-management-client';
import {
  buildCliProxyAuthFileDeleteRequest,
  mapCliProxyAuthFileDeleteResponse,
  uploadCliProxyAuthFiles
} from './cli-proxy-management-client.auth-files.helpers';
import {
  geminiCliOAuthRequestPath,
  hasCliProxyAuthFileFieldsPatch,
  projectGeminiCliOAuthStart,
  projectProviderOAuthStart,
  projectVertexCredentialImport,
  providerOAuthRequestPath,
  toCliProxyAuthFilePatchBody
} from './cli-proxy-management-client.oauth.helpers';
import {
  arrayBody,
  booleanField,
  createProviderConfigList,
  mapApiKeys,
  mapAuthFile,
  mapModel,
  mapOAuthAlias,
  mapRequestLog,
  mapSystemInfo,
  maskSecret,
  normalizeBaseUrl,
  normalizeOAuthStatus,
  normalizeProviderKind,
  now,
  numberField,
  providerEndpoint,
  queryString,
  sanitizeGatewayProjectionValue,
  stringField
} from './cli-proxy-management-client.helpers';
import { refreshCliProxyQuotaDetails } from './cli-proxy-management-client.quota';
import {
  createCliProxyRequester,
  type CliProxyFetcher,
  type CliProxyRequester
} from './cli-proxy-management-client.request.helpers';

interface CliProxyManagementClientOptions {
  apiBase: string;
  managementKey: string;
  timeoutMs?: number;
  fetcher?: CliProxyFetcher;
}

@Injectable()
export class CliProxyManagementClient implements AgentGatewayManagementClient {
  private apiBase: string;
  private managementKey: string;
  private timeoutMs: number;
  private readonly requester: CliProxyRequester;

  constructor(options: CliProxyManagementClientOptions) {
    if (!options.apiBase || !options.managementKey) {
      throw new Error('CLI Proxy management client requires apiBase and managementKey');
    }
    this.apiBase = normalizeBaseUrl(options.apiBase);
    this.managementKey = options.managementKey;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.requester = createCliProxyRequester({
      apiBase: () => this.apiBase,
      managementKey: () => this.managementKey,
      fetcher: options.fetcher ?? globalThis.fetch.bind(globalThis)
    });
  }

  async saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
    this.apiBase = normalizeBaseUrl(request.apiBase);
    this.managementKey = request.managementKey;
    this.timeoutMs = request.timeoutMs ?? 15000;
    return {
      apiBase: this.apiBase,
      managementKeyMasked: maskSecret(this.managementKey),
      timeoutMs: this.timeoutMs,
      updatedAt: new Date().toISOString()
    };
  }

  async checkConnection(): Promise<GatewayConnectionStatusResponse> {
    const { response, body } = await this.requester.requestJson('/config');
    return {
      status: 'connected',
      checkedAt: new Date().toISOString(),
      serverVersion:
        response.headers.get('x-cpa-version') ??
        response.headers.get('x-cli-proxy-version') ??
        stringField(body, 'version'),
      serverBuildDate:
        response.headers.get('x-cpa-build-date') ??
        response.headers.get('x-cli-proxy-build-date') ??
        stringField(body, 'buildDate', 'build_date')
    };
  }

  async readRawConfig(): Promise<GatewayRawConfigResponse> {
    const { response, body } = await this.requester.requestText('/config.yaml');
    return { content: body, format: 'yaml', version: response.headers.get('etag') ?? 'unknown' };
  }

  async diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    const { body } = await this.requester.requestJson('/config/diff', 'POST', request);
    return {
      changed: booleanField(body, 'changed') ?? stringField(body, 'before') !== request.content,
      before: stringField(body, 'before') ?? '',
      after: stringField(body, 'after') ?? request.content
    };
  }

  async saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    const { response, body } = await this.requester.requestText(
      '/config.yaml',
      'PUT',
      request.content,
      'application/yaml'
    );
    return {
      content: body,
      format: 'yaml',
      version: response.headers.get('etag') ?? request.expectedVersion ?? 'unknown'
    };
  }

  async reloadConfig(): Promise<GatewayReloadConfigResponse> {
    const { body } = await this.requester.requestJson('/config/reload', 'POST', {});
    return { reloaded: booleanField(body, 'reloaded') ?? true, reloadedAt: stringField(body, 'reloadedAt') ?? now() };
  }

  async listApiKeys(): Promise<GatewayApiKeyListResponse> {
    return mapApiKeys((await this.requester.requestJson('/api-keys')).body);
  }

  async replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    await this.requester.requestJson('/api-keys', 'PUT', request.keys);
    return this.listApiKeys();
  }

  async updateApiKey(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    await this.requester.requestJson('/api-keys', 'PATCH', {
      index: Number(request.keyId),
      value: request.name
    });
    return this.listApiKeys();
  }

  async deleteApiKey(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    await this.requester.requestJson(`/api-keys?index=${request.index}`, 'DELETE');
    return this.listApiKeys();
  }

  async listProviderConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return createProviderConfigList();
  }

  async saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    await this.requester.requestJson(providerEndpoint(request.providerType), 'PUT', request);
    return request;
  }

  async discoverProviderModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    const { body } = await this.requester.requestJson(
      providerId === 'default' ? '/models' : `/model-definitions/${providerId}`
    );
    const providerKind = normalizeProviderKind(providerId);
    return {
      groups: [
        {
          providerId,
          providerKind,
          models: arrayBody(body, 'models', 'items').map(model => mapModel(model, providerKind))
        }
      ]
    };
  }

  async testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    const { body } = await this.requester.requestJson(`/providers/${providerId}/test-model`, 'POST', { model });
    return {
      providerId,
      ok: booleanField(body, 'ok', 'success') ?? true,
      latencyMs: numberField(body, 'latencyMs', 'latency_ms') ?? 0,
      inputTokens: numberField(body, 'inputTokens') ?? 0,
      outputTokens: numberField(body, 'outputTokens') ?? 0,
      message: stringField(body, 'message') ?? 'model test completed'
    };
  }

  async listAuthFiles(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse> {
    const { body } = await this.requester.requestJson(`/auth-files${queryString(query)}`);
    return { items: arrayBody(body, 'items', 'files').map(mapAuthFile), nextCursor: stringField(body, 'nextCursor') };
  }

  async batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    return uploadCliProxyAuthFiles(request, this.requester);
  }

  async patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    let body: unknown = { name: request.authFileId };
    if (request.disabled !== undefined) {
      body = (
        await this.requester.requestJson('/auth-files/status', 'PATCH', {
          disabled: request.disabled,
          name: request.authFileId
        })
      ).body;
    }
    if (hasCliProxyAuthFileFieldsPatch(request)) {
      body = (await this.requester.requestJson('/auth-files/fields', 'PATCH', toCliProxyAuthFilePatchBody(request)))
        .body;
    }
    return mapAuthFile({
      ...(typeof body === 'object' && body !== null ? body : {}),
      disabled: request.disabled,
      id: request.authFileId,
      name: request.authFileId
    });
  }

  async listAuthFileModels(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    const providerKind = normalizeProviderKind(authFileId);
    return {
      authFileId,
      models: [{ id: `${providerKind}-model`, displayName: `${providerKind} model`, providerKind, available: true }]
    };
  }

  async downloadAuthFile(authFileId: string): Promise<string> {
    return (await this.requester.requestText(`/auth-files/download?name=${encodeURIComponent(authFileId)}`)).body;
  }

  async deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    const { path, bodyPayload } = buildCliProxyAuthFileDeleteRequest(request);
    const { body } = await this.requester.requestJson(path, 'DELETE', bodyPayload);
    return mapCliProxyAuthFileDeleteResponse(request, body);
  }

  async listOAuthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return {
      providerId,
      modelAliases: arrayBody(
        (await this.requester.requestJson(`/oauth-model-alias?provider_id=${providerId}`)).body,
        'modelAliases'
      ).map(mapOAuthAlias),
      updatedAt: now()
    };
  }

  async saveOAuthModelAliases(
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse> {
    await this.requester.requestJson('/oauth-model-alias', 'PATCH', request);
    return { providerId: request.providerId, modelAliases: request.modelAliases, updatedAt: now() };
  }

  async getOAuthStatus(state: string): Promise<GatewayOAuthStatusResponse> {
    const { body } = await this.requester.requestJson(`/get-auth-status?state=${encodeURIComponent(state)}`);
    return { state, status: normalizeOAuthStatus(body), checkedAt: now() };
  }

  async submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    const { body } = await this.requester.requestJson('/oauth-callback', 'POST', {
      provider: request.provider,
      redirect_url: request.redirectUrl
    });
    return { accepted: booleanField(body, 'accepted', 'ok') ?? true, provider: request.provider, completedAt: now() };
  }

  async startProviderOAuth(request: GatewayProviderOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    const { body } = await this.requester.requestJson(providerOAuthRequestPath(request));
    return projectProviderOAuthStart(request, body);
  }

  async startGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    const { body } = await this.requester.requestJson(geminiCliOAuthRequestPath(request));
    return projectGeminiCliOAuthStart(request, body);
  }

  async importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    const { body } = await this.requester.requestJson('/vertex/import', 'POST', request);
    return projectVertexCredentialImport(request, body);
  }

  async managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    const startedAt = Date.now();
    const { response, body } = await this.requester.requestJson('/api-call', 'POST', request);
    const sanitizedBody = sanitizeGatewayProjectionValue(body);
    return {
      ok: booleanField(body, 'ok') ?? response.ok,
      statusCode: numberField(body, 'statusCode') ?? response.status,
      header: {},
      bodyText: JSON.stringify(sanitizedBody),
      body: sanitizedBody,
      durationMs: Date.now() - startedAt
    };
  }

  async refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    return refreshCliProxyQuotaDetails(providerKind, request => this.managementApiCall(request));
  }

  async listQuotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    return this.refreshQuotaDetails('custom');
  }

  async tailLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return this.searchLogs(request);
  }

  async searchLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    const items = arrayBody(
      (await this.requester.requestJson(`/logs${queryString(request)}`)).body,
      'items',
      'logs'
    ).map(mapRequestLog);
    return { items: items.slice(0, request.limit), total: items.length, nextCursor: null };
  }

  async listRequestErrorFiles(): Promise<GatewayLogFileListResponse> {
    return { items: [] };
  }

  async downloadRequestLog(id: string): Promise<string> {
    return (await this.requester.requestText(`/request-log-by-id/${encodeURIComponent(id)}`)).body;
  }

  async downloadRequestErrorFile(fileName: string): Promise<string> {
    return (await this.requester.requestText(`/request-error-logs/${encodeURIComponent(fileName)}`)).body;
  }

  async clearLogs(): Promise<GatewayClearLogsResponse> {
    await this.requester.requestJson('/logs', 'DELETE', {});
    return { cleared: true, clearedAt: now() };
  }

  async systemInfo(): Promise<GatewaySystemVersionResponse> {
    return mapSystemInfo(await this.checkConnection());
  }

  async latestVersion(): Promise<GatewaySystemVersionResponse> {
    const { body } = await this.requester.requestJson('/latest-version');
    const latestVersion = stringField(body, 'latest-version', 'latestVersion') ?? 'unknown';
    return {
      version: 'unknown',
      latestVersion,
      updateAvailable: false,
      links: {}
    };
  }

  async setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    await this.requester.requestJson('/request-log', 'PUT', { requestLog: enabled });
    return { requestLog: enabled, updatedAt: now() };
  }

  async clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return { cleared: true, clearedAt: now() };
  }

  async discoverModels(): Promise<GatewaySystemModelsResponse> {
    return this.discoverProviderModels('default');
  }
}
