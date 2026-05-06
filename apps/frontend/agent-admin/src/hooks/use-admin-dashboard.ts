import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { adminQueryKeys, fetchAdminHealth, fetchPlatformConsoleLogAnalysis } from '@/api/admin-query';
import type { DashboardPageKey, PlatformConsoleRecord, TaskBundle } from '@/types/admin';
import { createAdminDashboardActions } from '@/hooks/admin-dashboard/admin-dashboard-actions';
import type { RunObservatoryFocusTarget } from '@/pages/run-observatory/run-observatory-panel-support';
import type { RuntimeReplayLaunchReceipt } from '@/pages/runtime-overview/components/runtime-run-workbench-support';
import {
  PAGE_TITLES,
  buildDashboardShareUrl,
  readDashboardStateFromRoute,
  shouldPollTask,
  toApprovalItems
} from '@/hooks/admin-dashboard/admin-dashboard-constants';
import { useHashChangeListener, useHashWriter } from '@/hooks/admin-dashboard/admin-dashboard-hash-sync';
import { useAdminDashboardFilters } from '@/hooks/admin-dashboard/admin-dashboard-filter-state';
import { buildAdminDashboardRefreshIntent } from '@/hooks/admin-dashboard/admin-dashboard-refresh-intent';

export { PAGE_TITLES };

let initialDashboardRefreshPromise: Promise<void> | null = null;

export function useAdminDashboard() {
  const queryClient = useQueryClient();
  const initialHashState = readDashboardStateFromRoute();
  const [page, setPage] = useState<DashboardPageKey>(() => initialHashState.page);
  const [health, setHealth] = useState('检查中');
  const [consoleData, setConsoleData] = useState<PlatformConsoleRecord | null>(null);
  const [bundle, setBundle] = useState<TaskBundle | null>(null);
  const [activeTaskIdState, setActiveTaskId] = useState<string | undefined>(() => initialHashState.runtimeTaskId);
  const [observatoryFocusTarget, setObservatoryFocusTarget] = useState<RunObservatoryFocusTarget>(() =>
    initialHashState.runtimeFocusKind && initialHashState.runtimeFocusId
      ? {
          kind: initialHashState.runtimeFocusKind,
          id: initialHashState.runtimeFocusId
        }
      : undefined
  );
  const [runtimeCompareTaskId, setRuntimeCompareTaskId] = useState<string | undefined>(
    () => initialHashState.runtimeCompareTaskId
  );
  const [runtimeGraphNodeId, setRuntimeGraphNodeId] = useState<string | undefined>(
    () => initialHashState.runtimeGraphNodeId
  );
  const [runtimeReplayReceipt, setRuntimeReplayReceipt] = useState<RuntimeReplayLaunchReceipt | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [runtimeHistoryDays, setRuntimeHistoryDays] = useState(30);
  const [evalsHistoryDays, setEvalsHistoryDays] = useState(30);
  const {
    filters,
    setRuntimeStatusFilter,
    setRuntimeModelFilter,
    setRuntimePricingSourceFilter,
    setRuntimeExecutionModeFilter,
    setRuntimeInteractionKindFilter,
    setApprovalsExecutionModeFilter,
    setApprovalsInteractionKindFilter,
    setEvalScenarioFilter,
    setEvalOutcomeFilter
  } = useAdminDashboardFilters({
    runtimeStatusFilter: initialHashState.runtimeStatusFilter,
    runtimeModelFilter: initialHashState.runtimeModelFilter,
    runtimePricingSourceFilter: initialHashState.runtimePricingSourceFilter,
    runtimeExecutionModeFilter: initialHashState.runtimeExecutionModeFilter,
    runtimeInteractionKindFilter: initialHashState.runtimeInteractionKindFilter,
    approvalsExecutionModeFilter: initialHashState.approvalsExecutionModeFilter,
    approvalsInteractionKindFilter: initialHashState.approvalsInteractionKindFilter,
    evalScenarioFilter: '',
    evalOutcomeFilter: ''
  });
  const [refreshDiagnostics, setRefreshDiagnostics] = useState<{
    scope: 'all' | 'center' | 'task';
    target: string;
    reason: string;
    outcome: 'started' | 'deduped' | 'throttled' | 'aborted' | 'completed' | 'failed';
    at: string;
  } | null>(null);
  const [activeRefreshTargets, setActiveRefreshTargets] = useState<
    Array<{
      scope: 'all' | 'center' | 'task';
      target: string;
      since: string;
    }>
  >([]);

  const pageRef = useRef(page);
  const runtimeHistoryDaysRef = useRef(runtimeHistoryDays);
  const evalsHistoryDaysRef = useRef(evalsHistoryDays);
  const filtersRef = useRef(filters);
  const bundleRef = useRef<TaskBundle | null>(bundle);
  const consoleDataRef = useRef<PlatformConsoleRecord | null>(consoleData);
  const activeTaskIdRef = useRef<string | undefined>(activeTaskIdState);

  pageRef.current = page;
  runtimeHistoryDaysRef.current = runtimeHistoryDays;
  evalsHistoryDaysRef.current = evalsHistoryDays;
  filtersRef.current = filters;
  bundleRef.current = bundle;
  consoleDataRef.current = consoleData;
  activeTaskIdRef.current = activeTaskIdState;

  const actions = useMemo(
    () =>
      createAdminDashboardActions({
        queryClient,
        getPage: () => pageRef.current,
        getActiveTaskId: () => activeTaskIdRef.current,
        getRuntimeHistoryDays: () => runtimeHistoryDaysRef.current,
        getEvalsHistoryDays: () => evalsHistoryDaysRef.current,
        getRuntimeFilters: () => ({
          status: filtersRef.current.runtimeStatusFilter,
          model: filtersRef.current.runtimeModelFilter,
          pricingSource: filtersRef.current.runtimePricingSourceFilter,
          executionMode: filtersRef.current.runtimeExecutionModeFilter,
          interactionKind: filtersRef.current.runtimeInteractionKindFilter
        }),
        getApprovalFilters: () => ({
          executionMode: filtersRef.current.approvalsExecutionModeFilter,
          interactionKind: filtersRef.current.approvalsInteractionKindFilter
        }),
        getEvalFilters: () => ({
          scenario: filtersRef.current.evalScenarioFilter,
          outcome: filtersRef.current.evalOutcomeFilter
        }),
        getBundle: () => bundleRef.current,
        getConsoleData: () => consoleDataRef.current,
        setPage,
        setActiveTaskId,
        setObservatoryFocusTarget,
        setRuntimeCompareTaskId,
        setRuntimeGraphNodeId,
        setRuntimeReplayReceipt,
        setLoading,
        setError,
        setConsoleData,
        setBundle,
        reportRefresh: event => {
          const timestamp = new Date().toISOString();
          setRefreshDiagnostics({
            ...event,
            at: timestamp
          });
          const refreshKey = `${event.scope}:${event.target}`;
          setActiveRefreshTargets(current => {
            if (event.outcome === 'started') {
              const remaining = current.filter(item => `${item.scope}:${item.target}` !== refreshKey);
              return [...remaining, { scope: event.scope, target: event.target, since: timestamp }];
            }
            if (['completed', 'aborted', 'failed'].includes(event.outcome)) {
              return current.filter(item => `${item.scope}:${item.target}` !== refreshKey);
            }
            return current;
          });
        }
      }),
    [queryClient]
  );

  const healthQuery = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => fetchAdminHealth(queryClient),
    retry: false,
    staleTime: 30_000
  });
  const platformConsoleLogAnalysisQuery = useQuery({
    queryKey: adminQueryKeys.platformConsoleLogAnalysis(7),
    queryFn: () => fetchPlatformConsoleLogAnalysis(queryClient, 7),
    retry: false,
    staleTime: 30_000
  });

  useHashChangeListener({
    setPage,
    setActiveTaskId,
    setObservatoryFocusTarget,
    setRuntimeCompareTaskId,
    setRuntimeGraphNodeId,
    setRuntimeStatusFilter,
    setRuntimeModelFilter,
    setRuntimePricingSourceFilter,
    setRuntimeExecutionModeFilter,
    setRuntimeInteractionKindFilter,
    setApprovalsExecutionModeFilter,
    setApprovalsInteractionKindFilter
  });

  useHashWriter({
    page,
    activeTaskId: activeTaskIdState,
    observatoryFocusTarget,
    runtimeCompareTaskId,
    runtimeGraphNodeId,
    runtimeStatusFilter: filters.runtimeStatusFilter,
    runtimeModelFilter: filters.runtimeModelFilter,
    runtimePricingSourceFilter: filters.runtimePricingSourceFilter,
    runtimeExecutionModeFilter: filters.runtimeExecutionModeFilter,
    runtimeInteractionKindFilter: filters.runtimeInteractionKindFilter,
    approvalsExecutionModeFilter: filters.approvalsExecutionModeFilter,
    approvalsInteractionKindFilter: filters.approvalsInteractionKindFilter
  });

  const refreshIntent = useMemo(
    () =>
      buildAdminDashboardRefreshIntent({
        page,
        filters
      }),
    [
      page,
      filters.runtimeStatusFilter,
      filters.runtimeModelFilter,
      filters.runtimePricingSourceFilter,
      filters.runtimeExecutionModeFilter,
      filters.runtimeInteractionKindFilter,
      filters.approvalsExecutionModeFilter,
      filters.approvalsInteractionKindFilter,
      filters.evalScenarioFilter,
      filters.evalOutcomeFilter
    ]
  );
  const refreshIntentKey = JSON.stringify(refreshIntent);

  useEffect(() => {
    if (consoleDataRef.current) {
      void actions.refreshPageCenter(refreshIntent.page);
    }
  }, [actions, refreshIntent.page, refreshIntentKey]);

  useEffect(() => {
    if (!initialDashboardRefreshPromise) {
      initialDashboardRefreshPromise = actions.refreshAll().finally(() => {
        initialDashboardRefreshPromise = null;
      });
    }
    void initialDashboardRefreshPromise;
  }, [actions]);

  useEffect(() => {
    if (healthQuery.data) {
      setHealth(`${healthQuery.data.status} 路 ${healthQuery.data.now}`);
      return;
    }
    if (healthQuery.error) {
      setHealth('离线');
    }
  }, [healthQuery.data, healthQuery.error]);

  useEffect(() => {
    if (!shouldPollTask(bundle?.task)) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const timer = window.setInterval(() => {
      if (bundle?.task.id) {
        void actions.refreshTask(bundle.task.id, false);
      }
    }, 4000);

    return () => {
      window.clearInterval(timer);
      setPolling(false);
    };
  }, [actions, bundle?.task.id, bundle?.task.status]);

  const pendingApprovals = useMemo(() => toApprovalItems(consoleData), [consoleData]);
  const activeTaskId = activeTaskIdState ?? bundle?.task.id ?? consoleData?.runtime.recentRuns[0]?.id;
  const shareUrl = useMemo(
    () =>
      buildDashboardShareUrl({
        page,
        runtimeTaskId: activeTaskId,
        runtimeFocusKind: observatoryFocusTarget?.kind,
        runtimeFocusId: observatoryFocusTarget?.id,
        runtimeCompareTaskId,
        runtimeGraphNodeId,
        runtimeStatusFilter: filters.runtimeStatusFilter,
        runtimeModelFilter: filters.runtimeModelFilter,
        runtimePricingSourceFilter: filters.runtimePricingSourceFilter,
        runtimeExecutionModeFilter: filters.runtimeExecutionModeFilter,
        runtimeInteractionKindFilter: filters.runtimeInteractionKindFilter,
        approvalsExecutionModeFilter: filters.approvalsExecutionModeFilter,
        approvalsInteractionKindFilter: filters.approvalsInteractionKindFilter
      }),
    [
      page,
      activeTaskId,
      observatoryFocusTarget,
      runtimeCompareTaskId,
      runtimeGraphNodeId,
      filters.runtimeStatusFilter,
      filters.runtimeModelFilter,
      filters.runtimePricingSourceFilter,
      filters.runtimeExecutionModeFilter,
      filters.runtimeInteractionKindFilter,
      filters.approvalsExecutionModeFilter,
      filters.approvalsInteractionKindFilter
    ]
  );

  return {
    page,
    setPage: (nextPage: DashboardPageKey) => {
      setPage(nextPage);
    },
    shareUrl,
    title: PAGE_TITLES[page],
    health,
    platformConsoleLogAnalysis: platformConsoleLogAnalysisQuery.data ?? null,
    consoleData,
    bundle,
    activeTaskId,
    observatoryFocusTarget,
    setObservatoryFocusTarget,
    runtimeCompareTaskId,
    setRuntimeCompareTaskId,
    runtimeGraphNodeId,
    runtimeReplayReceipt,
    setRuntimeGraphNodeId,
    setRuntimeReplayReceipt,
    pendingApprovals,
    loading,
    polling,
    runtimeHistoryDays,
    setRuntimeHistoryDays,
    evalsHistoryDays,
    setEvalsHistoryDays,
    runtimeStatusFilter: filters.runtimeStatusFilter,
    setRuntimeStatusFilter,
    runtimeModelFilter: filters.runtimeModelFilter,
    setRuntimeModelFilter,
    runtimePricingSourceFilter: filters.runtimePricingSourceFilter,
    setRuntimePricingSourceFilter,
    runtimeExecutionModeFilter: filters.runtimeExecutionModeFilter,
    setRuntimeExecutionModeFilter,
    runtimeInteractionKindFilter: filters.runtimeInteractionKindFilter,
    setRuntimeInteractionKindFilter,
    approvalsExecutionModeFilter: filters.approvalsExecutionModeFilter,
    setApprovalsExecutionModeFilter,
    approvalsInteractionKindFilter: filters.approvalsInteractionKindFilter,
    setApprovalsInteractionKindFilter,
    evalScenarioFilter: filters.evalScenarioFilter,
    setEvalScenarioFilter,
    evalOutcomeFilter: filters.evalOutcomeFilter,
    setEvalOutcomeFilter,
    refreshDiagnostics,
    activeRefreshTargets,
    error,
    ...actions
  };
}

export type AdminDashboardState = ReturnType<typeof useAdminDashboard>;
