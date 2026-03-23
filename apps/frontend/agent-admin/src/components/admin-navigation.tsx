import { Badge } from '@/components/ui/badge';

import type { DashboardPageKey } from '../hooks/use-admin-dashboard';

interface AdminNavigationProps {
  page: DashboardPageKey;
  title: string;
  loading: boolean;
  error: string;
  tasksCount: number;
  activeTaskId?: string;
  tasks: Array<{
    id: string;
    goal: string;
    status: string;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
  }>;
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onQuickCreate: () => void;
  onSelectTask: (taskId: string) => void;
}

const PLATFORM_ITEMS = [
  { key: 'overview' as const, label: '历史记录' },
  { key: 'tasks' as const, label: '星标任务' },
  { key: 'skills' as const, label: '平台设置' }
];

const NAV_GROUPS = [
  { key: 'approvals' as const, label: '模型中心' },
  { key: 'skills' as const, label: '文档知识' },
  { key: 'tasks' as const, label: '运行设置' }
];

const PROJECT_ITEMS = ['设计工程', '销售与市场', '差旅项目', '更多空间'];

function statusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
      return 'destructive' as const;
    case 'waiting_approval':
      return 'warning' as const;
    case 'running':
      return 'default' as const;
    default:
      return 'secondary' as const;
  }
}

export function AdminNavigation(props: AdminNavigationProps) {
  const { page, error, tasksCount, activeTaskId, tasks, onNavigate, onSelectTask } = props;

  return (
    <aside className="flex min-h-[calc(100vh-3rem)] flex-col border-r border-stone-200/80 bg-white px-6 py-10">
      <div className="px-2">
        <p className="text-sm font-medium text-stone-500">Platform</p>
      </div>

      <div className="mt-4 rounded-3xl bg-stone-50 px-4 py-4">
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left text-[1.05rem] font-medium text-stone-950"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-xs text-stone-600">
              ▣
            </span>
            Playground
          </span>
          <span className="text-stone-500">⌄</span>
        </button>

        <div className="mt-3 ml-3 border-l border-stone-200 pl-4">
          {PLATFORM_ITEMS.map(item => {
            const active = page === item.key;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={[
                  'mt-1 block w-full rounded-2xl px-3 py-2 text-left text-[0.98rem] transition',
                  active ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-700 hover:bg-white/80'
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        {NAV_GROUPS.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.key)}
            className="flex items-center justify-between rounded-2xl px-2 py-3 text-left text-[1.05rem] text-stone-900 transition hover:bg-stone-50"
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm text-stone-600">
                ⊡
              </span>
              {item.label}
            </span>
            <span className="text-stone-500">›</span>
          </button>
        ))}
      </div>

      <div className="mt-10 px-2">
        <p className="text-sm font-medium text-stone-500">Projects</p>
      </div>
      <div className="mt-4 grid gap-2">
        {PROJECT_ITEMS.map(label => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl px-2 py-3 text-[1.05rem] text-stone-900 transition hover:bg-stone-50"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm text-stone-500">⌘</span>
            {label}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[28px] border border-stone-200 bg-stone-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-stone-600">任务脉冲</p>
          <Badge variant="secondary">{tasksCount}</Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {tasks.slice(0, 3).map(task => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
              className={[
                'rounded-2xl border px-3 py-3 text-left transition',
                activeTaskId === task.id
                  ? 'border-stone-900 bg-white shadow-sm'
                  : 'border-stone-200 bg-white/80 hover:bg-white'
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                <span className="text-[11px] text-stone-400">{task.id.slice(0, 8)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-stone-900">{task.goal}</p>
            </button>
          ))}
          {tasks.length === 0 ? <p className="text-sm text-stone-500">当前暂无活跃任务。</p> : null}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-fuchsia-300 via-violet-400 to-sky-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-stone-950">系统管理员</p>
          <p className="truncate text-sm text-stone-500">admin@example.com</p>
        </div>
        <div className="text-stone-500">⌄</div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </aside>
  );
}
