import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { AdminNavigation } from '../../components/admin-navigation';
import { ApprovalsPanel } from '../../features/approvals-center/approvals-panel';
import { RulesPanel } from '../../features/rules-browser/rules-panel';
import { SkillLabPanel } from '../../features/skill-lab/skill-lab-panel';
import { TaskDetailPanel } from '../../features/task-traces/task-detail-panel';
import { PAGE_TITLES, useAdminDashboard } from '../../hooks/use-admin-dashboard';

const RANGE_OPTIONS = ['Last 3 months', 'Last 30 days', 'Last 7 days'] as const;
const TAB_OPTIONS = ['Overview', 'Past Performance', 'Key Personnel', 'Focus Documents'] as const;
const SORT_OPTIONS = ['最近更新', '状态优先', '重试次数'] as const;

function statusBadgeVariant(status: string) {
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

function buildSeries(seed: number, count: number, scale: number) {
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.65) * 0.28 + Math.cos((index + seed * 2) * 0.21) * 0.18;
    const pulse = (Math.sin((index + seed) * 1.6) + 1) * 0.16;
    return Math.max(0.08, Math.min(0.95, 0.28 + wave + pulse + scale));
  });
}

function toLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return '';
  }

  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - value * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function toAreaPath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return '';
  }

  const step = width / (values.length - 1);
  const top = values
    .map((value, index) => {
      const x = index * step;
      const y = height - value * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return `${top} L ${width} ${height} L 0 ${height} Z`;
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <Card className="min-h-[170px] rounded-[30px] border border-stone-100 bg-stone-50/70 shadow-none">
      <CardContent className="flex h-full flex-col justify-between p-8">
        <div>
          <p className="text-sm font-medium text-stone-500">{label}</p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{value}</p>
        </div>
        <p className="text-sm leading-6 text-stone-400">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ActivityPanel({
  taskCount,
  traceCount,
  pendingCount,
  messageCount,
  activeRange,
  onRangeChange,
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  sortBy,
  onSortChange,
  rows,
  onOpenTask
}: {
  taskCount: number;
  traceCount: number;
  pendingCount: number;
  messageCount: number;
  activeRange: (typeof RANGE_OPTIONS)[number];
  onRangeChange: (value: (typeof RANGE_OPTIONS)[number]) => void;
  activeTab: (typeof TAB_OPTIONS)[number];
  onTabChange: (value: (typeof TAB_OPTIONS)[number]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: (typeof SORT_OPTIONS)[number];
  onSortChange: (value: (typeof SORT_OPTIONS)[number]) => void;
  rows: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    owner: string;
    limit: number;
    target: number;
  }>;
  onOpenTask: (taskId: string) => void;
}) {
  const width = 1160;
  const height = 220;
  const primary = buildSeries(
    taskCount + messageCount + 3,
    42,
    Math.min(0.18, taskCount * 0.012 + messageCount * 0.003)
  );
  const secondary = buildSeries(
    traceCount + pendingCount + 7,
    42,
    Math.min(0.12, pendingCount * 0.02 + traceCount * 0.01)
  );

  return (
    <Card className="rounded-[30px] border border-stone-100 bg-white shadow-none">
      <CardContent className="p-6 md:p-8">
        <div className="rounded-[28px] border border-stone-100 bg-stone-50/60 p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Overview</h2>
              <p className="mt-2 text-sm text-stone-500">
                Agent tasks, approvals, traces and skill activity in one place.
              </p>
            </div>
            <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
              {RANGE_OPTIONS.map(label => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onRangeChange(label)}
                  className={[
                    'rounded-[14px] px-5 py-2.5 text-sm font-medium transition',
                    activeRange === label ? 'bg-stone-100 text-stone-950' : 'text-stone-500 hover:text-stone-900'
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[24px] bg-white px-4 pb-2 pt-6">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full">
              <defs>
                <linearGradient id="admin-overview-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a8a29e" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#a8a29e" stopOpacity="0.06" />
                </linearGradient>
              </defs>
              {[0.2, 0.45, 0.7].map(ratio => (
                <line
                  key={ratio}
                  x1="0"
                  x2={width}
                  y1={height - ratio * height}
                  y2={height - ratio * height}
                  stroke="#ece7e1"
                  strokeWidth="1"
                />
              ))}
              <path d={toAreaPath(primary, width, height)} fill="url(#admin-overview-fill)" />
              <path
                d={toLinePath(primary, width, height)}
                fill="none"
                stroke="#57534e"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={toLinePath(secondary, width, height)}
                fill="none"
                stroke="#78716c"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-fit rounded-2xl border border-stone-200 bg-stone-50 p-1">
            {TAB_OPTIONS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={[
                  'rounded-xl px-4 py-2.5 text-sm font-medium transition',
                  activeTab === tab ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                ].join(' ')}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Search tasks or owners"
              className="min-w-[240px] bg-white"
            />
            <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-50 p-1">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSortChange(option)}
                  className={[
                    'rounded-xl px-3 py-2 text-sm transition',
                    sortBy === option ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-6 py-4 font-medium">Header</th>
                <th className="px-6 py-4 font-medium">Section Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Limit</th>
                <th className="px-6 py-4 font-medium">Reviewer</th>
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-stone-200/80 hover:bg-stone-50/60">
                  <td className="px-6 py-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 text-stone-300">⋮</span>
                      <div>
                        <p className="font-medium text-stone-950">{row.title}</p>
                        <p className="mt-1 text-xs text-stone-400">{row.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-6 py-5 text-lg font-semibold text-stone-900">{row.target}</td>
                  <td className="px-6 py-5 text-lg font-semibold text-stone-900">{row.limit}</td>
                  <td className="px-6 py-5 text-stone-700">{row.owner}</td>
                  <td className="px-6 py-5">
                    <Button variant="ghost" className="rounded-2xl text-stone-700" onClick={() => onOpenTask(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-stone-500" colSpan={7}>
                    No tasks match the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const dashboard = useAdminDashboard();
  const [activeTab, setActiveTab] = useState<(typeof TAB_OPTIONS)[number]>('Overview');
  const [activeRange, setActiveRange] = useState<(typeof RANGE_OPTIONS)[number]>('Last 3 months');
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>('最近更新');

  const summaryCards = [
    {
      label: 'Active Tasks',
      value: dashboard.tasks.length,
      detail: dashboard.bundle?.task.currentStep ?? 'Graph is waiting for the next transition.'
    },
    {
      label: 'Pending Approvals',
      value: dashboard.pendingApprovals.length,
      detail: dashboard.pendingApprovals[0]?.intent ?? 'No approval bottleneck right now.'
    },
    {
      label: 'Skill Drafts',
      value: dashboard.skills.length,
      detail: dashboard.skills[0]?.name ?? 'Skill lab is ready for the next extraction.'
    }
  ];

  const tableRows = useMemo(() => {
    const ownerCount = Math.max(dashboard.bundle?.agents.length ?? 0, 1);
    const focusedRows = dashboard.tasks.map((task, index) => ({
      id: task.id,
      title: task.goal,
      type: task.currentStep ?? 'Graph node',
      status: task.status,
      target: index % 2 === 0 ? (dashboard.bundle?.messages.length ?? 0) : dashboard.pendingApprovals.length,
      limit: (task.maxRetries ?? 1) + index,
      owner: dashboard.bundle?.agents[index % ownerCount]?.role ?? 'Manager Agent',
      updatedAt: task.updatedAt,
      retryCount: task.retryCount ?? 0
    }));

    const tabFiltered = focusedRows.filter(row => {
      if (activeTab === 'Past Performance') {
        return row.status === 'completed' || row.status === 'failed';
      }
      if (activeTab === 'Key Personnel') {
        return row.owner !== 'Manager Agent';
      }
      if (activeTab === 'Focus Documents') {
        return row.type !== 'Graph node';
      }
      return true;
    });

    const searched = tabFiltered.filter(row => {
      const keyword = searchValue.trim().toLowerCase();
      if (!keyword) {
        return true;
      }
      return (
        row.title.toLowerCase().includes(keyword) ||
        row.owner.toLowerCase().includes(keyword) ||
        row.type.toLowerCase().includes(keyword)
      );
    });

    return [...searched].sort((left, right) => {
      if (sortBy === '状态优先') {
        return left.status.localeCompare(right.status);
      }
      if (sortBy === '重试次数') {
        return right.retryCount - left.retryCount;
      }
      return right.updatedAt - left.updatedAt;
    });
  }, [
    activeTab,
    dashboard.bundle?.agents,
    dashboard.bundle?.messages.length,
    dashboard.pendingApprovals.length,
    dashboard.tasks,
    searchValue,
    sortBy
  ]);

  return (
    <main className="min-h-screen bg-white text-stone-900">
      <div className="mx-auto grid min-h-screen max-w-[1900px] xl:grid-cols-[380px_minmax(0,1fr)]">
        <AdminNavigation
          page={dashboard.page}
          title={PAGE_TITLES[dashboard.page]}
          loading={dashboard.loading}
          error={dashboard.error}
          tasksCount={dashboard.tasks.length}
          activeTaskId={dashboard.bundle?.task.id}
          tasks={dashboard.tasks}
          onNavigate={page => {
            window.location.hash = `/${page}`;
            dashboard.setPage(page);
          }}
          onRefresh={() => void dashboard.refreshAll()}
          onQuickCreate={() => void dashboard.handleQuickCreate()}
          onSelectTask={taskId => void dashboard.selectTask(taskId)}
        />

        <section className="space-y-6 px-6 py-5 md:px-8">
          {dashboard.page === 'overview' ? (
            <>
              <div className="grid gap-5 xl:grid-cols-3">
                {summaryCards.map(card => (
                  <div key={card.label}>
                    <MetricCard label={card.label} value={card.value} detail={card.detail} />
                  </div>
                ))}
              </div>

              <ActivityPanel
                taskCount={dashboard.tasks.length}
                traceCount={dashboard.latestTraces.length}
                pendingCount={dashboard.pendingApprovals.length}
                messageCount={dashboard.bundle?.messages.length ?? 0}
                activeRange={activeRange}
                onRangeChange={setActiveRange}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                sortBy={sortBy}
                onSortChange={setSortBy}
                rows={tableRows}
                onOpenTask={taskId => void dashboard.selectTask(taskId)}
              />
            </>
          ) : null}

          {dashboard.page === 'tasks' ? <TaskDetailPanel bundle={dashboard.bundle} /> : null}

          {dashboard.page === 'approvals' ? (
            <ApprovalsPanel
              approvals={dashboard.pendingApprovals}
              loading={dashboard.loading}
              onDecision={(decision, taskId, intent) => void dashboard.updateApproval(decision, taskId, intent)}
            />
          ) : null}

          {dashboard.page === 'skills' ? (
            <div className="grid gap-6">
              <SkillLabPanel
                skills={dashboard.skills}
                loading={dashboard.loading}
                onPromote={skillId => void dashboard.handlePromoteSkill(skillId)}
                onDisable={skillId => void dashboard.handleDisableSkill(skillId)}
              />
              <RulesPanel rules={dashboard.rules} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
