import { AdminAuthGate } from '../../src/admin/admin-auth-gate';
import { GatewayDashboard } from '../../src/components/gateway-dashboard';

export default async function AdminPage() {
  return (
    <AdminAuthGate>
      <GatewayDashboard remoteData />
    </AdminAuthGate>
  );
}
