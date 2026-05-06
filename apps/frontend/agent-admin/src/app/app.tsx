import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { adminQueryClient } from '@/utils/query-client';
import { adminRoutes } from './admin-routes';

let adminRouter: ReturnType<typeof createBrowserRouter> | undefined;

export default function App() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <RouterProvider router={getAdminRouter()} />
    </QueryClientProvider>
  );
}

function getAdminRouter() {
  adminRouter ??= createBrowserRouter(adminRoutes);
  return adminRouter;
}
