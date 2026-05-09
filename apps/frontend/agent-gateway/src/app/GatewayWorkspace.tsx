import {
  Activity,
  BarChart3,
  CircleGauge,
  FileKey2,
  FolderKey,
  Gauge,
  KeyRound,
  Link2,
  ListChecks,
  LogOut,
  MonitorCog,
  Route,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';
import { NavLink, useInRouterContext, useLocation } from 'react-router-dom';
import type {
  GatewayDashboardSummaryResponse,
  GatewayLogListResponse,
  GatewayQuotaDetailListResponse,
  GatewaySnapshot,
  GatewayUsageListResponse
} from '@agent/core';
import type {
  GatewayApiKeyListResponse,
  GatewayRawConfigResponse,
  GatewaySystemModelGroup,
  GatewaySystemVersionResponse
} from '../api/agent-gateway-api';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NotificationCenter, type NotificationItem } from './components/NotificationCenter';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { AuthFilesManagerPage } from './pages/AuthFilesManagerPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { ConnectionPage } from './pages/ConnectionPage';
import { CredentialFilesPage } from './pages/CredentialFilesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LogsManagerPage } from './pages/LogsManagerPage';
import { LogsProbePage } from './pages/LogsProbePage';
import { OAuthPolicyPage } from './pages/OAuthPolicyPage';
import { OverviewPage } from './pages/OverviewPage';
import { PipelinePage } from './pages/PipelinePage';
import { ProviderConfigPage } from './pages/ProviderConfigPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { QuotasPage } from './pages/QuotasPage';
import { QuotaDetailPage } from './pages/QuotaDetailPage';
import { SystemPage } from './pages/SystemPage';
import { GATEWAY_VIEWS, type GatewayViewId, formatGatewayDate, resolveGatewayViewFromPath } from './gateway-view-model';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface GatewayWorkspaceProps {
  activeView?: GatewayViewId;
  apiKeys?: GatewayApiKeyListResponse;
  confirmDialog?: ConfirmDialogState | null;
  dashboard?: GatewayDashboardSummaryResponse | null;
  logs: GatewayLogListResponse;
  modelGroups?: GatewaySystemModelGroup[];
  notices?: NotificationItem[];
  onActiveViewChange?: (view: GatewayViewId) => void;
  onLogout: () => void;
  rawConfig?: GatewayRawConfigResponse | null;
  quotaDetails?: GatewayQuotaDetailListResponse;
  snapshot: GatewaySnapshot | null;
  systemInfo?: GatewaySystemVersionResponse | null;
  usage: GatewayUsageListResponse;
}

export function GatewayWorkspace({
  activeView = 'overview',
  apiKeys = { items: [] },
  confirmDialog = null,
  dashboard = null,
  logs,
  modelGroups = [],
  notices = [],
  onActiveViewChange,
  onLogout,
  rawConfig = null,
  quotaDetails = { items: [] },
  snapshot,
  systemInfo = null,
  usage
}: GatewayWorkspaceProps) {
  const hasRouter = useInRouterContext();
  if (hasRouter) {
    return (
      <GatewayWorkspaceRouteShell
        apiKeys={apiKeys}
        confirmDialog={confirmDialog}
        dashboard={dashboard}
        logs={logs}
        modelGroups={modelGroups}
        notices={notices}
        onLogout={onLogout}
        rawConfig={rawConfig}
        quotaDetails={quotaDetails}
        snapshot={snapshot}
        systemInfo={systemInfo}
        usage={usage}
      />
    );
  }

  return (
    <GatewayWorkspaceLayout
      activeView={activeView}
      apiKeys={apiKeys}
      confirmDialog={confirmDialog}
      dashboard={dashboard}
      logs={logs}
      modelGroups={modelGroups}
      navMode="button"
      notices={notices}
      onActiveViewChange={onActiveViewChange}
      onLogout={onLogout}
      rawConfig={rawConfig}
      quotaDetails={quotaDetails}
      snapshot={snapshot}
      systemInfo={systemInfo}
      usage={usage}
    />
  );
}

function GatewayWorkspaceRouteShell(props: Omit<GatewayWorkspaceLayoutProps, 'activeView' | 'navMode'>) {
  const location = useLocation();
  return (
    <GatewayWorkspaceLayout {...props} activeView={resolveGatewayViewFromPath(location.pathname)} navMode="link" />
  );
}

interface GatewayWorkspaceLayoutProps extends GatewayWorkspaceProps {
  activeView: GatewayViewId;
  navMode: 'button' | 'link';
}

function GatewayWorkspaceLayout({
  activeView,
  apiKeys = { items: [] },
  confirmDialog = null,
  dashboard = null,
  logs,
  modelGroups = [],
  navMode,
  notices = [],
  onActiveViewChange,
  onLogout,
  rawConfig = null,
  quotaDetails = { items: [] },
  snapshot,
  systemInfo = null,
  usage
}: GatewayWorkspaceLayoutProps) {
  const observedText = snapshot ? `观测时间 ${formatGatewayDate(snapshot.observedAt)}` : '正在加载网关快照';
  const runtimeStatus = snapshot?.runtime.status ?? 'loading';

  return (
    <main className="app-shell gateway-shell-restored">
      <aside className="side-nav">
        <div className="brand-block">
          <span className="gateway-brand-mark" aria-hidden="true">
            <Gauge size={20} />
          </span>
          <div>
            <div className="brand">Agent Gateway</div>
            <p>Relay Ops Console</p>
          </div>
        </div>
        <nav className="view-nav" aria-label="Agent Gateway views">
          {GATEWAY_VIEWS.map(view => (
            <GatewayViewNavItem
              activeView={activeView}
              key={view.id}
              navMode={navMode}
              onActiveViewChange={onActiveViewChange}
              view={view}
            />
          ))}
        </nav>
        <button className="logout-button" onClick={onLogout} type="button">
          <LogOut size={16} aria-hidden="true" />
          <span>退出</span>
        </button>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            <h1>Agent Gateway Console</h1>
            <p>{observedText}</p>
          </div>
          <div className="workspace-observer-strip" aria-label="网关观测状态">
            <span className="observer-item">
              <Activity size={16} aria-hidden="true" />
              <span>{observedText}</span>
            </span>
            <span className={`runtime-badge status-${runtimeStatus}`}>
              <CircleGauge size={15} aria-hidden="true" />
              <span>{runtimeStatus}</span>
            </span>
          </div>
        </header>
        {snapshot ? (
          renderActivePage(activeView, snapshot, logs, usage, {
            apiKeys,
            dashboard,
            modelGroups,
            quotaDetails,
            rawConfig,
            systemInfo
          })
        ) : (
          <div className="loading-panel">正在加载控制台数据...</div>
        )}
      </section>
      <NotificationCenter items={notices} />
      {confirmDialog ? <ConfirmDialog {...confirmDialog} /> : null}
    </main>
  );
}

interface GatewayViewNavItemProps {
  activeView: GatewayViewId;
  navMode: 'button' | 'link';
  onActiveViewChange?: (view: GatewayViewId) => void;
  view: (typeof GATEWAY_VIEWS)[number];
}

const gatewayViewIcons: Record<GatewayViewId, LucideIcon> = {
  overview: Gauge,
  dashboard: BarChart3,
  connection: Link2,
  config: Settings2,
  apiKeys: KeyRound,
  providers: ServerCog,
  providerConfig: SlidersHorizontal,
  credentials: FileKey2,
  authFilesManager: FolderKey,
  oauthPolicy: ShieldCheck,
  quotas: CircleGauge,
  quotaDetail: ListChecks,
  pipeline: Route,
  logs: ScrollText,
  system: MonitorCog
};

function GatewayViewNavItem({ activeView, navMode, onActiveViewChange, view }: GatewayViewNavItemProps) {
  const Icon = gatewayViewIcons[view.id];
  const label = (
    <>
      <span className="view-nav-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="view-nav-label">{view.label}</span>
    </>
  );

  if (navMode === 'link') {
    return (
      <NavLink
        aria-current={activeView === view.id ? 'page' : undefined}
        className={`view-nav-item${activeView === view.id ? ' active' : ''}`}
        end={view.id === 'overview'}
        to={view.path}
      >
        {label}
      </NavLink>
    );
  }

  return (
    <button
      aria-current={activeView === view.id ? 'page' : undefined}
      className={`view-nav-item${activeView === view.id ? ' active' : ''}`}
      onClick={() => onActiveViewChange?.(view.id)}
      type="button"
    >
      {label}
    </button>
  );
}

interface GatewayPageData {
  apiKeys: GatewayApiKeyListResponse;
  dashboard: GatewayDashboardSummaryResponse | null;
  modelGroups: GatewaySystemModelGroup[];
  quotaDetails: GatewayQuotaDetailListResponse;
  rawConfig: GatewayRawConfigResponse | null;
  systemInfo: GatewaySystemVersionResponse | null;
}

function renderActivePage(
  activeView: GatewayViewId,
  snapshot: GatewaySnapshot,
  logs: GatewayLogListResponse,
  usage: GatewayUsageListResponse,
  pageData: GatewayPageData
) {
  if (activeView === 'connection') {
    return <ConnectionPage />;
  }
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
  if (activeView === 'apiKeys') {
    return <ApiKeysPage items={pageData.apiKeys.items} />;
  }
  if (activeView === 'providers') {
    return <ProvidersPage providers={snapshot.providerCredentialSets} />;
  }
  if (activeView === 'providerConfig') {
    return <ProviderConfigPage />;
  }
  if (activeView === 'credentials') {
    return <CredentialFilesPage credentialFiles={snapshot.credentialFiles} />;
  }
  if (activeView === 'authFilesManager') {
    return <AuthFilesManagerPage />;
  }
  if (activeView === 'oauthPolicy') {
    return <OAuthPolicyPage />;
  }
  if (activeView === 'quotas') {
    return <QuotasPage quotas={snapshot.quotas} />;
  }
  if (activeView === 'quotaDetail') {
    return <QuotaDetailPage details={pageData.quotaDetails} />;
  }
  if (activeView === 'pipeline') {
    return <PipelinePage config={snapshot.config} />;
  }
  if (activeView === 'logs') {
    return (
      <div className="page-stack">
        <LogsManagerPage />
        <LogsProbePage logs={logs} usage={usage} />
      </div>
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
      />
    );
  }
  return <OverviewPage logCount={logs.items.length} snapshot={snapshot} usageCount={usage.items.length} />;
}
