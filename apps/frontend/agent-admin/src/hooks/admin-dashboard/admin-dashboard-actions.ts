import { createAdminDashboardMutationActions } from './admin-dashboard-mutation-actions';
import { createAdminDashboardRefreshActions } from './admin-dashboard-refresh-actions';
import type { AdminDashboardActionContext } from './admin-dashboard-actions.types';

export function createAdminDashboardActions(context: AdminDashboardActionContext) {
  const refreshActions = createAdminDashboardRefreshActions(context);
  const mutationActions = createAdminDashboardMutationActions(context, refreshActions);
  return {
    ...refreshActions,
    ...mutationActions
  };
}
