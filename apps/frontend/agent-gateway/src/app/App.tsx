import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
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
    quotaDetailsQuery,
    systemInfoQuery,
    modelGroupsQuery
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
      }
    ]
  });

  if (auth.status === 'checking') return <main className="loading-shell">正在恢复会话...</main>;
  if (!auth.accessToken) return <LoginPage onLogin={auth.login} />;
  return (
    <GatewayWorkspace
      apiKeys={apiKeysQuery.data ?? { items: [] }}
      dashboard={dashboardQuery.data ?? null}
      logs={logsQuery.data ?? { items: [] }}
      modelGroups={modelGroupsQuery.data?.groups ?? []}
      onLogout={auth.logout}
      rawConfig={rawConfigQuery.data ?? null}
      quotaDetails={quotaDetailsQuery.data ?? { items: [] }}
      snapshot={snapshotQuery.data ?? null}
      systemInfo={systemInfoQuery.data ?? null}
      usage={usageQuery.data ?? { items: [] }}
    />
  );
}
