import { Activity, AlertCircle, ArrowRightLeft, ClipboardCheck, FolderKanban, Radar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar } from '@/components/app-sidebar';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { PAGE_TITLES, useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { renderDashboardCenter } from './dashboard-center-content';

export function DashboardPage() {
  const dashboard = useAdminDashboard();
  const consoleData = dashboard.consoleData;

  const headerConfig = {
    runtime: {
      icon: <Radar className="h-4 w-4" />,
      description: '治理控制台',
      badges: buildHeaderBadges(consoleData)
    },
    approvals: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: buildHeaderBadges(consoleData)
    },
    learning: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    workspace: {
      icon: <FolderKanban className="h-4 w-4" />,
      description: '工作区与技能飞轮治理',
      badges: []
    },
    memory: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    profiles: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    evals: {
      icon: <Radar className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    archives: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    skills: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    evidence: {
      icon: <AlertCircle className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    connectors: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    skillSources: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    },
    companyAgents: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '治理控制台',
      badges: []
    }
  }[dashboard.page];

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

  return (
    <SidebarProvider
      className="bg-[#fdfdfc]"
      style={
        {
          '--sidebar-width': '21.5rem',
          '--header-height': '4rem'
        } as React.CSSProperties
      }
    >
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
          icon={headerConfig.icon}
          health={dashboard.health}
          loading={dashboard.loading}
          description={headerConfig.description}
          badges={headerConfig.badges}
          onRefresh={dashboard.refreshAll}
          onRefreshMetrics={dashboard.handleRefreshMetricsSnapshots}
          onQuickCreate={dashboard.handleQuickCreate}
          onCopyShareLink={() => void navigator.clipboard.writeText(dashboard.shareUrl)}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 pt-3 md:p-5 md:pt-3">
            <SectionCards items={summaryCards} />
            <div className="min-h-[calc(100vh-8rem)] flex-1 rounded-[1.75rem] bg-[#f8f8f6] p-4 md:min-h-min md:p-5">
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
