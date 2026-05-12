import { AuthFilesManagerPage } from '../pages/AuthFilesManagerPage';
import { ClientsPage } from '../pages/ClientsPage';
import { ConfigEditorPage } from '../pages/ConfigEditorPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LogsManagerPage } from '../pages/LogsManagerPage';
import { MigrationPage } from '../pages/MigrationPage';
import { OAuthPolicyPage } from '../pages/OAuthPolicyPage';
import { ProviderConfigPage } from '../pages/ProviderConfigPage';
import { QuotasPage } from '../pages/QuotasPage';
import { RuntimeEnginePage } from '../pages/RuntimeEnginePage';
import { SystemPage } from '../pages/SystemPage';
import { UsageStatsPage } from '../pages/UsageStatsPage';
import type { GatewayViewId } from '../gateway-view-model';
import type { AgentGatewayApiClient } from '../../api/agent-gateway-api';
import type { GatewayProviderSpecificConfigRecord } from '../../api/agent-gateway-api';
import type { GatewayPageData } from './gateway-page-types';

export function renderGatewayPage(activeView: GatewayViewId, pageData: GatewayPageData) {
  if (activeView === 'dashboard') {
    return pageData.dashboard ? (
      <DashboardPage summary={pageData.dashboard} />
    ) : (
      <div className="loading-panel">正在加载 Dashboard...</div>
    );
  }
  if (activeView === 'config') {
    return (
      <ConfigEditorPage
        content={pageData.rawConfig?.content ?? ''}
        version={pageData.rawConfig?.version}
        onDiff={content =>
          requireAgentGatewayApiClient(pageData.api).diffRawConfig({
            content: content ?? pageData.rawConfig?.content ?? '',
            expectedVersion: pageData.rawConfig?.version
          })
        }
        onReload={() =>
          requireAgentGatewayApiClient(pageData.api)
            .reloadConfig()
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onSave={content =>
          requireAgentGatewayApiClient(pageData.api)
            .saveRawConfig({
              content: content ?? pageData.rawConfig?.content ?? '',
              expectedVersion: pageData.rawConfig?.version
            })
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
      />
    );
  }
  if (activeView === 'runtime') {
    return <RuntimeEnginePage health={pageData.runtimeHealth} />;
  }
  if (activeView === 'clients') {
    return (
      <ClientsPage
        apiKeysByClient={pageData.clientApiKeys}
        clients={pageData.clients}
        logsByClient={pageData.clientLogs}
        quotasByClient={pageData.clientQuotas}
        onCreateApiKey={clientId =>
          requireAgentGatewayApiClient(pageData.api)
            .createClientApiKey(clientId, { name: 'runtime key', scopes: ['models.read', 'chat.completions'] })
            .then(() => pageData.onGatewayDataChanged?.())
        }
        onCreateClient={request =>
          requireAgentGatewayApiClient(pageData.api)
            .createClient(request)
            .then(() => pageData.onGatewayDataChanged?.())
        }
        onToggleClient={client => {
          const api = requireAgentGatewayApiClient(pageData.api);
          const action = client.status === 'active' ? api.disableClient(client.id) : api.enableClient(client.id);
          return action.then(() => pageData.onGatewayDataChanged?.());
        }}
        onUpdateQuota={(clientId, request) =>
          requireAgentGatewayApiClient(pageData.api)
            .updateClientQuota(clientId, request)
            .then(() => pageData.onGatewayDataChanged?.())
        }
      />
    );
  }
  if (activeView === 'usageStats') {
    return pageData.usageAnalytics ? (
      <UsageStatsPage analytics={pageData.usageAnalytics} onRefresh={pageData.onGatewayDataChanged} />
    ) : (
      <div className="loading-panel">正在加载使用统计...</div>
    );
  }
  if (activeView === 'aiProviders') {
    return (
      <ProviderConfigPage
        configs={pageData.providerConfigs}
        onRefreshModels={providerId =>
          requireAgentGatewayApiClient(pageData.api)
            .providerConfigModels(providerId)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onSaveProvider={config =>
          requireAgentGatewayApiClient(pageData.api)
            .saveProviderConfig(config)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onTestModel={(providerId, model) =>
          requireAgentGatewayApiClient(pageData.api)
            .testProviderModel(providerId, model)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onAddProvider={providerSectionId =>
          requireAgentGatewayApiClient(pageData.api)
            .saveProviderConfig(createDefaultProviderConfig(providerSectionId))
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
      />
    );
  }
  if (activeView === 'authFiles') {
    return (
      <AuthFilesManagerPage
        authFiles={pageData.authFiles}
        onBatchDelete={(fileNames = []) => {
          const names = fileNames.length > 0 ? fileNames : pageData.authFiles.items.map(file => file.fileName);
          if (names.length === 0) throw new Error('暂无可删除的认证文件');
          return requireAgentGatewayApiClient(pageData.api)
            .deleteAuthFiles({ names })
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            });
        }}
        onBatchDownload={async (authFileIds = []) => {
          const ids = authFileIds.length > 0 ? authFileIds : pageData.authFiles.items.map(file => file.id);
          if (ids.length === 0) throw new Error('暂无可下载的认证文件');
          await Promise.all(ids.map(id => requireAgentGatewayApiClient(pageData.api).downloadAuthFile(id)));
          return { ids };
        }}
        onBatchUpload={files => {
          if (files.length === 0) throw new Error('没有选择可上传的文件');
          return requireAgentGatewayApiClient(pageData.api)
            .batchUploadAuthFiles({
              files
            })
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            });
        }}
        onListModels={authFileId =>
          requireAgentGatewayApiClient(pageData.api)
            .authFileModels(authFileId)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onLoadOAuthAliases={providerId =>
          requireAgentGatewayApiClient(pageData.api)
            .oauthModelAliases(providerId)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onSaveOAuthAliases={(providerId, request) =>
          requireAgentGatewayApiClient(pageData.api)
            .saveOAuthModelAliases(providerId, request)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onPatchFields={(authFileId, patch) =>
          requireAgentGatewayApiClient(pageData.api)
            .patchAuthFileFields({
              authFileId,
              ...(patch ?? { metadata: { touchedBy: 'agent-gateway-ui' } })
            })
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onToggleStatus={(authFileId, nextDisabled) => {
          const current = pageData.authFiles?.items.find(file => file.id === authFileId);
          const disabled = typeof nextDisabled === 'boolean' ? nextDisabled : !current?.disabled;
          return requireAgentGatewayApiClient(pageData.api)
            .patchAuthFileFields({ authFileId, disabled })
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            });
        }}
      />
    );
  }
  if (activeView === 'oauth') {
    return (
      <OAuthPolicyPage
        onRefreshStatus={async state => requireAgentGatewayApiClient(pageData.api).oauthStatus(state)}
        onStartOAuth={async (providerId, options) => {
          const api = requireAgentGatewayApiClient(pageData.api);
          const result =
            providerId === 'gemini-cli'
              ? await api.startGeminiCliOAuth(options?.projectId ? { projectId: options.projectId } : {})
              : await api.startProviderOAuth(providerId);
          pageData.onGatewayDataChanged?.();
          return result;
        }}
        onSubmitCallback={async (providerId, redirectUrl) => {
          const result = await requireAgentGatewayApiClient(pageData.api).submitOAuthCallback({
            provider: mapOAuthProviderId(providerId),
            redirectUrl
          });
          pageData.onGatewayDataChanged?.();
          return result;
        }}
      />
    );
  }
  if (activeView === 'quota') {
    return (
      <QuotasPage
        quotas={pageData.snapshot?.quotas ?? []}
        onRefreshProviderQuota={providerKind =>
          requireAgentGatewayApiClient(pageData.api)
            .refreshQuotaDetails(providerKind)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onUpdateQuota={quota =>
          requireAgentGatewayApiClient(pageData.api)
            .updateQuota(quota)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
      />
    );
  }
  if (activeView === 'logs') {
    return (
      <LogsManagerPage
        logs={pageData.logs}
        onClearLogs={() =>
          requireAgentGatewayApiClient(pageData.api)
            .clearLogs()
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
      />
    );
  }
  if (activeView === 'migration') {
    return (
      <MigrationPage
        onApply={async request => {
          const result = await requireAgentGatewayApiClient(pageData.api).applyMigration(request);
          pageData.onGatewayDataChanged?.();
          return result;
        }}
        onPreview={async request => {
          const result = await requireAgentGatewayApiClient(pageData.api).previewMigration(request);
          pageData.onGatewayDataChanged?.();
          return result;
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
        modelGroups={pageData.modelGroups}
        runtimeHealth={pageData.runtimeHealth}
        onCheckLatestVersion={() =>
          requireAgentGatewayApiClient(pageData.api)
            .latestVersion()
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onRefreshModels={() =>
          requireAgentGatewayApiClient(pageData.api)
            .discoverModels()
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
        onClearLocalLoginStorage={() =>
          requireAgentGatewayApiClient(pageData.api)
            .clearLoginStorage()
            .finally(() => pageData.onLogout())
        }
        onEnableRequestLog={() =>
          requireAgentGatewayApiClient(pageData.api)
            .setRequestLogEnabled(true)
            .then(response => {
              pageData.onGatewayDataChanged?.();
              return response;
            })
        }
      />
    );
  }
  return pageData.dashboard ? (
    <DashboardPage summary={pageData.dashboard} />
  ) : (
    <div className="loading-panel">正在加载 Dashboard...</div>
  );
}

function mapOAuthProviderId(providerId: string): string {
  if (providerId === 'claude') return 'anthropic';
  if (providerId === 'gemini-cli') return 'gemini';
  return providerId;
}

function createDefaultProviderConfig(providerSectionId: string): GatewayProviderSpecificConfigRecord {
  return {
    providerType: mapProviderSectionIdToProviderType(providerSectionId),
    id: providerSectionId,
    displayName: defaultProviderDisplayName(providerSectionId),
    enabled: true,
    baseUrl: null,
    models: [],
    excludedModels: [],
    credentials: []
  };
}

function mapProviderSectionIdToProviderType(
  providerSectionId: string
): GatewayProviderSpecificConfigRecord['providerType'] {
  if (providerSectionId === 'openai-compatible') return 'openaiCompatible';
  if (
    providerSectionId === 'gemini' ||
    providerSectionId === 'codex' ||
    providerSectionId === 'claude' ||
    providerSectionId === 'vertex' ||
    providerSectionId === 'ampcode'
  ) {
    return providerSectionId;
  }
  throw new Error(`不支持的提供商 section id：${providerSectionId}`);
}

function defaultProviderDisplayName(providerSectionId: string): string {
  if (providerSectionId === 'openai-compatible') return 'OpenAI Compatible';
  if (providerSectionId === 'gemini') return 'Gemini';
  if (providerSectionId === 'codex') return 'Codex';
  if (providerSectionId === 'claude') return 'Claude';
  if (providerSectionId === 'vertex') return 'Vertex';
  if (providerSectionId === 'ampcode') return 'Ampcode';
  return providerSectionId;
}

function requireAgentGatewayApiClient(api: AgentGatewayApiClient | undefined): AgentGatewayApiClient {
  if (!api) {
    throw new Error('AgentGatewayApiClient is required for Agent Gateway operations.');
  }
  return api;
}
