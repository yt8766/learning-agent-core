import { useEffect, useMemo, useRef, useState } from 'react';

import { getHealth } from '../api/admin-api';
import type { DashboardPageKey, PlatformConsoleRecord, TaskBundle } from '../types/admin';
import { createAdminDashboardActions } from './admin-dashboard/admin-dashboard-actions';
import {
  PAGE_TITLES,
  readPageFromHash,
  shouldPollTask,
  toApprovalItems
} from './admin-dashboard/admin-dashboard-constants';

export { PAGE_TITLES };

export function useAdminDashboard() {
  const [page, setPage] = useState<DashboardPageKey>(() => readPageFromHash());
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
  const [evalScenarioFilter, setEvalScenarioFilter] = useState('');
  const [evalOutcomeFilter, setEvalOutcomeFilter] = useState('');

  const pageRef = useRef(page);
  const runtimeHistoryDaysRef = useRef(runtimeHistoryDays);
  const evalsHistoryDaysRef = useRef(evalsHistoryDays);
  const runtimeStatusFilterRef = useRef(runtimeStatusFilter);
  const runtimeModelFilterRef = useRef(runtimeModelFilter);
  const runtimePricingSourceFilterRef = useRef(runtimePricingSourceFilter);
  const evalScenarioFilterRef = useRef(evalScenarioFilter);
  const evalOutcomeFilterRef = useRef(evalOutcomeFilter);
  const bundleRef = useRef<TaskBundle | null>(bundle);
  const consoleDataRef = useRef<PlatformConsoleRecord | null>(consoleData);

  pageRef.current = page;
  runtimeHistoryDaysRef.current = runtimeHistoryDays;
  evalsHistoryDaysRef.current = evalsHistoryDays;
  runtimeStatusFilterRef.current = runtimeStatusFilter;
  runtimeModelFilterRef.current = runtimeModelFilter;
  runtimePricingSourceFilterRef.current = runtimePricingSourceFilter;
  evalScenarioFilterRef.current = evalScenarioFilter;
  evalOutcomeFilterRef.current = evalOutcomeFilter;
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
          pricingSource: runtimePricingSourceFilterRef.current
        }),
        getEvalFilters: () => ({ scenario: evalScenarioFilterRef.current, outcome: evalOutcomeFilterRef.current }),
        getBundle: () => bundleRef.current,
        getConsoleData: () => consoleDataRef.current,
        setPage,
        setLoading,
        setError,
        setConsoleData,
        setBundle
      }),
    []
  );

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (consoleData) {
      void actions.refreshPageCenter(page);
    }
  }, [actions, consoleData, page]);

  useEffect(() => {
    if (consoleData && page === 'runtime') {
      void actions.refreshPageCenter('runtime');
    }
  }, [actions, consoleData, page, runtimeStatusFilter, runtimeModelFilter, runtimePricingSourceFilter]);

  useEffect(() => {
    if (consoleData && page === 'evals') {
      void actions.refreshPageCenter('evals');
    }
  }, [actions, consoleData, page, evalScenarioFilter, evalOutcomeFilter]);

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

  return {
    page,
    setPage: (nextPage: DashboardPageKey) => {
      window.location.hash = `/${nextPage}`;
      setPage(nextPage);
    },
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
    evalScenarioFilter,
    setEvalScenarioFilter,
    evalOutcomeFilter,
    setEvalOutcomeFilter,
    error,
    ...actions
  };
}
