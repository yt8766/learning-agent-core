import type {
  GatewayAuthFileListResponse,
  GatewayClient,
  GatewayClientApiKeyListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayDashboardSummaryResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayQuotaDetailListResponse,
  GatewaySnapshot
} from '@agent/core';
import type {
  AgentGatewayApiClient,
  GatewayApiKeyListResponse,
  GatewayProviderOAuthStartProvider,
  GatewayRawConfigResponse,
  GatewaySystemModelGroup,
  GatewaySystemVersionResponse
} from '../api/agent-gateway-api';
import { AuthFilesManagerPage } from './pages/AuthFilesManagerPage';
import { ClientsPage } from './pages/ClientsPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { DashboardPage } from './pages/DashboardPage';
import { OAuthPolicyPage } from './pages/OAuthPolicyPage';
import { ProviderConfigPage } from './pages/ProviderConfigPage';
import { QuotasPage } from './pages/QuotasPage';
import { SystemPage } from './pages/SystemPage';
import type { GatewayViewId } from './gateway-view-model';

export interface GatewayPageData {
  api?: AgentGatewayApiClient;
  apiKeys: GatewayApiKeyListResponse;
  authFiles: GatewayAuthFileListResponse;
  clientApiKeys: Record<string, GatewayClientApiKeyListResponse>;
  clientLogs: Record<string, GatewayClientRequestLogListResponse>;
  clientQuotas: Record<string, GatewayClientQuota>;
  clients: GatewayClient[];
  dashboard: GatewayDashboardSummaryResponse | null;
  modelGroups: GatewaySystemModelGroup[];
  onGatewayDataChanged?: () => void;
  onLogout: () => void;
  providerConfigs: GatewayProviderSpecificConfigListResponse;
  quotaDetails: GatewayQuotaDetailListResponse;
  rawConfig: GatewayRawConfigResponse | null;
  systemInfo: GatewaySystemVersionResponse | null;
}

export function renderActivePage(activeView: GatewayViewId, snapshot: GatewaySnapshot, pageData: GatewayPageData) {
  if (activeView === 'dashboard') {
    return pageData.dashboard ? (
      <DashboardPage summary={pageData.dashboard} />
    ) : (
      <div className="loading-panel">正在加载 Dashboard...</div>
    );
  }
  if (activeView === 'config') {
    return <ConfigEditorPage content={pageData.rawConfig?.content ?? ''} version={pageData.rawConfig?.version} />;
  }
  if (activeView === 'clients') {
    return (
      <ClientsPage
        apiKeysByClient={pageData.clientApiKeys}
        clients={pageData.clients}
        logsByClient={pageData.clientLogs}
        quotasByClient={pageData.clientQuotas}
        onCreateApiKey={clientId => {
          void pageData.api
            ?.createClientApiKey(clientId, { name: 'runtime key', scopes: ['models.read', 'chat.completions'] })
            .then(() => pageData.onGatewayDataChanged?.());
        }}
        onCreateClient={request => {
          void pageData.api?.createClient(request).then(() => pageData.onGatewayDataChanged?.());
        }}
        onToggleClient={client => {
          const action =
            client.status === 'active' ? pageData.api?.disableClient(client.id) : pageData.api?.enableClient(client.id);
          void action?.then(() => pageData.onGatewayDataChanged?.());
        }}
        onUpdateQuota={(clientId, request) => {
          void pageData.api?.updateClientQuota(clientId, request).then(() => pageData.onGatewayDataChanged?.());
        }}
      />
    );
  }
  if (activeView === 'aiProviders') {
    return (
      <ProviderConfigPage
        configs={pageData.providerConfigs}
        onRefreshModels={providerId => {
          void pageData.api?.providerConfigModels(providerId).then(() => pageData.onGatewayDataChanged?.());
        }}
        onSaveProvider={providerId => {
          const config = resolveProviderConfig(providerId, pageData.providerConfigs);
          if (config) {
            void pageData.api?.saveProviderConfig(config).then(() => pageData.onGatewayDataChanged?.());
          }
        }}
        onTestModel={(providerId, model) => {
          void pageData.api?.testProviderModel(providerId, model).then(() => pageData.onGatewayDataChanged?.());
        }}
      />
    );
  }
  if (activeView === 'authFiles') {
    return (
      <AuthFilesManagerPage
        authFiles={pageData.authFiles}
        onBatchDelete={() => {
          const names = pageData.authFiles.items.map(file => file.fileName);
          if (names.length > 0) {
            void pageData.api?.deleteAuthFiles({ names }).then(() => pageData.onGatewayDataChanged?.());
          }
        }}
        onBatchDownload={() => {
          const firstFile = pageData.authFiles.items[0];
          if (firstFile) {
            void pageData.api?.downloadAuthFile(firstFile.id);
          }
        }}
        onBatchUpload={() => {
          void pageData.api
            ?.batchUploadAuthFiles({
              files: [{ fileName: 'agent-gateway-upload.json', contentBase64: 'e30=' }]
            })
            .then(() => pageData.onGatewayDataChanged?.());
        }}
        onListModels={authFileId => {
          void pageData.api?.authFileModels(authFileId).then(() => pageData.onGatewayDataChanged?.());
        }}
        onPatchFields={authFileId => {
          void pageData.api
            ?.patchAuthFileFields({ authFileId, metadata: { touchedBy: 'agent-gateway-ui' } })
            .then(() => {
              pageData.onGatewayDataChanged?.();
            });
        }}
        onToggleStatus={authFileId => {
          void pageData.api
            ?.patchAuthFileFields({ authFileId, status: 'valid' })
            .then(() => pageData.onGatewayDataChanged?.());
        }}
      />
    );
  }
  if (activeView === 'oauth') {
    return (
      <OAuthPolicyPage
        onRefreshStatus={async state => pageData.api?.oauthStatus(state)}
        onStartOAuth={async providerId => {
          const result = await pageData.api?.startProviderOAuth(mapOAuthProviderStartId(providerId));
          pageData.onGatewayDataChanged?.();
          return result ?? { state: `${providerId}-oauth`, verificationUri: 'https://example.invalid/oauth', expiresAt: '' };
        }}
        onSubmitCallback={async (providerId, redirectUrl) => {
          const result = await pageData.api?.submitOAuthCallback({ provider: mapOAuthProviderId(providerId), redirectUrl });
          pageData.onGatewayDataChanged?.();
          return result ?? { accepted: false, provider: providerId, completedAt: '' };
        }}
      />
    );
  }
  if (activeView === 'quota') {
    return (
      <QuotasPage
        quotas={snapshot.quotas}
        onRefreshProviderQuota={providerKind => {
          void pageData.api?.refreshQuotaDetails(providerKind).then(() => pageData.onGatewayDataChanged?.());
        }}
        onUpdateQuota={quota => {
          void pageData.api?.updateQuota(quota).then(() => pageData.onGatewayDataChanged?.());
        }}
      />
    );
  }
  if (activeView === 'system') {
    return (
      <SystemPage
        info={
          pageData.systemInfo ?? {
            version: 'unknown',
            latestVersion: null,
            buildDate: null,
            updateAvailable: false,
            links: { help: 'https://help.router-for.me/' }
          }
        }
        modelGroups={
          pageData.modelGroups.length > 0
            ? pageData.modelGroups
            : snapshot.providerCredentialSets.map(provider => ({
                providerId: provider.provider,
                providerKind: 'custom',
                models: provider.modelFamilies.map(model => ({
                  id: model,
                  displayName: model,
                  providerKind: 'custom',
                  available: true
                }))
              }))
        }
        onCheckLatestVersion={() => {
          void pageData.api?.latestVersion().then(() => pageData.onGatewayDataChanged?.());
        }}
        onClearLocalLoginStorage={() => {
          void pageData.api?.clearLoginStorage().finally(() => pageData.onLogout());
        }}
        onEnableRequestLog={() => {
          void pageData.api?.setRequestLogEnabled(true).then(() => pageData.onGatewayDataChanged?.());
        }}
      />
    );
  }
  return pageData.dashboard ? (
    <DashboardPage summary={pageData.dashboard} />
  ) : (
    <div className="loading-panel">正在加载 Dashboard...</div>
  );
}

function resolveProviderConfig(
  providerId: string,
  configs: GatewayProviderSpecificConfigListResponse
): GatewayProviderSpecificConfigRecord | null {
  const existing = configs.items.find(config => config.id === providerId);
  if (existing) return existing;
  const providerType = providerId === 'openai-compatible' ? 'openaiCompatible' : providerId;
  if (!isProviderType(providerType)) return null;
  return {
    providerType,
    id: providerId,
    displayName: defaultProviderDisplayName(providerType),
    enabled: true,
    baseUrl: null,
    models: [],
    excludedModels: [],
    credentials: []
  };
}

function isProviderType(value: string): value is GatewayProviderSpecificConfigRecord['providerType'] {
  return ['gemini', 'codex', 'claude', 'vertex', 'openaiCompatible', 'ampcode'].includes(value);
}

function defaultProviderDisplayName(providerType: GatewayProviderSpecificConfigRecord['providerType']): string {
  if (providerType === 'openaiCompatible') return 'OpenAI Compatible';
  return providerType.charAt(0).toUpperCase() + providerType.slice(1);
}

function mapOAuthProviderId(providerId: string): string {
  if (providerId === 'claude') return 'anthropic';
  if (providerId === 'gemini-cli') return 'gemini';
  return providerId;
}

function mapOAuthProviderStartId(providerId: string): GatewayProviderOAuthStartProvider {
  if (providerId === 'claude') return 'anthropic';
  if (providerId === 'antigravity' || providerId === 'codex' || providerId === 'kimi') {
    return providerId;
  }
  return 'codex';
}
