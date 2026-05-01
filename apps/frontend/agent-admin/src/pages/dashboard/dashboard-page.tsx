import { Activity, AlertCircle, ArrowRightLeft, ClipboardCheck, Radar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar } from '@/components/app-sidebar';
import { NavigationProgress } from '@/components/navigation-progress';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { PAGE_TITLES, useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { renderDashboardCenter } from './dashboard-center-content';

export function DashboardPage() {
  const dashboard = useAdminDashboard();
  const consoleData = dashboard.consoleData;
  const navigationProgressActive =
    dashboard.loading || dashboard.activeRefreshTargets.some(target => target.scope === 'center');

  const headerBadges =
    dashboard.page === 'runtime' || dashboard.page === 'approvals' ? buildHeaderBadges(consoleData) : [];

  const summaryCards = [
    {
      title: '系统健康',
      value: dashboard.health,
      description: '当前平台巡检与轮询状态快照。',
      icon: Activity,
      tone: 'accent' as const
    },
    {
      title: '待审批',
      value: `${dashboard.pendingApprovals.length}`,
      description: '需要人工确认的高风险动作与恢复节点。',
      icon: ClipboardCheck
    },
    {
      title: '活跃任务',
      value: `${consoleData?.runtime.activeTaskCount ?? 0}`,
      description: '仍在前线流转、等待六部执行或中断处理的任务数。',
      icon: Radar
    },
    {
      title: '近期运行',
      value: `${consoleData?.runtime.recentRuns.length ?? 0}`,
      description: '最近回流到控制台的任务与治理面板入口。',
      icon: ArrowRightLeft
    },
    {
      title: '控制台趋势',
      value: buildPlatformConsoleTrendValue(dashboard.platformConsoleLogAnalysis),
      description: buildPlatformConsoleTrendDescription(dashboard.platformConsoleLogAnalysis),
      icon: Activity
    }
  ];
  const compactStatusCards = [
    { label: '健康', value: dashboard.loading ? '加载中' : dashboard.health || '待同步' },
    { label: '审批', value: `${dashboard.pendingApprovals.length}` },
    { label: '模式', value: '控制面' }
  ];

  return (
    <SidebarProvider
      data-admin-shell="shadcn-admin-inspired"
      className="bg-background"
      style={
        {
          '--sidebar-width': '16rem',
          '--header-height': '4rem'
        } as React.CSSProperties
      }
    >
      <NavigationProgress active={navigationProgressActive} />
      <AppSidebar
        page={dashboard.page}
        health={dashboard.health}
        loading={dashboard.loading}
        polling={dashboard.polling}
        pendingApprovals={dashboard.pendingApprovals.length}
        tasks={consoleData?.runtime.recentRuns ?? []}
        activeTaskId={dashboard.activeTaskId}
        refreshDiagnostics={dashboard.refreshDiagnostics}
        activeRefreshTargets={dashboard.activeRefreshTargets}
        onNavigate={dashboard.setPage}
        onRefresh={dashboard.refreshAll}
        onQuickCreate={dashboard.handleQuickCreate}
        onSelectTask={dashboard.selectTask}
      />
      <SidebarInset>
        <SiteHeader
          title={PAGE_TITLES[dashboard.page]}
          page={dashboard.page}
          badges={headerBadges}
          onNavigate={dashboard.setPage}
          onRefresh={dashboard.refreshAll}
          onRefreshMetrics={dashboard.handleRefreshMetricsSnapshots}
          onQuickCreate={dashboard.handleQuickCreate}
          onCopyShareLink={() => void navigator.clipboard.writeText(dashboard.shareUrl)}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">治理控制台</p>
                <h1 className="mt-2 text-2xl font-bold tracking-normal text-foreground md:text-3xl">
                  {PAGE_TITLES[dashboard.page]}
                </h1>
              </div>
              <div data-admin-home-status="compact" className="grid w-full grid-cols-3 gap-2 md:w-[28rem]">
                {compactStatusCards.map(item => (
                  <div key={item.label} className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <SectionCards items={summaryCards} />
            <div className="min-h-[calc(100vh-14rem)] flex-1 rounded-xl border border-border bg-background p-4 shadow-sm md:min-h-min md:p-5">
              {dashboard.error ? (
                <div className="mb-4">
                  <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
                    <CardContent className="flex items-start gap-3 p-5 text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="text-sm font-semibold">平台控制台加载失败</p>
                        <p className="mt-1 text-sm">{dashboard.error}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {renderDashboardCenter(dashboard)}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function buildHeaderBadges(consoleData: ReturnType<typeof useAdminDashboard>['consoleData']) {
  const totalMs = consoleData?.diagnostics?.timingsMs.total;
  const cacheStatus = consoleData?.diagnostics?.cacheStatus;
  const badges: string[] = [];
  if (typeof totalMs === 'number') {
    badges.push(`控制台 ${totalMs}ms`);
  }
  if (cacheStatus) {
    badges.push(`缓存 ${cacheStatus === 'hit' ? '命中' : cacheStatus === 'miss' ? '未命中' : cacheStatus}`);
  }
  return badges;
}

function buildPlatformConsoleTrendValue(analysis: ReturnType<typeof useAdminDashboard>['platformConsoleLogAnalysis']) {
  const slow = analysis?.byEvent['runtime.platform_console.slow'];
  if (!analysis?.sampleCount) {
    return '无样本';
  }
  const statusLabel =
    analysis.summary.status === 'healthy' ? '健康' : analysis.summary.status === 'warning' ? '预警' : '严重';
  if (!slow) {
    return `${statusLabel} / 0 slow`;
  }
  return `${statusLabel} / ${slow.count} slow / P95 ${slow.totalDurationMs.p95}ms`;
}

function buildPlatformConsoleTrendDescription(
  analysis: ReturnType<typeof useAdminDashboard>['platformConsoleLogAnalysis']
) {
  if (!analysis?.sampleCount) {
    return '最近日志里还没有可用的 console 趋势样本。';
  }
  return analysis.summary.reasons[0] ?? '最近日志样本未发现需要关注的趋势异常。';
}
