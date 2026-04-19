import { QueryClientProvider } from '@tanstack/react-query';

import { adminQueryClient } from '@/lib/query-client';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';

export default function App() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <DashboardPage />
      </div>
    </QueryClientProvider>
  );
}
