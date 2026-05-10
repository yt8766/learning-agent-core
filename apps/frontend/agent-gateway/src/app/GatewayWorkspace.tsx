import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  FolderKey,
  Gauge,
  LogOut,
  MonitorCog,
  ServerCog,
  Settings2,
  ShieldCheck,
  UsersRound,
  type LucideIcon
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useInRouterContext, useLocation } from 'react-router-dom';
import type {
  GatewayAuthFileListResponse,
  GatewayClient,
  GatewayClientApiKeyListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayDashboardSummaryResponse,
  GatewayLogListResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayQuotaDetailListResponse,
  GatewaySnapshot,
  GatewayUsageListResponse
} from '@agent/core';
import type {
  AgentGatewayApiClient,
  GatewayApiKeyListResponse,
  GatewayRawConfigResponse,
  GatewaySystemModelGroup,
  GatewaySystemVersionResponse
} from '../api/agent-gateway-api';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NotificationCenter, type NotificationItem } from './components/NotificationCenter';
import { renderActivePage } from './GatewayWorkspacePages';
import { GATEWAY_VIEWS, type GatewayViewId, formatGatewayDate, resolveGatewayViewFromPath } from './gateway-view-model';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface GatewayWorkspaceProps {
  activeView?: GatewayViewId;
  api?: AgentGatewayApiClient;
  apiKeys?: GatewayApiKeyListResponse;
  clientApiKeys?: Record<string, GatewayClientApiKeyListResponse>;
  clientLogs?: Record<string, GatewayClientRequestLogListResponse>;
  clientQuotas?: Record<string, GatewayClientQuota>;
  clients?: GatewayClient[];
  authFiles?: GatewayAuthFileListResponse;
  confirmDialog?: ConfirmDialogState | null;
  dashboard?: GatewayDashboardSummaryResponse | null;
  logs: GatewayLogListResponse;
  modelGroups?: GatewaySystemModelGroup[];
  onGatewayDataChanged?: () => void;
  notices?: NotificationItem[];
  onActiveViewChange?: (view: GatewayViewId) => void;
  onLogout: () => void;
  providerConfigs?: GatewayProviderSpecificConfigListResponse;
  rawConfig?: GatewayRawConfigResponse | null;
  quotaDetails?: GatewayQuotaDetailListResponse;
  snapshot: GatewaySnapshot | null;
  systemInfo?: GatewaySystemVersionResponse | null;
  usage: GatewayUsageListResponse;
}

export function GatewayWorkspace({
  activeView = 'dashboard',
  api,
  apiKeys = { items: [] },
  clientApiKeys = {},
  clientLogs = {},
  clientQuotas = {},
  clients = [],
  authFiles = { items: [], nextCursor: null },
  confirmDialog = null,
  dashboard = null,
  logs,
  modelGroups = [],
  notices = [],
  onActiveViewChange,
  onGatewayDataChanged,
  onLogout,
  providerConfigs = { items: [] },
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
        api={api}
        clientApiKeys={clientApiKeys}
        clientLogs={clientLogs}
        clientQuotas={clientQuotas}
        clients={clients}
        authFiles={authFiles}
        confirmDialog={confirmDialog}
        dashboard={dashboard}
        logs={logs}
        modelGroups={modelGroups}
        notices={notices}
        onGatewayDataChanged={onGatewayDataChanged}
        onLogout={onLogout}
        providerConfigs={providerConfigs}
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
      api={api}
      apiKeys={apiKeys}
      clientApiKeys={clientApiKeys}
      clientLogs={clientLogs}
      clientQuotas={clientQuotas}
      clients={clients}
      authFiles={authFiles}
      confirmDialog={confirmDialog}
      dashboard={dashboard}
      logs={logs}
      modelGroups={modelGroups}
      navMode="button"
      notices={notices}
      onActiveViewChange={onActiveViewChange}
      onGatewayDataChanged={onGatewayDataChanged}
      onLogout={onLogout}
      providerConfigs={providerConfigs}
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
  api,
  apiKeys = { items: [] },
  clientApiKeys = {},
  clientLogs = {},
  clientQuotas = {},
  clients = [],
  authFiles = { items: [], nextCursor: null },
  confirmDialog = null,
  dashboard = null,
  modelGroups = [],
  navMode,
  notices = [],
  onActiveViewChange,
  onGatewayDataChanged,
  onLogout,
  providerConfigs = { items: [] },
  rawConfig = null,
  quotaDetails = { items: [] },
  snapshot,
  systemInfo = null
}: GatewayWorkspaceLayoutProps) {
  const observedText = snapshot ? `观测时间 ${formatGatewayDate(snapshot.observedAt)}` : '正在加载网关快照';
  const runtimeStatus = snapshot?.runtime.status ?? 'loading';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`app-shell gateway-shell-restored pure-white-shell${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}
    >
      <div className="top-gradient-blur" aria-hidden="true" />

      <header className="main-header">
        <button
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          className="sidebar-toggle-floating"
          onClick={() => setSidebarCollapsed(value => !value)}
          title={sidebarCollapsed ? '展开' : '收起'}
          type="button"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="header-actions floating-actions workspace-observer-strip" aria-label="网关观测状态">
          <span className="observer-item">
            <Activity size={16} aria-hidden="true" />
            <span>{observedText}</span>
          </span>
          <span className={`runtime-badge status-${runtimeStatus}`}>
            <CircleGauge size={15} aria-hidden="true" />
            <span>{runtimeStatus}</span>
          </span>
          <button className="header-icon-button" onClick={onLogout} title="退出" type="button">
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="main-body">
        <aside className={`sidebar side-nav${sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-brand brand-block" title="Agent Gateway Management Center">
            <span className="sidebar-brand-logo gateway-brand-mark" aria-hidden="true">
              <Gauge size={20} />
            </span>
            {!sidebarCollapsed ? (
              <span className="sidebar-brand-title">
                <span className="brand">Agent Gateway</span>
                <span className="brand-subtitle">Management Center</span>
              </span>
            ) : null}
          </div>
          <nav className="nav-section view-nav" aria-label="Agent Gateway views">
            {GATEWAY_VIEWS.map(view => (
              <GatewayViewNavItem
                activeView={activeView}
                collapsed={sidebarCollapsed}
                key={view.id}
                navMode={navMode}
                onActiveViewChange={onActiveViewChange}
                view={view}
              />
            ))}
          </nav>
        </aside>

        <div className="content workspace">
          <main className="main-content">
            {snapshot ? (
              renderActivePage(activeView, snapshot, {
                apiKeys,
                clientApiKeys,
                clientLogs,
                clientQuotas,
                clients,
                api,
                authFiles,
                dashboard,
                modelGroups,
                onGatewayDataChanged,
                onLogout,
                providerConfigs,
                quotaDetails,
                rawConfig,
                systemInfo
              })
            ) : (
              <div className="loading-panel">正在加载控制台数据...</div>
            )}
          </main>
        </div>
      </div>
      <NotificationCenter items={notices} />
      {confirmDialog ? <ConfirmDialog {...confirmDialog} /> : null}
    </div>
  );
}

interface GatewayViewNavItemProps {
  activeView: GatewayViewId;
  collapsed?: boolean;
  navMode: 'button' | 'link';
  onActiveViewChange?: (view: GatewayViewId) => void;
  view: (typeof GATEWAY_VIEWS)[number];
}

const gatewayViewIcons: Record<GatewayViewId, LucideIcon> = {
  dashboard: BarChart3,
  clients: UsersRound,
  config: Settings2,
  aiProviders: ServerCog,
  authFiles: FolderKey,
  oauth: ShieldCheck,
  quota: CircleGauge,
  system: MonitorCog
};

function GatewayViewNavItem({
  activeView,
  collapsed = false,
  navMode,
  onActiveViewChange,
  view
}: GatewayViewNavItemProps) {
  const Icon = gatewayViewIcons[view.id];
  const label = (
    <>
      <span className="nav-icon view-nav-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      {!collapsed ? <span className="nav-label view-nav-label">{view.label}</span> : null}
    </>
  );

  if (navMode === 'link') {
    return (
      <NavLink
        aria-current={activeView === view.id ? 'page' : undefined}
        className={`nav-item view-nav-item${activeView === view.id ? ' active' : ''}`}
        end={view.id === 'dashboard'}
        title={collapsed ? view.label : undefined}
        to={view.path}
      >
        {label}
      </NavLink>
    );
  }

  return (
    <button
      aria-current={activeView === view.id ? 'page' : undefined}
      className={`nav-item view-nav-item${activeView === view.id ? ' active' : ''}`}
      onClick={() => onActiveViewChange?.(view.id)}
      title={collapsed ? view.label : undefined}
      type="button"
    >
      {label}
    </button>
  );
}
