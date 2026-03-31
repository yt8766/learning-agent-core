import {
  AlertCircle,
  BookMarked,
  BrainCircuit,
  Cable,
  ClipboardCheck,
  Database,
  FlaskConical,
  LibraryBig,
  Radar,
  Users,
  Workflow
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { DashboardPageKey, TaskRecord } from '@/types/admin';

export interface AdminNavigationProps {
  page: DashboardPageKey;
  health: string;
  loading: boolean;
  polling: boolean;
  pendingApprovals: number;
  tasks: TaskRecord[];
  activeTaskId?: string;
  refreshDiagnostics?: {
    scope: 'all' | 'center' | 'task';
    target: string;
    reason: string;
    outcome: 'started' | 'deduped' | 'throttled' | 'aborted' | 'completed' | 'failed';
    at: string;
  } | null;
  activeRefreshTargets?: Array<{
    scope: 'all' | 'center' | 'task';
    target: string;
    since: string;
  }>;
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onQuickCreate: () => void;
  onSelectTask: (taskId: string) => void;
}

export const NAV_ITEMS: Array<{
  key: DashboardPageKey;
  label: string;
  description: string;
  icon: typeof Radar;
}> = [
  { key: 'runtime', label: 'Runtime Center', description: '运行态、队列、活跃尚书与任务脉冲', icon: Radar },
  { key: 'approvals', label: 'Approvals Center', description: '待审批动作、批注反馈与风险阻塞', icon: ClipboardCheck },
  { key: 'learning', label: 'Learning Center', description: '自动沉淀、候选待审与学习质量', icon: BrainCircuit },
  { key: 'evals', label: 'Evals', description: 'benchmark 通过率、关键链路健康与回归基线', icon: FlaskConical },
  { key: 'archives', label: 'Archive Center', description: '长期归档、趋势窗口与导出管理', icon: Database },
  { key: 'skills', label: 'Skill Lab', description: '技能版本、成功率、晋升与禁用', icon: Workflow },
  { key: 'evidence', label: 'Evidence Center', description: '来源、证据链、trace 与可信度', icon: AlertCircle },
  { key: 'connectors', label: 'Connector & Policy', description: 'MCP transport、capability 与策略健康', icon: Cable },
  {
    key: 'skillSources',
    label: 'Skill Sources',
    description: '市场、来源优先级、安装回执与本地落库',
    icon: BookMarked
  },
  {
    key: 'companyAgents',
    label: 'Company Agents',
    description: '公司专员、归属六部、连接器依赖与治理状态',
    icon: Users
  }
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

export function AppSidebar(props: AdminNavigationProps & { variant?: 'default' | 'inset' }) {
  const {
    page,
    health,
    loading,
    polling,
    pendingApprovals,
    tasks,
    activeTaskId,
    refreshDiagnostics,
    activeRefreshTargets,
    onNavigate,
    onRefresh,
    onQuickCreate,
    onSelectTask,
    variant = 'inset'
  } = props;

  return (
    <Sidebar
      variant={variant}
      className="sticky top-0 h-[calc(100vh-1.5rem)] overflow-hidden border-sidebar-border/80 bg-sidebar/95 backdrop-blur"
    >
      <div className="flex h-full flex-col gap-5 p-4">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Agent Admin</p>
                <CardTitle className="mt-2 text-xl">Platform Console</CardTitle>
              </div>
              <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                <LibraryBig className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>管理运行、审批、学习沉淀、技能生命周期与连接器健康。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{health}</Badge>
              <Badge variant="secondary">待审批 {pendingApprovals}</Badge>
              <Badge variant={polling ? 'warning' : 'outline'}>{polling ? '轮询中' : '轮询关闭'}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="rounded-2xl" onClick={onQuickCreate} disabled={loading}>
                新建审计任务
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={onRefresh} disabled={loading}>
                刷新控制台
              </Button>
            </div>
            {refreshDiagnostics ? (
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">最近刷新</p>
                <p className="mt-1">
                  {refreshDiagnostics.scope} / {refreshDiagnostics.target}
                </p>
                <p className="mt-1">状态：{refreshDiagnostics.outcome}</p>
                <p className="mt-1">{refreshDiagnostics.reason}</p>
                <p className="mt-1">{new Date(refreshDiagnostics.at).toLocaleTimeString()}</p>
              </div>
            ) : null}
            {activeRefreshTargets?.length ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-primary">
                <p className="font-medium text-foreground">当前刷新中</p>
                <div className="mt-2 grid gap-1">
                  {activeRefreshTargets.slice(-3).map(item => (
                    <p key={`${item.scope}:${item.target}`}>
                      {item.scope} / {item.target} / {new Date(item.since).toLocaleTimeString()}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <ScrollArea className="flex-1 pr-1">
          <div className="grid gap-3">
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Centers</p>
              {NAV_ITEMS.map(item => {
                const active = item.key === page;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    className={cn(
                      'w-full rounded-3xl border px-4 py-4 text-left transition',
                      active
                        ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
                        : 'border-border/70 bg-card/80 hover:border-border hover:bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'rounded-2xl p-2',
                            active
                              ? 'bg-primary-foreground/15 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <strong
                          className={cn(
                            'text-sm font-semibold',
                            active ? 'text-primary-foreground' : 'text-foreground'
                          )}
                        >
                          {item.label}
                        </strong>
                      </div>
                      {item.key === 'approvals' ? (
                        <Badge variant={active ? 'secondary' : 'warning'}>{pendingApprovals}</Badge>
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-xs leading-5',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Recent Runs</CardTitle>
                  <Badge variant="outline">{tasks.length}</Badge>
                </div>
                <CardDescription>选中最近运行任务，联动右侧详情和轨迹视图。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {tasks.slice(0, 6).map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      'w-full rounded-2xl border px-3 py-3 text-left transition',
                      activeTaskId === task.id
                        ? 'border-primary/25 bg-primary/5'
                        : 'border-border/70 bg-muted/30 hover:bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                      <span className="text-[11px] text-muted-foreground">{task.id.slice(0, 8)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{task.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.currentMinistry ?? task.currentStep ?? 'waiting assignment'}
                    </p>
                  </button>
                ))}
                {tasks.length === 0 ? <p className="text-sm text-muted-foreground">当前暂无运行任务。</p> : null}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </Sidebar>
  );
}
