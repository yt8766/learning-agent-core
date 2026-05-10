import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { AgentGatewayApiClient } from '../api/agent-gateway-api';
import { GatewayAuthProvider, useGatewayAuth } from '../auth/auth-session';
import { GatewayWorkspace } from './GatewayWorkspace';
import { LoginPage } from './pages/LoginPage';
import './App.css';
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
    apiKeysQuery,
    rawConfigQuery,
    dashboardQuery,
    clientsQuery,
    quotaDetailsQuery,
    systemInfoQuery,
    modelGroupsQuery,
    providerConfigsQuery,
    authFilesQuery
  ] = useQueries({
    queries: [
      {
        queryKey: ['agent-gateway', 'snapshot', auth.accessToken],
        queryFn: () => api.snapshot(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'logs', auth.accessToken],
        queryFn: () => api.logs(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'usage', auth.accessToken],
        queryFn: () => api.usage(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'api-keys', auth.accessToken],
        queryFn: () => api.apiKeys(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'raw-config', auth.accessToken],
        queryFn: () => api.rawConfig(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'dashboard', auth.accessToken],
        queryFn: () => api.dashboard(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'clients', auth.accessToken],
        queryFn: () => api.clients(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'quota-details', auth.accessToken],
        queryFn: () => api.quotaDetails(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'system-info', auth.accessToken],
        queryFn: () => api.systemInfo(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'system-models', auth.accessToken],
        queryFn: () => api.discoverModels(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'provider-configs', auth.accessToken],
        queryFn: () => api.providerConfigs(),
        enabled,
        retry: false
      },
      {
        queryKey: ['agent-gateway', 'auth-files', auth.accessToken],
        queryFn: () => api.authFiles({ limit: 100 }),
        enabled,
        retry: false
      }
    ]
  });
  const handleGatewayDataChanged = () => {
    void queryClient.invalidateQueries({ queryKey: ['agent-gateway'] });
  };
  const clients = clientsQuery.data?.items ?? [];
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
      apiKeys={apiKeysQuery.data ?? { items: [] }}
      api={api}
      clientApiKeys={clientApiKeys}
      clientLogs={clientLogs}
      clientQuotas={clientQuotas}
      clients={clients}
      authFiles={authFilesQuery.data ?? { items: [], nextCursor: null }}
      dashboard={dashboardQuery.data ?? null}
      logs={logsQuery.data ?? { items: [] }}
      modelGroups={modelGroupsQuery.data?.groups ?? []}
      onLogout={auth.logout}
      onGatewayDataChanged={handleGatewayDataChanged}
      providerConfigs={providerConfigsQuery.data ?? { items: [] }}
      rawConfig={rawConfigQuery.data ?? null}
      quotaDetails={quotaDetailsQuery.data ?? { items: [] }}
      snapshot={snapshotQuery.data ?? null}
      systemInfo={systemInfoQuery.data ?? null}
      usage={usageQuery.data ?? { items: [] }}
    />
  );
}
