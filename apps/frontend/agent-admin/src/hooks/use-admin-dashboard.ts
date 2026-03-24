import { useEffect, useMemo, useState } from 'react';

import {
  approveTask,
  closeConnectorSession,
  createTask,
  disableSkill,
  exportEvalsCenter,
  exportRuntimeCenter,
  getApprovalsCenter,
  getConnectorsCenter,
  getEvidenceCenter,
  getEvalsCenterFiltered,
  getHealth,
  getLearningCenter,
  getPlatformConsole,
  getRuntimeCenterFiltered,
  getTaskBundle,
  invalidateMemory,
  invalidateRule,
  retireMemory,
  retireRule,
  retireSkill,
  promoteSkill,
  rejectTask,
  restoreMemory,
  restoreRule,
  restoreSkill,
  supersedeMemory,
  supersedeRule
} from '../api/admin-api';
import type {
  ApprovalCenterItem,
  DashboardPageKey,
  PlatformConsoleRecord,
  TaskBundle,
  TaskRecord
} from '../types/admin';

export const PAGE_TITLES: Record<DashboardPageKey, string> = {
  runtime: 'Runtime Center',
  approvals: 'Approvals Center',
  learning: 'Learning Center',
  evals: 'Evals',
  archives: 'Archive Center',
  skills: 'Skill Lab',
  evidence: 'Evidence Center',
  connectors: 'Connector & Policy Center'
};

function readPageFromHash(): DashboardPageKey {
  const page = window.location.hash.replace('#/', '');
  if (['runtime', 'approvals', 'learning', 'evals', 'archives', 'skills', 'evidence', 'connectors'].includes(page)) {
    return page as DashboardPageKey;
  }
  return 'runtime';
}

function toApprovalItems(consoleData: PlatformConsoleRecord | null): ApprovalCenterItem[] {
  if (!consoleData) {
    return [];
  }

  return consoleData.approvals.flatMap(task =>
    task.approvals
      .filter(approval => approval.decision === 'pending')
      .map(approval => ({
        taskId: task.taskId,
        goal: task.goal,
        status: task.status,
        sessionId: task.sessionId,
        currentMinistry: task.currentMinistry,
        currentWorker: task.currentWorker,
        intent: approval.intent,
        reason: approval.reason
      }))
  );
}

function shouldPollTask(task?: TaskRecord) {
  if (!task) {
    return false;
  }
  return ['queued', 'running', 'waiting_approval', 'blocked'].includes(task.status);
}

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

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!consoleData) {
      return;
    }

    void refreshPageCenter(page);
  }, [page]);

  useEffect(() => {
    if (!consoleData || page !== 'runtime') {
      return;
    }
    void refreshPageCenter('runtime');
  }, [runtimeStatusFilter, runtimeModelFilter, runtimePricingSourceFilter]);

  useEffect(() => {
    if (!consoleData || page !== 'evals') {
      return;
    }
    void refreshPageCenter('evals');
  }, [evalScenarioFilter, evalOutcomeFilter]);

  useEffect(() => {
    void refreshAll();
    void getHealth()
      .then(value => setHealth(`${value.status} · ${value.now}`))
      .catch(() => setHealth('离线'));
  }, []);

  useEffect(() => {
    if (!shouldPollTask(bundle?.task)) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const timer = window.setInterval(() => {
      if (bundle?.task.id) {
        void refreshTask(bundle.task.id, false);
      }
    }, 4000);

    return () => {
      window.clearInterval(timer);
      setPolling(false);
    };
  }, [bundle?.task.id, bundle?.task.status]);

  const pendingApprovals = useMemo(() => toApprovalItems(consoleData), [consoleData]);
  const activeTaskId = bundle?.task.id ?? consoleData?.runtime.recentRuns[0]?.id;

  async function refreshAll(): Promise<void> {
    try {
      setLoading(true);
      setError('');
      const nextConsole = await getPlatformConsole(Math.max(runtimeHistoryDays, evalsHistoryDays));
      setConsoleData(nextConsole);

      const nextTaskId = bundle?.task.id ?? nextConsole.runtime.recentRuns[0]?.id ?? nextConsole.tasks[0]?.id;
      if (nextTaskId) {
        const nextBundle = await getTaskBundle(nextTaskId);
        setBundle(nextBundle);
      } else {
        setBundle(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '刷新平台控制台失败');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPageCenter(
    targetPage: DashboardPageKey,
    options?: { runtimeDays?: number; evalsDays?: number }
  ) {
    if (!consoleData) {
      return;
    }

    try {
      switch (targetPage) {
        case 'runtime': {
          const runtime = await getRuntimeCenterFiltered({
            days: options?.runtimeDays ?? runtimeHistoryDays,
            status: runtimeStatusFilter || undefined,
            model: runtimeModelFilter || undefined,
            pricingSource: runtimePricingSourceFilter || undefined
          });
          setConsoleData(current => (current ? { ...current, runtime } : current));
          break;
        }
        case 'approvals': {
          const approvals = await getApprovalsCenter();
          setConsoleData(current => (current ? { ...current, approvals } : current));
          break;
        }
        case 'learning': {
          const learning = await getLearningCenter();
          setConsoleData(current => (current ? { ...current, learning } : current));
          break;
        }
        case 'evals': {
          const evals = await getEvalsCenterFiltered({
            days: options?.evalsDays ?? evalsHistoryDays,
            scenarioId: evalScenarioFilter || undefined,
            outcome: evalOutcomeFilter || undefined
          });
          setConsoleData(current => (current ? { ...current, evals } : current));
          break;
        }
        case 'evidence': {
          const evidence = await getEvidenceCenter();
          setConsoleData(current => (current ? { ...current, evidence } : current));
          break;
        }
        case 'connectors': {
          const connectors = await getConnectorsCenter();
          setConsoleData(current => (current ? { ...current, connectors } : current));
          break;
        }
        default:
          break;
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '刷新中心数据失败');
    }
  }

  async function refreshTask(taskId: string, withLoading = true) {
    try {
      if (withLoading) {
        setLoading(true);
      }
      setError('');
      const [nextConsole, nextBundle] = await Promise.all([
        getPlatformConsole(Math.max(runtimeHistoryDays, evalsHistoryDays)),
        getTaskBundle(taskId)
      ]);
      setConsoleData(nextConsole);
      setBundle(nextBundle);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '刷新任务详情失败');
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }

  async function selectTask(taskId: string) {
    await refreshTask(taskId);
    window.location.hash = '/runtime';
    setPage('runtime');
  }

  async function updateApproval(decision: 'approve' | 'reject', taskId: string, intent: string) {
    try {
      setLoading(true);
      setError('');
      if (decision === 'approve') {
        await approveTask(taskId, intent);
      } else {
        await rejectTask(taskId, intent);
      }
      await refreshAll();
      if (page === 'approvals') {
        await refreshPageCenter('approvals');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新审批状态失败');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromoteSkill(skillId: string) {
    try {
      setLoading(true);
      setError('');
      await promoteSkill(skillId);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '晋升技能失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisableSkill(skillId: string) {
    try {
      setLoading(true);
      setError('');
      await disableSkill(skillId);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '禁用技能失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreSkill(skillId: string) {
    try {
      setLoading(true);
      setError('');
      await restoreSkill(skillId);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '恢复技能失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetireSkill(skillId: string) {
    try {
      setLoading(true);
      setError('');
      await retireSkill(skillId);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '归档技能失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvalidateMemory(memoryId: string) {
    try {
      setLoading(true);
      setError('');
      await invalidateMemory(memoryId, 'invalidated_from_admin');
      await refreshAll();
      if (page === 'learning') {
        await refreshPageCenter('learning');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '失效记忆失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSupersedeMemory(memoryId: string) {
    const replacementId = window.prompt('输入替代 memory 的 id');
    if (!replacementId) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      await supersedeMemory(memoryId, replacementId, 'superseded_from_admin');
      await refreshAll();
      if (page === 'learning') {
        await refreshPageCenter('learning');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '替代记忆失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreMemory(memoryId: string) {
    try {
      setLoading(true);
      setError('');
      await restoreMemory(memoryId);
      await refreshAll();
      if (page === 'learning') {
        await refreshPageCenter('learning');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '恢复记忆失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetireMemory(memoryId: string) {
    try {
      setLoading(true);
      setError('');
      await retireMemory(memoryId, 'retired_from_admin');
      await refreshAll();
      if (page === 'learning') {
        await refreshPageCenter('learning');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '归档记忆失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvalidateRule(ruleId: string) {
    try {
      setLoading(true);
      setError('');
      await invalidateRule(ruleId, 'invalidated_from_admin');
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '失效规则失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSupersedeRule(ruleId: string) {
    const replacementId = window.prompt('输入替代 rule 的 id');
    if (!replacementId) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      await supersedeRule(ruleId, replacementId, 'superseded_from_admin');
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '替代规则失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreRule(ruleId: string) {
    try {
      setLoading(true);
      setError('');
      await restoreRule(ruleId);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '恢复规则失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetireRule(ruleId: string) {
    try {
      setLoading(true);
      setError('');
      await retireRule(ruleId, 'retired_from_admin');
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '归档规则失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickCreate() {
    try {
      setLoading(true);
      setError('');
      const task = await createTask('审计当前平台控制台、运行态和学习沉淀状态，并给出下一步建议');
      await refreshTask(task.id, false);
      window.location.hash = '/runtime';
      setPage('runtime');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '快速创建任务失败');
    } finally {
      setLoading(false);
    }
  }

  async function downloadRuntimeExport() {
    try {
      setLoading(true);
      setError('');
      const exported = await exportRuntimeCenter({
        days: runtimeHistoryDays,
        status: runtimeStatusFilter || undefined,
        model: runtimeModelFilter || undefined,
        pricingSource: runtimePricingSourceFilter || undefined
      });
      downloadText(exported.filename, exported.mimeType, exported.content);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '导出 runtime 数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function downloadEvalsExport() {
    try {
      setLoading(true);
      setError('');
      const exported = await exportEvalsCenter({
        days: evalsHistoryDays,
        scenarioId: evalScenarioFilter || undefined,
        outcome: evalOutcomeFilter || undefined
      });
      downloadText(exported.filename, exported.mimeType, exported.content);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '导出 evals 数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseConnectorSession(connectorId: string) {
    try {
      setLoading(true);
      setError('');
      await closeConnectorSession(connectorId);
      await refreshPageCenter('connectors');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '关闭 connector session 失败');
    } finally {
      setLoading(false);
    }
  }

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
    refreshAll,
    refreshPageCenter,
    selectTask,
    updateApproval,
    handlePromoteSkill,
    handleDisableSkill,
    handleRestoreSkill,
    handleRetireSkill,
    handleInvalidateMemory,
    handleSupersedeMemory,
    handleRestoreMemory,
    handleRetireMemory,
    handleInvalidateRule,
    handleSupersedeRule,
    handleRestoreRule,
    handleRetireRule,
    handleQuickCreate,
    downloadRuntimeExport,
    downloadEvalsExport,
    handleCloseConnectorSession
  };
}

function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
