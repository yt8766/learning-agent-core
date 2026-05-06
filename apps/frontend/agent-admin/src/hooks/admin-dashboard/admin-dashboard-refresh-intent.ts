import type { DashboardPageKey } from '@/types/admin';
import type { AdminDashboardFilterState } from './admin-dashboard-filter-state';

export interface AdminDashboardRefreshIntent {
  page: DashboardPageKey;
  filters:
    | {
        status: string;
        model: string;
        pricingSource: string;
        executionMode: AdminDashboardFilterState['runtimeExecutionModeFilter'];
        interactionKind: AdminDashboardFilterState['runtimeInteractionKindFilter'];
      }
    | {
        executionMode: AdminDashboardFilterState['approvalsExecutionModeFilter'];
        interactionKind: AdminDashboardFilterState['approvalsInteractionKindFilter'];
      }
    | {
        scenario: string;
        outcome: string;
      }
    | Record<string, never>;
}

interface BuildAdminDashboardRefreshIntentInput {
  page: DashboardPageKey;
  filters: AdminDashboardFilterState;
}

export function buildAdminDashboardRefreshIntent({
  page,
  filters
}: BuildAdminDashboardRefreshIntentInput): AdminDashboardRefreshIntent {
  if (page === 'runtime') {
    return {
      page,
      filters: {
        status: filters.runtimeStatusFilter,
        model: filters.runtimeModelFilter,
        pricingSource: filters.runtimePricingSourceFilter,
        executionMode: filters.runtimeExecutionModeFilter,
        interactionKind: filters.runtimeInteractionKindFilter
      }
    };
  }

  if (page === 'approvals') {
    return {
      page,
      filters: {
        executionMode: filters.approvalsExecutionModeFilter,
        interactionKind: filters.approvalsInteractionKindFilter
      }
    };
  }

  if (page === 'evals') {
    return {
      page,
      filters: {
        scenario: filters.evalScenarioFilter,
        outcome: filters.evalOutcomeFilter
      }
    };
  }

  return {
    page,
    filters: {}
  };
}
