import { useEffect, useMemo, useState } from 'react';

import {
  approveTask,
  createTask,
  disableSkill,
  getHealth,
  getTaskBundle,
  listLabSkills,
  listPendingApprovals,
  listRules,
  listTasks,
  promoteSkill,
  rejectTask
} from '../api/admin-api';
import { ApprovalCenterItem, RuleRecord, SkillRecord, TaskBundle, TaskRecord, TraceRecord } from '../types/admin';

export type DashboardPageKey = 'overview' | 'tasks' | 'approvals' | 'skills';

export interface TaskListItem {
  id: string;
  goal: string;
  status: string;
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  updatedAt: number;
  approvals: Array<{ intent: string; decision: string; reason?: string }>;
}

export const PAGE_TITLES: Record<DashboardPageKey, string> = {
  overview: '运行总览',
  tasks: '任务追踪',
  approvals: '审批中心',
  skills: '技能与规则'
};

function toTaskListItem(task: TaskRecord): TaskListItem {
  return {
    id: task.id,
    goal: task.goal,
    status: task.status,
    currentStep: task.currentStep,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    approvals: task.approvals ?? [],
    updatedAt: task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now()
  };
}

function readPageFromHash(): DashboardPageKey {
  const page = window.location.hash.replace('#/', '');
  if (page === 'tasks' || page === 'approvals' || page === 'skills') {
    return page;
  }
  return 'overview';
}

export function getRuntimeBadges(task?: TaskRecord): string[] {
  if (!task) {
    return [];
  }

  const badges = [`节点：${task.currentStep ?? '未知'}`];
  if (typeof task.retryCount === 'number' && typeof task.maxRetries === 'number') {
    badges.push(`重试：${task.retryCount}/${task.maxRetries}`);
  }
  if (task.status === 'waiting_approval') {
    badges.push('审批：待处理');
  }
  return badges;
}

export function getLatestTraces(traces: TraceRecord[]): TraceRecord[] {
  return [...traces].slice(-6).reverse();
}

export function useAdminDashboard() {
  const [page, setPage] = useState<DashboardPageKey>(() => readPageFromHash());
  const [health, setHealth] = useState('检查中');
  const [bundle, setBundle] = useState<TaskBundle | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalCenterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onHashChange = () => setPage(readPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    void refreshAll();
    void getHealth()
      .then(value => setHealth(`${value.status} · ${value.now}`))
      .catch(() => setHealth('离线'));
  }, []);

  useEffect(() => {
    if (!bundle) {
      return;
    }

    const shouldPoll = ['queued', 'running', 'waiting_approval'].includes(bundle.task.status);
    if (!shouldPoll) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const timer = window.setInterval(() => {
      void refreshTask(bundle.task.id, false);
    }, 4000);

    return () => {
      window.clearInterval(timer);
      setPolling(false);
    };
  }, [bundle?.task.id, bundle?.task.status]);

  async function refreshAll(): Promise<void> {
    try {
      setLoading(true);
      setError('');
      const [nextSkills, nextRules, nextTasks, approvalTasks] = await Promise.all([
        listLabSkills().catch(() => []),
        listRules().catch(() => []),
        listTasks().catch(() => []),
        listPendingApprovals().catch(() => [])
      ]);

      const mappedTasks = nextTasks.map(toTaskListItem);
      setSkills(nextSkills);
      setRules(nextRules);
      setTasks(mappedTasks);
      setPendingApprovals(
        approvalTasks.flatMap(task =>
          (task.approvals ?? [])
            .filter(approval => approval.decision === 'pending')
            .map(approval => ({
              taskId: task.id,
              goal: task.goal,
              status: task.status,
              intent: approval.intent,
              reason: approval.reason
            }))
        )
      );

      const activeTaskId = bundle?.task.id ?? mappedTasks[0]?.id;
      if (activeTaskId) {
        const nextBundle = await getTaskBundle(activeTaskId);
        setBundle(nextBundle);
      } else {
        setBundle(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '刷新观测数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function refreshTask(taskId: string, withLoading: boolean): Promise<void> {
    try {
      if (withLoading) {
        setLoading(true);
      }
      setError('');
      const [nextBundle, nextTasks, approvalTasks] = await Promise.all([
        getTaskBundle(taskId),
        listTasks().catch(() => []),
        listPendingApprovals().catch(() => [])
      ]);
      setBundle(nextBundle);
      setTasks(nextTasks.map(toTaskListItem));
      setPendingApprovals(
        approvalTasks.flatMap(task =>
          (task.approvals ?? [])
            .filter(approval => approval.decision === 'pending')
            .map(approval => ({
              taskId: task.id,
              goal: task.goal,
              status: task.status,
              intent: approval.intent,
              reason: approval.reason
            }))
        )
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '刷新任务失败');
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }

  async function selectTask(taskId: string) {
    await refreshTask(taskId, true);
    window.location.hash = '/tasks';
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

  async function handleQuickCreate() {
    try {
      setLoading(true);
      setError('');
      const task = await createTask('分析当前 Agent 运行态并给出下一步建议');
      await refreshTask(task.id, false);
      window.location.hash = '/tasks';
      setPage('tasks');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '快速创建任务失败');
    } finally {
      setLoading(false);
    }
  }

  const orderedTasks = useMemo(() => [...tasks].sort((left, right) => right.updatedAt - left.updatedAt), [tasks]);
  const runtimeBadges = useMemo(() => getRuntimeBadges(bundle?.task), [bundle?.task]);
  const latestTraces = useMemo(() => getLatestTraces(bundle?.traces ?? []), [bundle?.traces]);
  const readyText = health !== '离线' ? '可开始观测联调' : '等待后端服务';

  return {
    page,
    setPage,
    health,
    bundle,
    skills,
    rules,
    tasks: orderedTasks,
    pendingApprovals,
    loading,
    polling,
    error,
    runtimeBadges,
    latestTraces,
    readyText,
    refreshAll,
    selectTask,
    updateApproval,
    handlePromoteSkill,
    handleDisableSkill,
    handleQuickCreate
  };
}
