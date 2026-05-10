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
  GatewayRequestLogListResponse,
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
  GatewaySystemModelsResponse,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayReplaceApiKeysRequest,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySystemVersionResponse,
  GatewayUpdateApiKeyRequest,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse,
  GatewayRequestLogSettingResponse
} from '@agent/core';
import type {
  AgentGatewayManagementClient,
  GatewayAuthFileListQuery,
  GatewayStartOAuthProjection
} from './agent-gateway-management-client';
import {
  createMemoryAuthFile,
  createMemoryAuthFiles,
  createMemoryLogs,
  createMemoryManagementApiCall,
  createMemoryProviderConfigs,
  createMemoryQuotaDetails,
  createMemorySystemModels,
  fixedNow,
  inferAuthFileProviderKind,
  maskSecret,
  normalizeLimit,
  projectMemoryLogs,
  providerTypeToKind
} from './memory-agent-gateway-management-client.helpers';

@Injectable()
export class MemoryAgentGatewayManagementClient implements AgentGatewayManagementClient {
  private profile: GatewaySaveConnectionProfileRequest | null = null;
  private configContent = 'debug: true\nrequest-retry: 2\n';
  private configVersion = 1;
  private apiKeys: string[] = [];
  private requestLogEnabled = true;
  private providerConfigs = createMemoryProviderConfigs();
  private authFiles = createMemoryAuthFiles();
  private oauthAliases = new Map<string, GatewayOAuthModelAliasListResponse>();
  private logs = createMemoryLogs();

  async saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
    const timeoutMs = request.timeoutMs ?? 15000;
    this.profile = { ...request, timeoutMs };
    return {
      apiBase: request.apiBase,
      managementKeyMasked: maskSecret(request.managementKey),
      timeoutMs,
      updatedAt: fixedNow
    };
  }

  async checkConnection(): Promise<GatewayConnectionStatusResponse> {
    return {
      status: this.profile ? 'connected' : 'disconnected',
      checkedAt: fixedNow,
      serverVersion: this.profile ? 'memory-cli-proxy' : null,
      serverBuildDate: this.profile ? '2026-05-08' : null
    };
  }

  async readRawConfig(): Promise<GatewayRawConfigResponse> {
    return { content: this.configContent, format: 'yaml', version: `config-${this.configVersion}` };
  }

  async diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return { changed: request.content !== this.configContent, before: this.configContent, after: request.content };
  }

  async saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    this.configContent = request.content;
    this.configVersion += 1;
    return this.readRawConfig();
  }

  async reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return { reloaded: true, reloadedAt: fixedNow };
  }

  async listApiKeys(): Promise<GatewayApiKeyListResponse> {
    return {
      items: this.apiKeys.map((key, index) => ({
        id: `proxy-key-${index}`,
        name: `Proxy key ${index + 1}`,
        prefix: maskSecret(key),
        status: 'active',
        scopes: ['proxy:invoke'],
        createdAt: fixedNow,
        lastUsedAt: null,
        expiresAt: null,
        usage: { requestCount: 0, lastRequestAt: null }
      }))
    };
  }

  async replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    this.apiKeys = [...request.keys];
    return this.listApiKeys();
  }

  async updateApiKey(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    const index = Number(request.keyId);
    if (Number.isInteger(index) && request.name) this.apiKeys[index] = request.name;
    return this.listApiKeys();
  }

  async deleteApiKey(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse> {
    this.apiKeys.splice(request.index, 1);
    return this.listApiKeys();
  }

  async listProviderConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return { items: Array.from(this.providerConfigs.values()).map(item => ({ ...item })) };
  }

  async saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    this.providerConfigs.set(request.id, { ...request });
    return { ...request };
  }

  async discoverProviderModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    const config = this.providerConfigs.get(providerId);
    const providerKind = providerTypeToKind(config?.providerType);
    return {
      groups: [
        {
          providerId,
          providerKind,
          models: (config?.models.length ? config.models : [{ name: `${providerId}-model` }]).map(model => ({
            id: model.name,
            displayName: model.alias ?? model.name,
            providerKind,
            available: true
          }))
        }
      ]
    };
  }

  async testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    return {
      providerId,
      ok: true,
      latencyMs: 12,
      inputTokens: 1,
      outputTokens: 1,
      message: `Model ${model} responded`
    };
  }

  async listAuthFiles(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse> {
    const normalizedQuery = query.query?.trim().toLowerCase();
    const items = Array.from(this.authFiles.values()).filter(item => {
      if (query.providerKind && item.providerKind !== query.providerKind) return false;
      if (!normalizedQuery) return true;
      return (
        item.fileName.toLowerCase().includes(normalizedQuery) || item.providerId.toLowerCase().includes(normalizedQuery)
      );
    });
    return {
      items: items.slice(0, normalizeLimit(query.limit, 100, 500)).map(item => ({ ...item })),
      nextCursor: null
    };
  }

  async batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    const accepted = request.files.map(file => {
      const providerKind = file.providerKind ?? inferAuthFileProviderKind(file.fileName);
      const authFile: GatewayAuthFile = {
        id: file.fileName,
        providerId: providerKind,
        providerKind,
        fileName: file.fileName,
        path: `/memory/${file.fileName}`,
        status: 'valid',
        accountEmail: null,
        projectId: null,
        modelCount: 1,
        updatedAt: fixedNow,
        metadata: { contentBytes: file.contentBase64.length }
      };
      this.authFiles.set(file.fileName, authFile);
      return {
        authFileId: authFile.id,
        fileName: authFile.fileName,
        providerKind: authFile.providerKind,
        status: authFile.status
      };
    });
    return { accepted, rejected: [] };
  }

  async patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    const current = this.authFiles.get(request.authFileId) ?? createMemoryAuthFile(request.authFileId);
    const next: GatewayAuthFile = {
      ...current,
      providerId: request.providerId ?? current.providerId,
      accountEmail: request.accountEmail === undefined ? current.accountEmail : request.accountEmail,
      projectId: request.projectId === undefined ? current.projectId : request.projectId,
      status: request.status ?? current.status,
      updatedAt: fixedNow,
      metadata: { ...(current.metadata ?? {}), ...(request.metadata ?? {}) }
    };
    this.authFiles.set(next.id, next);
    return { ...next };
  }

  async listAuthFileModels(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    const authFile = this.authFiles.get(authFileId) ?? createMemoryAuthFile(authFileId);
    return {
      authFileId,
      models: [
        {
          id: `${authFile.providerKind}-model`,
          displayName: `${authFile.providerKind} model`,
          providerKind: authFile.providerKind,
          available: true
        }
      ]
    };
  }

  async downloadAuthFile(authFileId: string): Promise<string> {
    return JSON.stringify({ authFileId, provider: this.authFiles.get(authFileId)?.providerKind ?? 'unknown' });
  }

  async deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    const names = request.all ? Array.from(this.authFiles.keys()) : (request.names ?? []);
    const deleted: string[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const name of names) {
      if (this.authFiles.delete(name)) deleted.push(name);
      else skipped.push({ name, reason: 'not found' });
    }
    return { deleted, skipped };
  }

  async listOAuthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return this.oauthAliases.get(providerId) ?? { providerId, modelAliases: [], updatedAt: fixedNow };
  }

  async saveOAuthModelAliases(
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse> {
    const response = { providerId: request.providerId, modelAliases: [...request.modelAliases], updatedAt: fixedNow };
    this.oauthAliases.set(request.providerId, response);
    return response;
  }

  async getOAuthStatus(state: string): Promise<GatewayOAuthStatusResponse> {
    return { state, status: 'pending', checkedAt: fixedNow };
  }

  async submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    return { accepted: true, provider: request.provider, completedAt: fixedNow };
  }

  async startProviderOAuth(request: GatewayProviderOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    if (request.provider === 'kimi') {
      return {
        state: 'kimi-device',
        verificationUri: 'https://www.kimi.com/code/authorize_device?user_code=MEMO-RYKI',
        userCode: 'MEMO-RYKI',
        expiresAt: '2026-05-08T00:15:00.000Z',
        projectId: request.projectId
      };
    }
    return {
      state: `${request.provider}-state`,
      verificationUri: [
        `https://gateway.local/${request.provider}-auth-url`,
        `?is_webui=${String(request.isWebui === true)}`,
        '&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback'
      ].join(''),
      userCode: `MEMORY-${request.provider.toUpperCase()}`,
      expiresAt: '2026-05-08T00:15:00.000Z',
      projectId: request.projectId
    };
  }

  async startGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayStartOAuthProjection> {
    return {
      state: `gemini-cli-${request.projectId ?? 'default'}`,
      verificationUri: 'https://accounts.google.com/o/oauth2/v2/auth',
      userCode: 'MEMORY-GEMINI',
      expiresAt: '2026-05-08T00:15:00.000Z',
      projectId: request.projectId
    };
  }

  async importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    return {
      status: 'ok',
      imported: true,
      projectId: 'memory-vertex',
      email: 'vertex@example.com',
      location: request.location,
      authFile: request.fileName,
      authFileId: request.fileName
    };
  }

  async managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    return createMemoryManagementApiCall(request);
  }

  async refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    const details = await this.listQuotaDetails();
    return { items: details.items.map(item => ({ ...item, providerId: providerKind })) };
  }

  async listQuotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    return createMemoryQuotaDetails();
  }

  async tailLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return projectMemoryLogs(this.logs, request);
  }

  async searchLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse> {
    return projectMemoryLogs(this.logs, request);
  }

  async listRequestErrorFiles(): Promise<GatewayLogFileListResponse> {
    return {
      items: [
        {
          fileName: 'request-error-1.log',
          path: '/logs/request-error-1.log',
          sizeBytes: 42,
          modifiedAt: fixedNow,
          downloadUrl: '/agent-gateway/logs/request-error-files/request-error-1.log'
        }
      ]
    };
  }

  async downloadRequestLog(id: string): Promise<string> {
    const log = this.logs.find(item => item.id === id);
    return JSON.stringify(log ?? { id, missing: true });
  }

  async downloadRequestErrorFile(fileName: string): Promise<string> {
    return `request error file: ${fileName}`;
  }

  async clearLogs(): Promise<GatewayClearLogsResponse> {
    this.logs = [];
    return { cleared: true, clearedAt: fixedNow };
  }

  async systemInfo(): Promise<GatewaySystemVersionResponse> {
    return {
      version: 'memory-cli-proxy',
      latestVersion: 'memory-cli-proxy',
      buildDate: '2026-05-08',
      updateAvailable: false,
      links: { help: 'https://help.router-for.me/' }
    };
  }

  async latestVersion(): Promise<GatewaySystemVersionResponse> {
    return this.systemInfo();
  }

  async setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    this.requestLogEnabled = enabled;
    return { requestLog: this.requestLogEnabled, updatedAt: fixedNow };
  }

  async clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return { cleared: true, clearedAt: fixedNow };
  }

  async discoverModels(): Promise<GatewaySystemModelsResponse> {
    return createMemorySystemModels();
  }
}
