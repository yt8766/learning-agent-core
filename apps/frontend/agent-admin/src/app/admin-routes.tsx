import { Navigate, Outlet, type RouteObject } from 'react-router-dom';

import { AdminLoginPage } from '@/pages/auth/pages/admin-login-page';
import { adminAuthStore, useAdminAuthSnapshot } from '@/pages/auth/store/admin-auth-store';
import { createAuthServiceClient } from '@/pages/identity/api/auth-service-client';
import { UsersPage } from '@/pages/identity/pages/users-page';
import { AdminErrorPage } from '@/pages/errors/admin-error-page';
import { PAGE_KEYS } from '@/hooks/admin-dashboard/admin-dashboard-constants';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';

const AUTH_SERVICE_BASE_URL = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';

const authServiceClient = createAuthServiceClient({
  baseUrl: AUTH_SERVICE_BASE_URL,
  getAccessToken: () => adminAuthStore.getSnapshot().accessToken
});

export const adminRoutes: RouteObject[] = [
  {
    element: <AdminRouteShell />,
    children: [
      {
        path: '/login',
        element: <PublicAdminRoute />
      },
      {
        element: <ProtectedAdminRoute />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'identity/users', element: <UsersPage client={authServiceClient} /> },
          ...PAGE_KEYS.map(page => ({
            path: page,
            element: <DashboardPage />
          }))
        ]
      },
      { path: '/401', element: <AdminErrorPage status="401" /> },
      { path: '/403', element: <AdminErrorPage status="403" /> },
      { path: '/500', element: <AdminErrorPage status="500" /> },
      { path: '/503', element: <AdminErrorPage status="503" /> },
      { path: '*', element: <AdminErrorPage status="404" /> }
    ]
  }
];

function AdminRouteShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}

function PublicAdminRoute() {
  const authenticated = useAdminAuthSnapshot().state === 'authenticated';
  const legacyDashboardTarget = readLegacyDashboardTarget();

  if (authenticated) {
    return <Navigate replace to={legacyDashboardTarget ?? '/'} />;
  }
  if (legacyDashboardTarget) {
    return <Navigate replace to="/login" />;
  }

  return <AdminLoginPage />;
}

function ProtectedAdminRoute() {
  const authenticated = useAdminAuthSnapshot().state === 'authenticated';
  return authenticated ? <Outlet /> : <Navigate replace to="/login" />;
}

function readLegacyDashboardTarget() {
  const hash = globalThis.location?.hash ?? '';
  if (!hash.startsWith('#/')) {
    return undefined;
  }
  return hash.replace(/^#/, '') || '/';
}
