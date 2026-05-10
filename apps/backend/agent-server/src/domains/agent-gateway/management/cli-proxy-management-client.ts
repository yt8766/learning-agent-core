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
  arrayBody,
  arrayOfStrings,
  asRecord,
  booleanField,
  createProviderConfigList,
  createQuotaDetails,
  mapApiKeys,
  mapAuthFile,
  mapBatchUploadAuthFiles,
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
  type RecordBody,
  stringField,
  throwProxyError
} from './cli-proxy-management-client.helpers';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface CliProxyManagementClientOptions {
  apiBase: string;
  managementKey: string;
  timeoutMs?: number;
  fetcher?: Fetcher;
}

@Injectable()
export class CliProxyManagementClient implements AgentGatewayManagementClient {
  private apiBase: string;
  private managementKey: string;
  private timeoutMs: number;
  private readonly fetcher: Fetcher;

  constructor(options: CliProxyManagementClientOptions) {
    if (!options.apiBase || !options.managementKey) {
      throw new Error('CLI Proxy management client requires apiBase and managementKey');
    }
    this.apiBase = normalizeBaseUrl(options.apiBase);
    this.managementKey = options.managementKey;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
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
    const { response, body } = await this.requestJson('/config');
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
    const { response, body } = await this.requestText('/config.yaml');
    return { content: body, format: 'yaml', version: response.headers.get('etag') ?? 'unknown' };
  }

  async diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    const { body } = await this.requestJson('/config/diff', 'POST', request);
    return {
      changed: booleanField(body, 'changed') ?? stringField(body, 'before') !== request.content,
      before: stringField(body, 'before') ?? '',
      after: stringField(body, 'after') ?? request.content
    };
  }

  async saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    const { response, body } = await this.requestText('/config.yaml', 'PUT', request.content, 'application/yaml');
    return {
      content: body,
      format: 'yaml',
      version: response.headers.get('etag') ?? request.expectedVersion ?? 'unknown'
    };
  }

  async reloadConfig(): Promise<GatewayReloadConfigResponse> {
    const { body } = await this.requestJson('/config/reload', 'POST', {});
    return { reloaded: booleanField(body, 'reloaded') ?? true, reloadedAt: stringField(body, 'reloadedAt') ?? now() };
  }

  async listApiKeys(): Promise<GatewayApiKeyListResponse> {
    return mapApiKeys((await this.requestJson('/api-keys')).body);
  }

  async replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    await this.requestJson('/api-keys', 'PUT', request.keys);
    return this.listApiKeys();
  }

  async updateApiKey(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    await this.requestJson('/api-keys', 'PATCH', {
      index: Number(request.keyId),
      value: request.name
    });
    return this.listApiKeys();
  }

  async deleteApiKey(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    await this.requestJson(`/api-keys?index=${request.index}`, 'DELETE');
    return this.listApiKeys();
  }

  async listProviderConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return createProviderConfigList();
  }

  async saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    await this.requestJson(providerEndpoint(request.providerType), 'PUT', request);
    return request;
  }

  async discoverProviderModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    const { body } = await this.requestJson(providerId === 'default' ? '/models' : `/model-definitions/${providerId}`);
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
    const { body } = await this.requestJson(`/providers/${providerId}/test-model`, 'POST', { model });
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
    const { body } = await this.requestJson(`/auth-files${queryString(query)}`);
    return { items: arrayBody(body, 'items', 'files').map(mapAuthFile), nextCursor: stringField(body, 'nextCursor') };
  }

  async batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    const accepted: GatewayAuthFileBatchUploadResponse['accepted'] = [];
    const rejected: GatewayAuthFileBatchUploadResponse['rejected'] = [];
    for (const file of request.files) {
      try {
        const content = Buffer.from(file.contentBase64, 'base64').toString('utf8');
        const { body } = await this.requestJson(
          `/auth-files?name=${encodeURIComponent(file.fileName)}`,
          'POST',
          content,
          'application/json'
        );
        accepted.push(...mapBatchUploadAuthFiles(body, { files: [file] }).accepted);
      } catch (error) {
        rejected.push({ fileName: file.fileName, reason: error instanceof Error ? error.message : 'upload failed' });
      }
    }
    return { accepted, rejected };
  }

  async patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    return mapAuthFile({
      ...(await this.requestJson('/auth-files/fields', 'PATCH', toCliProxyAuthFilePatchBody(request))).body,
      id: request.authFileId
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
    return (await this.requestText(`/auth-files/download?name=${encodeURIComponent(authFileId)}`)).body;
  }

  async deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    const path = request.all ? '/auth-files?all=true' : `/auth-files${queryString({ name: request.names?.[0] })}`;
    const bodyPayload = request.all || request.names?.length === 1 ? undefined : request.names;
    const { body } = await this.requestJson(path, 'DELETE', bodyPayload);
    const deletedCount = numberField(body, 'deleted');
    return {
      deleted: arrayOfStrings(body.files) ?? request.names ?? (deletedCount ? [`${deletedCount} files`] : []),
      skipped: arrayBody(body, 'failed', 'skipped').map(item => {
        const record = asRecord(item);
        return { name: stringField(record, 'name') ?? 'unknown', reason: stringField(record, 'error', 'reason') ?? '' };
      })
    };
  }

  async listOAuthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return {
      providerId,
      modelAliases: arrayBody(
        (await this.requestJson(`/oauth-model-alias?provider_id=${providerId}`)).body,
        'modelAliases'
      ).map(mapOAuthAlias),
      updatedAt: now()
    };
  }

  async saveOAuthModelAliases(
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse> {
    await this.requestJson('/oauth-model-alias', 'PATCH', request);
    return { providerId: request.providerId, modelAliases: request.modelAliases, updatedAt: now() };
  }

  async getOAuthStatus(state: string): Promise<GatewayOAuthStatusResponse> {
    const { body } = await this.requestJson(`/get-auth-status?state=${encodeURIComponent(state)}`);
    return { state, status: normalizeOAuthStatus(body), checkedAt: now() };
  }

  async submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    const { body } = await this.requestJson('/oauth-callback', 'POST', {
      provider: request.provider,
      redirect_url: request.redirectUrl
    });
    return { accepted: booleanField(body, 'accepted', 'ok') ?? true, provider: request.provider, completedAt: now() };
  }

  async startProviderOAuth(request: GatewayProviderOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    const params = new URLSearchParams();
    if (request.isWebui) params.set('is_webui', 'true');
    if (request.projectId) params.set('project_id', request.projectId);
    const query = params.toString();
    const path = `/${request.provider}-auth-url${query ? `?${query}` : ''}`;
    const { body } = await this.requestJson(path);
    return {
      state: stringField(body, 'state') ?? `${request.provider}-oauth`,
      verificationUri:
        stringField(body, 'url', 'authUrl', 'verificationUri', 'verification_uri', 'deviceUrl', 'device_url') ?? '',
      userCode: stringField(body, 'userCode', 'user_code'),
      expiresAt: now(),
      projectId: request.projectId
    };
  }

  async startGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    const projectId = request.projectId ?? 'default';
    const { body } = await this.requestJson(`/gemini-cli-auth-url?is_webui=true&project_id=${projectId}`);
    return {
      state: stringField(body, 'state') ?? `gemini-cli-${projectId}`,
      verificationUri: stringField(body, 'url', 'authUrl') ?? '',
      userCode: stringField(body, 'userCode'),
      expiresAt: now(),
      projectId
    };
  }

  async importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    const { body } = await this.requestJson('/vertex/import', 'POST', request);
    return {
      status: 'ok',
      imported: true,
      projectId: stringField(body, 'projectId'),
      location: request.location,
      authFile: request.fileName,
      authFileId: request.fileName
    };
  }

  async managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    const startedAt = Date.now();
    const { response, body } = await this.requestJson('/api-call', 'POST', request);
    return {
      ok: booleanField(body, 'ok') ?? response.ok,
      statusCode: numberField(body, 'statusCode') ?? response.status,
      header: {},
      bodyText: JSON.stringify(body),
      body,
      durationMs: Date.now() - startedAt
    };
  }

  async refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    return createQuotaDetails(providerKind);
  }

  async listQuotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    return this.refreshQuotaDetails('custom');
  }

  async tailLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return this.searchLogs(request);
  }

  async searchLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    const items = arrayBody((await this.requestJson(`/logs${queryString(request)}`)).body, 'items', 'logs').map(
      mapRequestLog
    );
    return { items: items.slice(0, request.limit), total: items.length, nextCursor: null };
  }

  async listRequestErrorFiles(): Promise<GatewayLogFileListResponse> {
    return { items: [] };
  }

  async downloadRequestLog(id: string): Promise<string> {
    return (await this.requestText(`/request-log-by-id/${encodeURIComponent(id)}`)).body;
  }

  async downloadRequestErrorFile(fileName: string): Promise<string> {
    return (await this.requestText(`/request-error-logs/${encodeURIComponent(fileName)}`)).body;
  }

  async clearLogs(): Promise<GatewayClearLogsResponse> {
    await this.requestJson('/logs', 'DELETE', {});
    return { cleared: true, clearedAt: now() };
  }

  async systemInfo(): Promise<GatewaySystemVersionResponse> {
    return mapSystemInfo(await this.checkConnection());
  }

  async latestVersion(): Promise<GatewaySystemVersionResponse> {
    const { body } = await this.requestJson('/latest-version');
    const latestVersion = stringField(body, 'latest-version', 'latestVersion') ?? 'unknown';
    return {
      version: 'unknown',
      latestVersion,
      updateAvailable: false,
      links: {}
    };
  }

  async setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    await this.requestJson('/request-log', 'PUT', { requestLog: enabled });
    return { requestLog: enabled, updatedAt: now() };
  }

  async clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return { cleared: true, clearedAt: now() };
  }

  async discoverModels(): Promise<GatewaySystemModelsResponse> {
    return this.discoverProviderModels('default');
  }

  private async requestJson(
    path: string,
    method = 'GET',
    body?: unknown,
    contentType = 'application/json'
  ): Promise<{ response: Response; body: RecordBody }> {
    const response = await this.request(
      path,
      method,
      body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      body === undefined ? undefined : contentType
    );
    return { response, body: asRecord(await response.json()) };
  }

  private async requestText(
    path: string,
    method = 'GET',
    body?: string,
    contentType?: string
  ): Promise<{ response: Response; body: string }> {
    const response = await this.request(path, method, body, contentType);
    return { response, body: await response.text() };
  }

  private async request(path: string, method: string, body?: string, contentType?: string): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.managementKey}`,
      'x-management-key': this.managementKey
    };
    if (contentType) headers['content-type'] = contentType;
    const response = await this.fetcher(`${this.apiBase}${path}`, { method, headers, body });
    if (!response.ok) await throwProxyError(response);
    return response;
  }
}

function toCliProxyAuthFilePatchBody(request: GatewayAuthFilePatchRequest): Record<string, unknown> {
  return {
    name: request.authFileId,
    note: request.accountEmail ?? undefined,
    disabled:
      request.status === 'invalid' || request.status === 'missing' || request.status === 'expired' ? true : undefined
  };
}
