import { useEffect } from 'react';

import type { DashboardPageKey } from '@/types/admin';
import type { RunObservatoryFocusTarget } from '@/features/run-observatory/run-observatory-panel-support';
import type { ExecutionModeFilter, InteractionKindFilter } from './admin-dashboard-constants';
import { buildDashboardRoute, readDashboardStateFromRoute } from './admin-dashboard-constants';

interface HashSyncSetters {
  setPage: (page: DashboardPageKey) => void;
  setActiveTaskId: (taskId: string | undefined) => void;
  setObservatoryFocusTarget: (target: RunObservatoryFocusTarget) => void;
  setRuntimeCompareTaskId: (id: string | undefined) => void;
  setRuntimeGraphNodeId: (id: string | undefined) => void;
  setRuntimeStatusFilter: (value: string) => void;
  setRuntimeModelFilter: (value: string) => void;
  setRuntimePricingSourceFilter: (value: string) => void;
  setRuntimeExecutionModeFilter: (value: ExecutionModeFilter) => void;
  setRuntimeInteractionKindFilter: (value: InteractionKindFilter) => void;
  setApprovalsExecutionModeFilter: (value: ExecutionModeFilter) => void;
  setApprovalsInteractionKindFilter: (value: InteractionKindFilter) => void;
}

export function useHashChangeListener(setters: HashSyncSetters) {
  useEffect(() => {
    const onRouteChange = () => {
      const nextState = readDashboardStateFromRoute();
      setters.setPage(nextState.page);
      setters.setActiveTaskId(nextState.runtimeTaskId);
      setters.setObservatoryFocusTarget(
        nextState.runtimeFocusKind && nextState.runtimeFocusId
          ? {
              kind: nextState.runtimeFocusKind,
              id: nextState.runtimeFocusId
            }
          : undefined
      );
      setters.setRuntimeCompareTaskId(nextState.runtimeCompareTaskId);
      setters.setRuntimeGraphNodeId(nextState.runtimeGraphNodeId);
      setters.setRuntimeStatusFilter(nextState.runtimeStatusFilter);
      setters.setRuntimeModelFilter(nextState.runtimeModelFilter);
      setters.setRuntimePricingSourceFilter(nextState.runtimePricingSourceFilter);
      setters.setRuntimeExecutionModeFilter(nextState.runtimeExecutionModeFilter);
      setters.setRuntimeInteractionKindFilter(nextState.runtimeInteractionKindFilter);
      setters.setApprovalsExecutionModeFilter(nextState.approvalsExecutionModeFilter);
      setters.setApprovalsInteractionKindFilter(nextState.approvalsInteractionKindFilter);
    };
    window.addEventListener('popstate', onRouteChange);
    return () => window.removeEventListener('popstate', onRouteChange);
  }, [setters]);
}

interface HashWriteState {
  page: DashboardPageKey;
  activeTaskId?: string;
  observatoryFocusTarget?: RunObservatoryFocusTarget;
  runtimeCompareTaskId?: string;
  runtimeGraphNodeId?: string;
  runtimeStatusFilter: string;
  runtimeModelFilter: string;
  runtimePricingSourceFilter: string;
  runtimeExecutionModeFilter: ExecutionModeFilter;
  runtimeInteractionKindFilter: InteractionKindFilter;
  approvalsExecutionModeFilter: ExecutionModeFilter;
  approvalsInteractionKindFilter: InteractionKindFilter;
}

export function useHashWriter(state: HashWriteState) {
  useEffect(() => {
    const nextRoute = buildDashboardRoute({
      page: state.page,
      runtimeTaskId: state.activeTaskId,
      runtimeFocusKind: state.observatoryFocusTarget?.kind,
      runtimeFocusId: state.observatoryFocusTarget?.id,
      runtimeCompareTaskId: state.runtimeCompareTaskId,
      runtimeGraphNodeId: state.runtimeGraphNodeId,
      runtimeStatusFilter: state.runtimeStatusFilter,
      runtimeModelFilter: state.runtimeModelFilter,
      runtimePricingSourceFilter: state.runtimePricingSourceFilter,
      runtimeExecutionModeFilter: state.runtimeExecutionModeFilter,
      runtimeInteractionKindFilter: state.runtimeInteractionKindFilter,
      approvalsExecutionModeFilter: state.approvalsExecutionModeFilter,
      approvalsInteractionKindFilter: state.approvalsInteractionKindFilter
    });
    const currentRoute = `${window.location.pathname}${window.location.search}`;
    if (currentRoute !== nextRoute || window.location.hash) {
      window.history.replaceState(null, '', nextRoute);
    }
  }, [
    state.page,
    state.activeTaskId,
    state.observatoryFocusTarget,
    state.runtimeCompareTaskId,
    state.runtimeGraphNodeId,
    state.runtimeStatusFilter,
    state.runtimeModelFilter,
    state.runtimePricingSourceFilter,
    state.runtimeExecutionModeFilter,
    state.runtimeInteractionKindFilter,
    state.approvalsExecutionModeFilter,
    state.approvalsInteractionKindFilter
  ]);
}
