import { useEffect, useMemo, useRef, useState } from 'react';

import { getHealth } from '@/api/admin-api';
import type { DashboardPageKey, PlatformConsoleRecord, TaskBundle } from '@/types/admin';
import { createAdminDashboardActions } from '@/hooks/admin-dashboard/admin-dashboard-actions';
import {
  PAGE_TITLES,
  buildDashboardHash,
  buildDashboardShareUrl,
  readDashboardStateFromHash,
  shouldPollTask,
  toApprovalItems
} from '@/hooks/admin-dashboard/admin-dashboard-constants';

export { PAGE_TITLES };

export function useAdminDashboard() {
  const [page, setPage] = useState<DashboardPageKey>(() => readDashboardStateFromHash().page);
  const [health, setHealth] = useState('检查中');
  const [consoleData, setConsoleData] = useState<PlatformConsoleRecord | null>(null);
  const [bundle, setBundle] = useState<TaskBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [runtimeHistoryDays, setRuntimeHistoryDays] = useState(30);
  const [evalsHistoryDays, setEvalsHistoryDays] = useState(30);
  const [runtimeStatusFilter, setRuntimeStatusFilter] = useState('');
  const [runtimeModelFilter, setRuntimeModelFilter] = useState('');
  const [runtimePricingSourceFilter, setRuntimePricingSourceFilter] = useState('');
  const [runtimeExecutionModeFilter, setRuntimeExecutionModeFilter] = useState<
    'all' | 'plan' | 'execute' | 'imperial_direct'
  >(() => readDashboardStateFromHash().runtimeExecutionModeFilter);
  const [runtimeInteractionKindFilter, setRuntimeInteractionKindFilter] = useState<
    | 'all'
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition'
  >(() => readDashboardStateFromHash().runtimeInteractionKindFilter);
  const [approvalsExecutionModeFilter, setApprovalsExecutionModeFilter] = useState<
    'all' | 'plan' | 'execute' | 'imperial_direct'
  >(() => readDashboardStateFromHash().approvalsExecutionModeFilter);
  const [approvalsInteractionKindFilter, setApprovalsInteractionKindFilter] = useState<
    | 'all'
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition'
  >(() => readDashboardStateFromHash().approvalsInteractionKindFilter);
  const [evalScenarioFilter, setEvalScenarioFilter] = useState('');
  const [evalOutcomeFilter, setEvalOutcomeFilter] = useState('');
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
  const runtimeStatusFilterRef = useRef(runtimeStatusFilter);
  const runtimeModelFilterRef = useRef(runtimeModelFilter);
  const runtimePricingSourceFilterRef = useRef(runtimePricingSourceFilter);
  const runtimeExecutionModeFilterRef = useRef(runtimeExecutionModeFilter);
  const runtimeInteractionKindFilterRef = useRef(runtimeInteractionKindFilter);
  const evalScenarioFilterRef = useRef(evalScenarioFilter);
  const evalOutcomeFilterRef = useRef(evalOutcomeFilter);
  const approvalsExecutionModeFilterRef = useRef(approvalsExecutionModeFilter);
  const approvalsInteractionKindFilterRef = useRef(approvalsInteractionKindFilter);
  const bundleRef = useRef<TaskBundle | null>(bundle);
  const consoleDataRef = useRef<PlatformConsoleRecord | null>(consoleData);

  pageRef.current = page;
  runtimeHistoryDaysRef.current = runtimeHistoryDays;
  evalsHistoryDaysRef.current = evalsHistoryDays;
  runtimeStatusFilterRef.current = runtimeStatusFilter;
  runtimeModelFilterRef.current = runtimeModelFilter;
  runtimePricingSourceFilterRef.current = runtimePricingSourceFilter;
  runtimeExecutionModeFilterRef.current = runtimeExecutionModeFilter;
  runtimeInteractionKindFilterRef.current = runtimeInteractionKindFilter;
  evalScenarioFilterRef.current = evalScenarioFilter;
  evalOutcomeFilterRef.current = evalOutcomeFilter;
  approvalsExecutionModeFilterRef.current = approvalsExecutionModeFilter;
  approvalsInteractionKindFilterRef.current = approvalsInteractionKindFilter;
  bundleRef.current = bundle;
  consoleDataRef.current = consoleData;

  const actions = useMemo(
    () =>
      createAdminDashboardActions({
        getPage: () => pageRef.current,
        getRuntimeHistoryDays: () => runtimeHistoryDaysRef.current,
        getEvalsHistoryDays: () => evalsHistoryDaysRef.current,
        getRuntimeFilters: () => ({
          status: runtimeStatusFilterRef.current,
          model: runtimeModelFilterRef.current,
          pricingSource: runtimePricingSourceFilterRef.current,
          executionMode: runtimeExecutionModeFilterRef.current,
          interactionKind: runtimeInteractionKindFilterRef.current
        }),
        getApprovalFilters: () => ({
          executionMode: approvalsExecutionModeFilterRef.current,
          interactionKind: approvalsInteractionKindFilterRef.current
        }),
        getEvalFilters: () => ({ scenario: evalScenarioFilterRef.current, outcome: evalOutcomeFilterRef.current }),
        getBundle: () => bundleRef.current,
        getConsoleData: () => consoleDataRef.current,
        setPage,
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
    []
  );

  useEffect(() => {
    const onHashChange = () => {
      const nextState = readDashboardStateFromHash();
      setPage(nextState.page);
      setRuntimeExecutionModeFilter(nextState.runtimeExecutionModeFilter);
      setRuntimeInteractionKindFilter(nextState.runtimeInteractionKindFilter);
      setApprovalsExecutionModeFilter(nextState.approvalsExecutionModeFilter);
      setApprovalsInteractionKindFilter(nextState.approvalsInteractionKindFilter);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const nextHash = buildDashboardHash({
      page,
      runtimeExecutionModeFilter,
      runtimeInteractionKindFilter,
      approvalsExecutionModeFilter,
      approvalsInteractionKindFilter
    });
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [
    page,
    runtimeExecutionModeFilter,
    runtimeInteractionKindFilter,
    approvalsExecutionModeFilter,
    approvalsInteractionKindFilter
  ]);

  useEffect(() => {
    if (consoleDataRef.current) {
      void actions.refreshPageCenter(pageRef.current);
    }
  }, [actions, page]);

  useEffect(() => {
    if (consoleDataRef.current && page === 'runtime') {
      void actions.refreshPageCenter('runtime');
    }
  }, [
    actions,
    page,
    runtimeStatusFilter,
    runtimeModelFilter,
    runtimePricingSourceFilter,
    runtimeExecutionModeFilter,
    runtimeInteractionKindFilter
  ]);

  useEffect(() => {
    if (consoleDataRef.current && page === 'approvals') {
      void actions.refreshPageCenter('approvals');
    }
  }, [actions, page, approvalsExecutionModeFilter, approvalsInteractionKindFilter]);

  useEffect(() => {
    if (consoleDataRef.current && page === 'evals') {
      void actions.refreshPageCenter('evals');
    }
  }, [actions, page, evalScenarioFilter, evalOutcomeFilter]);

  useEffect(() => {
    void actions.refreshAll();
    void getHealth()
      .then(value => setHealth(`${value.status} 路 ${value.now}`))
      .catch(() => setHealth('离线'));
  }, [actions]);

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
  const activeTaskId = bundle?.task.id ?? consoleData?.runtime.recentRuns[0]?.id;
  const shareUrl = useMemo(
    () =>
      buildDashboardShareUrl({
        page,
        runtimeExecutionModeFilter,
        runtimeInteractionKindFilter,
        approvalsExecutionModeFilter,
        approvalsInteractionKindFilter
      }),
    [
      page,
      runtimeExecutionModeFilter,
      runtimeInteractionKindFilter,
      approvalsExecutionModeFilter,
      approvalsInteractionKindFilter
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
    consoleData,
    bundle,
    activeTaskId,
    pendingApprovals,
    loading,
    polling,
    runtimeHistoryDays,
    setRuntimeHistoryDays,
    evalsHistoryDays,
    setEvalsHistoryDays,
    runtimeStatusFilter,
    setRuntimeStatusFilter,
    runtimeModelFilter,
    setRuntimeModelFilter,
    runtimePricingSourceFilter,
    setRuntimePricingSourceFilter,
    runtimeExecutionModeFilter,
    setRuntimeExecutionModeFilter,
    runtimeInteractionKindFilter,
    setRuntimeInteractionKindFilter,
    approvalsExecutionModeFilter,
    setApprovalsExecutionModeFilter,
    approvalsInteractionKindFilter,
    setApprovalsInteractionKindFilter,
    evalScenarioFilter,
    setEvalScenarioFilter,
    evalOutcomeFilter,
    setEvalOutcomeFilter,
    refreshDiagnostics,
    activeRefreshTargets,
    error,
    ...actions
  };
}
