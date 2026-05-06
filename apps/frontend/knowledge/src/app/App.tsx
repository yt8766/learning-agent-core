import { lazy } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom';

import { AppShell, type KnowledgeView } from './layout/app-shell';
import { KnowledgeLazyBoundary } from './lazy-boundary';
import { ProtectedRoute } from './protected-route';
import { useAccountProfileStore } from '../pages/account/account-store';
import type { AuthClient } from '../api/auth-client';
import { AuthProvider, useAuth } from '../pages/auth/auth-provider';
import { LoginPage } from '../pages/auth/login-page';
import { DocumentsPage } from '../pages/documents/documents-page';
import { ExceptionPage } from '../pages/exceptions';
import { KnowledgeBasesPage } from '../pages/knowledge-bases/knowledge-bases-page';
import { OverviewPage } from '../pages/overview/overview-page';
import { SettingsPage } from '../pages/settings/settings-page';

// Route-level dynamic imports are limited to low-frequency pages so the primary RAG workspace stays light.
const AccountSettingsPage = lazy(() =>
  import('../pages/account/account-settings-page').then(module => ({ default: module.AccountSettingsPage }))
);
const AgentFlowPage = lazy(() =>
  import('../pages/agent-flow/agent-flow-page').then(module => ({ default: module.AgentFlowPage }))
);
const ChatLabPage = lazy(() =>
  import('../pages/chat-lab/chat-lab-page').then(module => ({ default: module.ChatLabPage }))
);
const DocumentDetailPage = lazy(() =>
  import('../pages/documents/document-detail-page').then(module => ({ default: module.DocumentDetailPage }))
);
const EvalsPage = lazy(() => import('../pages/evals/evals-page').then(module => ({ default: module.EvalsPage })));
const KnowledgeBaseDetailPage = lazy(() =>
  import('../pages/knowledge-bases/knowledge-base-detail-page').then(module => ({
    default: module.KnowledgeBaseDetailPage
  }))
);
const ObservabilityPage = lazy(() =>
  import('../pages/observability/observability-page').then(module => ({ default: module.ObservabilityPage }))
);
const SettingsKeysPage = lazy(() =>
  import('../pages/settings/settings-keys-page').then(module => ({ default: module.SettingsKeysPage }))
);
const SettingsModelsPage = lazy(() =>
  import('../pages/settings/settings-models-page').then(module => ({ default: module.SettingsModelsPage }))
);
const SettingsSecurityPage = lazy(() =>
  import('../pages/settings/settings-security-page').then(module => ({ default: module.SettingsSecurityPage }))
);
const SettingsStoragePage = lazy(() =>
  import('../pages/settings/settings-storage-page').then(module => ({ default: module.SettingsStoragePage }))
);
const UsersPage = lazy(() => import('../pages/users/users-page').then(module => ({ default: module.UsersPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;

export function App({ authClient }: { authClient?: AuthClient } = {}) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#1677ff',
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider authClient={authClient}>
            <Router>
              <KnowledgeRoutes />
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export function KnowledgeRoutes() {
  return (
    <Routes>
      <Route element={<LoginRoute />} path="login" />
      <Route
        element={
          <ProtectedRoute>
            <KnowledgeWorkspace />
          </ProtectedRoute>
        }
      >
        <Route element={<OverviewPage />} index />
        <Route element={<KnowledgeBasesPage />} path="knowledge-bases" />
        <Route
          element={
            <KnowledgeLazyBoundary label="知识库详情">
              <KnowledgeBaseDetailPage />
            </KnowledgeLazyBoundary>
          }
          path="knowledge-bases/:knowledgeBaseId"
        />
        <Route element={<DocumentsPage />} path="documents" />
        <Route
          element={
            <KnowledgeLazyBoundary label="文档详情">
              <DocumentDetailPage />
            </KnowledgeLazyBoundary>
          }
          path="documents/:documentId"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="Agent Flow">
              <AgentFlowPage />
            </KnowledgeLazyBoundary>
          }
          path="agent-flow"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="检索实验室">
              <ChatLabPage />
            </KnowledgeLazyBoundary>
          }
          path="chat-lab"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="Trace 观测">
              <ObservabilityPage />
            </KnowledgeLazyBoundary>
          }
          path="observability"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="评测回归">
              <EvalsPage />
            </KnowledgeLazyBoundary>
          }
          path="evals"
        />
        <Route element={<SettingsPage />} path="settings" />
        <Route
          element={
            <KnowledgeLazyBoundary label="模型配置">
              <SettingsModelsPage />
            </KnowledgeLazyBoundary>
          }
          path="settings/models"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="API 密钥">
              <SettingsKeysPage />
            </KnowledgeLazyBoundary>
          }
          path="settings/keys"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="存储管理">
              <SettingsStoragePage />
            </KnowledgeLazyBoundary>
          }
          path="settings/storage"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="安全策略">
              <SettingsSecurityPage />
            </KnowledgeLazyBoundary>
          }
          path="settings/security"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="访问治理">
              <UsersPage />
            </KnowledgeLazyBoundary>
          }
          path="users"
        />
        <Route
          element={
            <KnowledgeLazyBoundary label="个人设置">
              <AccountSettingsPage />
            </KnowledgeLazyBoundary>
          }
          path="account/settings"
        />
        <Route element={<ExceptionPage type="403" />} path="exception/403" />
        <Route element={<ExceptionPage type="404" />} path="exception/404" />
        <Route element={<ExceptionPage type="500" />} path="exception/500" />
        <Route element={<ExceptionPage type="404" />} path="*" />
      </Route>
    </Routes>
  );
}

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? <Navigate replace to={resolvePostLoginPath(location.state)} /> : <LoginPage />;
}

export function resolvePostLoginPath(locationState: unknown) {
  if (!isRecord(locationState) || !isRecord(locationState.from) || typeof locationState.from.pathname !== 'string') {
    return '/';
  }
  const pathname = locationState.from.pathname;
  return pathname === '/login' ? '/' : pathname;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function KnowledgeWorkspace() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const avatar = useAccountProfileStore(state => state.avatar);
  const displayName = useAccountProfileStore(state => state.displayName);
  const activeView = resolveViewFromPath(location.pathname);

  function navigateToView(view: KnowledgeView) {
    navigate(pathByView[view]);
  }

  return (
    <AppShell
      activeView={activeView}
      avatar={avatar}
      displayName={displayName}
      onLogout={logout}
      onNavigate={navigateToView}
      onUserNavigate={navigateToView}
    >
      <Outlet />
    </AppShell>
  );
}

export const pathByView: Record<KnowledgeView, string> = {
  accountSettings: '/account/settings',
  agentFlow: '/agent-flow',
  chatLab: '/chat-lab',
  documents: '/documents',
  evals: '/evals',
  knowledgeBases: '/knowledge-bases',
  observability: '/observability',
  overview: '/',
  settings: '/settings',
  settingsKeys: '/settings/keys',
  settingsModels: '/settings/models',
  settingsSecurity: '/settings/security',
  settingsStorage: '/settings/storage',
  users: '/users'
};

export function resolveViewFromPath(pathname: string): KnowledgeView | undefined {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const matchedView = Object.entries(pathByView).find(([, path]) => path === normalizedPath)?.[0];
  return matchedView as KnowledgeView | undefined;
}
