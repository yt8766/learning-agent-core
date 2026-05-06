import { describe, expect, it } from 'vitest';

import { buildAdminDashboardRefreshIntent } from '@/hooks/admin-dashboard/admin-dashboard-refresh-intent';

const filters = {
  runtimeStatusFilter: 'running',
  runtimeModelFilter: 'gpt-5.4',
  runtimePricingSourceFilter: 'provider',
  runtimeExecutionModeFilter: 'execute',
  runtimeInteractionKindFilter: 'approval',
  approvalsExecutionModeFilter: 'plan',
  approvalsInteractionKindFilter: 'plan-question',
  evalScenarioFilter: 'safety',
  evalOutcomeFilter: 'passed'
} as const;

describe('buildAdminDashboardRefreshIntent', () => {
  it('keeps only runtime filters for the runtime center', () => {
    expect(buildAdminDashboardRefreshIntent({ page: 'runtime', filters })).toEqual({
      page: 'runtime',
      filters: {
        status: 'running',
        model: 'gpt-5.4',
        pricingSource: 'provider',
        executionMode: 'execute',
        interactionKind: 'approval'
      }
    });
  });

  it('keeps only approval filters for the approvals center', () => {
    expect(buildAdminDashboardRefreshIntent({ page: 'approvals', filters })).toEqual({
      page: 'approvals',
      filters: {
        executionMode: 'plan',
        interactionKind: 'plan-question'
      }
    });
  });

  it('keeps only eval filters for the evals center', () => {
    expect(buildAdminDashboardRefreshIntent({ page: 'evals', filters })).toEqual({
      page: 'evals',
      filters: {
        scenario: 'safety',
        outcome: 'passed'
      }
    });
  });

  it('drops filters for centers without scoped refresh filters', () => {
    expect(buildAdminDashboardRefreshIntent({ page: 'workspace', filters })).toEqual({
      page: 'workspace',
      filters: {}
    });
  });
});
