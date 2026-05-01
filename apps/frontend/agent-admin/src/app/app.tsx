import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { adminQueryClient } from '@/lib/query-client';
import { AdminLoginPage } from '@/features/auth/pages/admin-login-page';
import { adminAuthStore } from '@/features/auth/store/admin-auth-store';
import { AdminErrorPage, type AdminErrorPageStatus } from '@/features/errors/admin-error-page';
import { PAGE_KEYS } from '@/hooks/admin-dashboard/admin-dashboard-constants';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';

const ERROR_PATH_STATUS: Record<string, AdminErrorPageStatus> = {
  '/401': '401',
  '/403': '403',
  '/404': '404',
  '/500': '500',
  '/503': '503'
};

const PUBLIC_PATHS = new Set(['/login']);
const PROTECTED_PATHS = new Set(['/', ...PAGE_KEYS.map(page => `/${page}`)]);

export default function App() {
  const auth = useSyncExternalStore(
    listener => adminAuthStore.subscribe(listener),
    () => adminAuthStore.getSnapshot(),
    () => adminAuthStore.getSnapshot()
  );
  const pathname = readCurrentPathname();
  const page = resolveAdminPage(pathname, auth.state === 'authenticated');

  return (
    <QueryClientProvider client={adminQueryClient}>
      <div className="min-h-screen bg-background text-foreground">
        {page === 'login' ? <AdminLoginPage /> : null}
        {page === 'login-hash-redirect' ? <AdminLoginHashRedirect /> : null}
        {page === 'dashboard' ? <DashboardPage /> : null}
        {page === 'dashboard-redirect' ? <AdminDashboardRedirect /> : null}
        {page === 'login-redirect' ? <AdminLoginRedirect /> : null}
        {typeof page === 'object' ? <AdminErrorPage status={page.status} /> : null}
      </div>
    </QueryClientProvider>
  );
}

type AdminResolvedPage =
  | 'login'
  | 'login-hash-redirect'
  | 'login-redirect'
  | 'dashboard'
  | 'dashboard-redirect'
  | { kind: 'error'; status: AdminErrorPageStatus };

function resolveAdminPage(pathname: string, authenticated: boolean): AdminResolvedPage {
  const errorStatus = ERROR_PATH_STATUS[pathname];
  if (errorStatus) {
    return { kind: 'error', status: errorStatus };
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (authenticated) {
      return 'dashboard-redirect';
    }
    return readCurrentHash() ? 'login-hash-redirect' : 'login';
  }

  if (PROTECTED_PATHS.has(pathname)) {
    return authenticated ? 'dashboard' : 'login-redirect';
  }

  return { kind: 'error', status: '404' };
}

function readCurrentPathname() {
  return globalThis.location?.pathname || '/';
}

function readCurrentHash() {
  return globalThis.location?.hash || '';
}

function AdminLoginRedirect() {
  useEffect(() => {
    if (globalThis.location?.pathname !== '/login') {
      globalThis.location?.assign('/login');
    }
  }, []);

  return <div aria-hidden="true" data-admin-login-redirect="" />;
}

function AdminLoginHashRedirect() {
  useEffect(() => {
    globalThis.location?.replace('/login');
  }, []);

  return <div aria-hidden="true" data-admin-login-hash-redirect="" data-target="/login" />;
}

function AdminDashboardRedirect() {
  const target = buildDashboardRedirectTarget();

  useEffect(() => {
    globalThis.location?.replace(target);
  }, [target]);

  return <div aria-hidden="true" data-admin-dashboard-redirect="" data-target={target} />;
}

function buildDashboardRedirectTarget() {
  return readCurrentHash().replace(/^#/, '') || '/';
}
