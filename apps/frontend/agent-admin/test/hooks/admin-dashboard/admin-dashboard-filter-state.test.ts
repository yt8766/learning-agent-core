import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminDashboardFilterState } from '@/hooks/admin-dashboard/admin-dashboard-filter-state';

let reducerState: AdminDashboardFilterState;

vi.mock('react', () => ({
  useReducer: (
    reducer: (s: AdminDashboardFilterState, a: unknown) => AdminDashboardFilterState,
    initial: AdminDashboardFilterState
  ) => {
    reducerState = initial;
    const dispatch = (action: unknown) => {
      reducerState = reducer(reducerState, action as never);
    };
    return [reducerState, dispatch];
  }
}));

const INITIAL: AdminDashboardFilterState = {
  runtimeStatusFilter: 'all',
  runtimeModelFilter: 'all',
  runtimePricingSourceFilter: 'all',
  runtimeExecutionModeFilter: 'all',
  runtimeInteractionKindFilter: 'all',
  approvalsExecutionModeFilter: 'all',
  approvalsInteractionKindFilter: 'all',
  evalScenarioFilter: '',
  evalOutcomeFilter: ''
};

describe('useAdminDashboardFilters', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadHook() {
    const mod = await import('@/hooks/admin-dashboard/admin-dashboard-filter-state');
    return mod.useAdminDashboardFilters(INITIAL);
  }

  it('returns initial filter state', async () => {
    const result = await loadHook();
    expect(result.filters).toEqual(INITIAL);
  });

  it('setRuntimeStatusFilter dispatches correct action', async () => {
    const result = await loadHook();
    result.setRuntimeStatusFilter('running');
    expect(reducerState.runtimeStatusFilter).toBe('running');
    expect(reducerState.runtimeModelFilter).toBe('all');
  });

  it('setRuntimeExecutionModeFilter dispatches correct action', async () => {
    const result = await loadHook();
    result.setRuntimeExecutionModeFilter('plan');
    expect(reducerState.runtimeExecutionModeFilter).toBe('plan');
  });

  it('replaceAll replaces entire state', async () => {
    const result = await loadHook();
    const next = { ...INITIAL, runtimeStatusFilter: 'error', evalScenarioFilter: 'scenario-1' };
    result.dispatch({ type: 'replaceAll', state: next });
    expect(reducerState).toEqual(next);
  });
});
