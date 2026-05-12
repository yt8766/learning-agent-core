import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { AgentGatewayApiClient } from '../api/agent-gateway-api';
import { GatewayAuthProvider, useGatewayAuth } from '../auth/auth-session';
import { GatewayWorkspace } from './GatewayWorkspace';
import { LoginPage } from './pages/LoginPage';
import './App.scss';

type GatewayWorkspaceQueryApi = Pick<
  AgentGatewayApiClient,
  | 'apiKeys'
  | 'authFiles'
  | 'clients'
  | 'dashboard'
  | 'discoverModels'
  | 'logs'
  | 'providerConfigs'
  | 'quotaDetails'
  | 'rawConfig'
  | 'runtimeHealth'
  | 'snapshot'
  | 'systemInfo'
  | 'usage'
  | 'usageAnalytics'
>;
type GatewayQueryData<K extends keyof GatewayWorkspaceQueryApi> = Awaited<ReturnType<GatewayWorkspaceQueryApi[K]>>;

export function createGatewayQuerySpecs(api: GatewayWorkspaceQueryApi, accessToken: string | null, enabled: boolean) {
  return [
    {
      queryKey: ['agent-gateway', 'snapshot', accessToken],
      queryFn: () => api.snapshot(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'logs', accessToken],
      queryFn: () => api.logs(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'usage', accessToken],
      queryFn: () => api.usage(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'usage-analytics', accessToken],
      queryFn: () => api.usageAnalytics({ range: 'today', limit: 100 }),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'api-keys', accessToken],
      queryFn: () => api.apiKeys(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'raw-config', accessToken],
      queryFn: () => api.rawConfig(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'dashboard', accessToken],
      queryFn: () => api.dashboard(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'clients', accessToken],
      queryFn: () => api.clients(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'quota-details', accessToken],
      queryFn: () => api.quotaDetails(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'runtime-health', accessToken],
      queryFn: () => api.runtimeHealth(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'system-info', accessToken],
      queryFn: () => api.systemInfo(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'system-models', accessToken],
      queryFn: () => api.discoverModels(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'provider-configs', accessToken],
      queryFn: () => api.providerConfigs(),
      enabled,
      retry: false
    },
    {
      queryKey: ['agent-gateway', 'auth-files', accessToken],
      queryFn: () => api.authFiles({ limit: 100 }),
      enabled,
      retry: false
    }
  ];
}

export function App() {
  return (
    <GatewayAuthProvider>
      <GatewayShell />
    </GatewayAuthProvider>
  );
}
function GatewayShell() {
  const auth = useGatewayAuth();
  const queryClient = useQueryClient();
  const api = useMemo(
    () =>
      new AgentGatewayApiClient({
        getAccessToken: () => auth.accessToken,
        refreshAccessToken: auth.refreshAccessToken
      }),
    [auth.accessToken, auth.refreshAccessToken]
  );
  const enabled = Boolean(auth.accessToken);
  const [
    snapshotQuery,
    logsQuery,
    usageQuery,
    usageAnalyticsQuery,
    apiKeysQuery,
    rawConfigQuery,
    dashboardQuery,
    clientsQuery,
    quotaDetailsQuery,
    runtimeHealthQuery,
    systemInfoQuery,
    modelGroupsQuery,
    providerConfigsQuery,
    authFilesQuery
  ] = useQueries({
    queries: createGatewayQuerySpecs(api, auth.accessToken, enabled)
  });
  const handleGatewayDataChanged = () => {
    void queryClient.invalidateQueries({ queryKey: ['agent-gateway'] });
  };
  const apiKeysData = apiKeysQuery.data as GatewayQueryData<'apiKeys'> | undefined;
  const authFilesData = authFilesQuery.data as GatewayQueryData<'authFiles'> | undefined;
  const clientsData = clientsQuery.data as GatewayQueryData<'clients'> | undefined;
  const dashboardData = dashboardQuery.data as GatewayQueryData<'dashboard'> | undefined;
  const logsData = logsQuery.data as GatewayQueryData<'logs'> | undefined;
  const modelGroupsData = modelGroupsQuery.data as GatewayQueryData<'discoverModels'> | undefined;
  const providerConfigsData = providerConfigsQuery.data as GatewayQueryData<'providerConfigs'> | undefined;
  const quotaDetailsData = quotaDetailsQuery.data as GatewayQueryData<'quotaDetails'> | undefined;
  const rawConfigData = rawConfigQuery.data as GatewayQueryData<'rawConfig'> | undefined;
  const runtimeHealthData = runtimeHealthQuery.data as GatewayQueryData<'runtimeHealth'> | undefined;
  const snapshotData = snapshotQuery.data as GatewayQueryData<'snapshot'> | undefined;
  const systemInfoData = systemInfoQuery.data as GatewayQueryData<'systemInfo'> | undefined;
  const usageData = usageQuery.data as GatewayQueryData<'usage'> | undefined;
  const usageAnalyticsData = usageAnalyticsQuery.data as GatewayQueryData<'usageAnalytics'> | undefined;
  const clients = clientsData?.items ?? [];
  const clientQuotaQueries = useQueries({
    queries: clients.map(client => ({
      queryKey: ['agent-gateway', 'clients', client.id, 'quota', auth.accessToken],
      queryFn: () => api.clientQuota(client.id),
      enabled,
      retry: false
    }))
  });
  const clientApiKeyQueries = useQueries({
    queries: clients.map(client => ({
      queryKey: ['agent-gateway', 'clients', client.id, 'api-keys', auth.accessToken],
      queryFn: () => api.clientApiKeys(client.id),
      enabled,
      retry: false
    }))
  });
  const clientLogQueries = useQueries({
    queries: clients.map(client => ({
      queryKey: ['agent-gateway', 'clients', client.id, 'logs', auth.accessToken],
      queryFn: () => api.clientLogs(client.id),
      enabled,
      retry: false
    }))
  });
  const clientQuotas = Object.fromEntries(
    clients.flatMap((client, index) => {
      const quota = clientQuotaQueries[index]?.data;
      return quota ? [[client.id, quota]] : [];
    })
  );
  const clientApiKeys = Object.fromEntries(
    clients.flatMap((client, index) => {
      const apiKeys = clientApiKeyQueries[index]?.data;
      return apiKeys ? [[client.id, apiKeys]] : [];
    })
  );
  const clientLogs = Object.fromEntries(
    clients.flatMap((client, index) => {
      const logs = clientLogQueries[index]?.data;
      return logs ? [[client.id, logs]] : [];
    })
  );

  if (auth.status === 'checking') return <main className="loading-shell">正在恢复会话...</main>;
  if (!auth.accessToken) return <LoginPage onLogin={auth.login} />;
  return (
    <GatewayWorkspace
      apiKeys={apiKeysData ?? { items: [] }}
      api={api}
      clientApiKeys={clientApiKeys}
      clientLogs={clientLogs}
      clientQuotas={clientQuotas}
      clients={clients}
      authFiles={authFilesData ?? { items: [], nextCursor: null }}
      dashboard={dashboardData ?? null}
      logs={logsData ?? { items: [] }}
      modelGroups={modelGroupsData?.groups ?? []}
      onLogout={auth.logout}
      onGatewayDataChanged={handleGatewayDataChanged}
      providerConfigs={providerConfigsData ?? { items: [] }}
      rawConfig={rawConfigData ?? null}
      quotaDetails={quotaDetailsData ?? { items: [] }}
      runtimeHealth={runtimeHealthData ?? null}
      snapshot={snapshotData ?? null}
      systemInfo={systemInfoData ?? null}
      usageAnalytics={usageAnalyticsData ?? null}
      usage={usageData ?? { items: [] }}
    />
  );
}
