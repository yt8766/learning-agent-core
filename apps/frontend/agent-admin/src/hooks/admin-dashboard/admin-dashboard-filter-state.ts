import { useReducer } from 'react';

import type { ExecutionModeFilter, InteractionKindFilter } from './admin-dashboard-constants';

export interface AdminDashboardFilterState {
  runtimeStatusFilter: string;
  runtimeModelFilter: string;
  runtimePricingSourceFilter: string;
  runtimeExecutionModeFilter: ExecutionModeFilter;
  runtimeInteractionKindFilter: InteractionKindFilter;
  approvalsExecutionModeFilter: ExecutionModeFilter;
  approvalsInteractionKindFilter: InteractionKindFilter;
  evalScenarioFilter: string;
  evalOutcomeFilter: string;
}

type FilterAction =
  | { type: 'setRuntimeStatusFilter'; value: string }
  | { type: 'setRuntimeModelFilter'; value: string }
  | { type: 'setRuntimePricingSourceFilter'; value: string }
  | { type: 'setRuntimeExecutionModeFilter'; value: ExecutionModeFilter }
  | { type: 'setRuntimeInteractionKindFilter'; value: InteractionKindFilter }
  | { type: 'setApprovalsExecutionModeFilter'; value: ExecutionModeFilter }
  | { type: 'setApprovalsInteractionKindFilter'; value: InteractionKindFilter }
  | { type: 'setEvalScenarioFilter'; value: string }
  | { type: 'setEvalOutcomeFilter'; value: string }
  | { type: 'replaceAll'; state: AdminDashboardFilterState };

function filterReducer(state: AdminDashboardFilterState, action: FilterAction): AdminDashboardFilterState {
  switch (action.type) {
    case 'setRuntimeStatusFilter':
      return { ...state, runtimeStatusFilter: action.value };
    case 'setRuntimeModelFilter':
      return { ...state, runtimeModelFilter: action.value };
    case 'setRuntimePricingSourceFilter':
      return { ...state, runtimePricingSourceFilter: action.value };
    case 'setRuntimeExecutionModeFilter':
      return { ...state, runtimeExecutionModeFilter: action.value };
    case 'setRuntimeInteractionKindFilter':
      return { ...state, runtimeInteractionKindFilter: action.value };
    case 'setApprovalsExecutionModeFilter':
      return { ...state, approvalsExecutionModeFilter: action.value };
    case 'setApprovalsInteractionKindFilter':
      return { ...state, approvalsInteractionKindFilter: action.value };
    case 'setEvalScenarioFilter':
      return { ...state, evalScenarioFilter: action.value };
    case 'setEvalOutcomeFilter':
      return { ...state, evalOutcomeFilter: action.value };
    case 'replaceAll':
      return action.state;
  }
}

export function useAdminDashboardFilters(initial: AdminDashboardFilterState) {
  const [filters, dispatch] = useReducer(filterReducer, initial);

  return {
    filters,
    dispatch,
    setRuntimeStatusFilter: (value: string) => dispatch({ type: 'setRuntimeStatusFilter', value }),
    setRuntimeModelFilter: (value: string) => dispatch({ type: 'setRuntimeModelFilter', value }),
    setRuntimePricingSourceFilter: (value: string) => dispatch({ type: 'setRuntimePricingSourceFilter', value }),
    setRuntimeExecutionModeFilter: (value: ExecutionModeFilter) =>
      dispatch({ type: 'setRuntimeExecutionModeFilter', value }),
    setRuntimeInteractionKindFilter: (value: InteractionKindFilter) =>
      dispatch({ type: 'setRuntimeInteractionKindFilter', value }),
    setApprovalsExecutionModeFilter: (value: ExecutionModeFilter) =>
      dispatch({ type: 'setApprovalsExecutionModeFilter', value }),
    setApprovalsInteractionKindFilter: (value: InteractionKindFilter) =>
      dispatch({ type: 'setApprovalsInteractionKindFilter', value }),
    setEvalScenarioFilter: (value: string) => dispatch({ type: 'setEvalScenarioFilter', value }),
    setEvalOutcomeFilter: (value: string) => dispatch({ type: 'setEvalOutcomeFilter', value })
  };
}
