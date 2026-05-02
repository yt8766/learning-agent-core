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
import { ProtectedRoute } from './protected-route';
import { AccountSettingsPage } from '../pages/account/account-settings-page';
import { useAccountProfileStore } from '../pages/account/account-store';
import type { AuthClient } from '../api/auth-client';
import { AuthProvider, useAuth } from '../pages/auth/auth-provider';
import { LoginPage } from '../pages/auth/login-page';
import { ChatLabPage } from '../pages/chat-lab/chat-lab-page';
import { DocumentDetailPage } from '../pages/documents/document-detail-page';
import { DocumentsPage } from '../pages/documents/documents-page';
import { EvalsPage } from '../pages/evals/evals-page';
import { ExceptionPage } from '../pages/exceptions';
import { KnowledgeBaseDetailPage } from '../pages/knowledge-bases/knowledge-base-detail-page';
import { KnowledgeBasesPage } from '../pages/knowledge-bases/knowledge-bases-page';
import { ObservabilityPage } from '../pages/observability/observability-page';
import { OverviewPage } from '../pages/overview/overview-page';
import { SettingsPage } from '../pages/settings/settings-page';

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
        <Route element={<KnowledgeBaseDetailPage />} path="knowledge-bases/:knowledgeBaseId" />
        <Route element={<DocumentsPage />} path="documents" />
        <Route element={<DocumentDetailPage />} path="documents/:documentId" />
        <Route element={<ChatLabPage />} path="chat-lab" />
        <Route element={<ObservabilityPage />} path="observability" />
        <Route element={<EvalsPage />} path="evals" />
        <Route element={<SettingsPage />} path="settings" />
        <Route element={<AccountSettingsPage />} path="account/settings" />
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
  chatLab: '/chat-lab',
  documents: '/documents',
  evals: '/evals',
  knowledgeBases: '/knowledge-bases',
  observability: '/observability',
  overview: '/',
  settings: '/settings'
};

export function resolveViewFromPath(pathname: string): KnowledgeView | undefined {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const matchedView = Object.entries(pathByView).find(([, path]) => path === normalizedPath)?.[0];
  return matchedView as KnowledgeView | undefined;
}
