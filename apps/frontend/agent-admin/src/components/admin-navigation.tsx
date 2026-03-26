import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { DashboardPageKey, TaskRecord } from '../types/admin';

interface AdminNavigationProps {
  page: DashboardPageKey;
  health: string;
  loading: boolean;
  pendingApprovals: number;
  tasks: TaskRecord[];
  activeTaskId?: string;
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onQuickCreate: () => void;
  onSelectTask: (taskId: string) => void;
}

const NAV_ITEMS: Array<{ key: DashboardPageKey; label: string; description: string }> = [
  { key: 'runtime', label: 'Runtime Center', description: '运行态、队列、活跃尚书与任务脉冲' },
  { key: 'approvals', label: 'Approvals Center', description: '待审批动作、批注反馈与风险阻塞' },
  { key: 'learning', label: 'Learning Center', description: '自动沉淀、候选待审与学习质量' },
  { key: 'evals', label: 'Evals', description: 'benchmark 通过率、关键链路健康与回归基线' },
  { key: 'archives', label: 'Archive Center', description: '长期归档、趋势窗口与导出管理' },
  { key: 'skills', label: 'Skill Lab', description: '技能版本、成功率、晋升与禁用' },
  { key: 'evidence', label: 'Evidence Center', description: '来源、证据链、trace 与可信度' },
  { key: 'connectors', label: 'Connector & Policy', description: 'MCP transport、capability 与策略健康' },
  { key: 'skillSources', label: 'Skill Sources', description: '市场、来源优先级、安装回执与本地落库' },
  { key: 'companyAgents', label: 'Company Agents', description: '公司专员、归属六部、连接器依赖与治理状态' }
];

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
  const {
    page,
    health,
    loading,
    pendingApprovals,
    tasks,
    activeTaskId,
    onNavigate,
    onRefresh,
    onQuickCreate,
    onSelectTask
  } = props;

  return (
    <aside className="sticky top-0 flex min-h-screen flex-col border-r border-stone-200 bg-[#fbfaf7] p-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Agent Admin</p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-950">Platform Console</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">管理运行、审批、学习沉淀、技能生命周期与连接器健康。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{health}</Badge>
          <Badge variant="secondary">待审批 {pendingApprovals}</Badge>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="rounded-2xl" onClick={onQuickCreate} disabled={loading}>
            新建审计任务
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onRefresh} disabled={loading}>
            刷新
          </Button>
        </div>
      </div>

      <nav className="mt-6 grid gap-2">
        {NAV_ITEMS.map(item => {
          const active = item.key === page;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={[
                'rounded-3xl border px-4 py-4 text-left transition',
                active
                  ? 'border-stone-900 bg-stone-950 text-white shadow-sm'
                  : 'border-stone-200 bg-white text-stone-900 hover:bg-stone-50'
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold">{item.label}</strong>
                {item.key === 'approvals' ? (
                  <Badge variant={active ? 'secondary' : 'warning'}>{pendingApprovals}</Badge>
                ) : null}
              </div>
              <p className={['mt-2 text-xs leading-5', active ? 'text-stone-300' : 'text-stone-500'].join(' ')}>
                {item.description}
              </p>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-stone-900">Recent Runs</p>
          <Badge variant="outline">{tasks.length}</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {tasks.slice(0, 6).map(task => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
              className={[
                'rounded-2xl border px-3 py-3 text-left transition',
                activeTaskId === task.id
                  ? 'border-stone-900 bg-stone-950 text-white'
                  : 'border-stone-200 bg-stone-50 hover:bg-white'
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                <span
                  className={['text-[11px]', activeTaskId === task.id ? 'text-stone-300' : 'text-stone-400'].join(' ')}
                >
                  {task.id.slice(0, 8)}
                </span>
              </div>
              <p
                className={[
                  'mt-2 line-clamp-2 text-sm font-medium',
                  activeTaskId === task.id ? 'text-white' : 'text-stone-900'
                ].join(' ')}
              >
                {task.goal}
              </p>
              <p className={['mt-1 text-xs', activeTaskId === task.id ? 'text-stone-300' : 'text-stone-500'].join(' ')}>
                {task.currentMinistry ?? task.currentStep ?? 'waiting assignment'}
              </p>
            </button>
          ))}
          {tasks.length === 0 ? <p className="text-sm text-stone-500">当前暂无运行任务。</p> : null}
        </div>
      </div>
    </aside>
  );
}
