import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  BrainCircuit,
  Cable,
  ClipboardCheck,
  Database,
  Radar,
  Users
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar } from '@/components/app-sidebar';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { ArchiveCenterPanel } from '@/features/archive-center/archive-center-panel';
import { ApprovalsPanel, filterApprovals } from '@/features/approvals-center/approvals-panel';
import { CompanyAgentsPanel } from '@/features/company-agents/company-agents-panel';
import { ConnectorsCenterPanel } from '@/features/connectors-center/connectors-center-panel';
import { EvidenceCenterPanel } from '@/features/evidence-center/evidence-center-panel';
import { EvalsCenterPanel } from '@/features/evals-center/evals-center-panel';
import { LearningCenterPanel } from '@/features/learning-center/learning-center-panel';
import { filterRuntimeInterruptItems } from '@/features/runtime-overview/components/runtime-summary-tools';
import { RuntimeOverviewPanel } from '@/features/runtime-overview/runtime-overview-panel';
import { SkillLabPanel } from '@/features/skill-lab/skill-lab-panel';
import { SkillSourcesCenterPanel } from '@/features/skill-sources-center/skill-sources-center-panel';
import { PAGE_TITLES, useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { normalizeExecutionMode } from '@/lib/runtime-semantics';

// activeInterrupt is the persisted 司礼监 / InterruptController projection for dashboard summaries.
function DashboardLoadingState() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border/70 bg-card/90 shadow-sm">
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const dashboard = useAdminDashboard();
  const copyShareUrl = () => {
    void navigator.clipboard.writeText(dashboard.shareUrl);
  };

  const consoleData = dashboard.consoleData;
  const filteredApprovals = filterApprovals(dashboard.pendingApprovals, {
    executionMode: dashboard.approvalsExecutionModeFilter,
    interactionKind: dashboard.approvalsInteractionKindFilter
  });
  const filteredRuntimeInterrupts = consoleData
    ? filterRuntimeInterruptItems(
        (consoleData.runtime.recentRuns ?? [])
          .filter(
            task =>
              Boolean(task.activeInterrupt) || task.status === 'waiting_interrupt' || task.status === 'waiting_approval'
          )
          .map(task => {
            const payload = task.activeInterrupt?.payload as
              | { interactionKind?: 'approval' | 'plan-question' | 'supplemental-input' }
              | undefined;
            const interactionKind =
              payload?.interactionKind ?? (task.activeInterrupt?.kind === 'user-input' ? 'plan-question' : 'approval');

            return {
              taskId: task.id,
              goal: task.goal,
              status: task.status,
              executionMode: normalizeExecutionMode(task.executionMode),
              interactionKind,
              interruptLabel:
                task.activeInterrupt?.kind === 'user-input'
                  ? (task.planDraft?.questionSet?.title ?? '计划问题')
                  : (task.pendingApproval?.intent ?? task.activeInterrupt?.intent ?? '操作确认'),
              currentMinistry: task.currentMinistry,
              currentWorker: task.currentWorker,
              updatedAt: task.updatedAt
            };
          }),
        {
          executionMode: dashboard.runtimeExecutionModeFilter,
          interactionKind: dashboard.runtimeInteractionKindFilter
        }
      )
    : [];

  const headerConfig = {
    runtime: {
      icon: <Radar className="h-4 w-4" />,
      description: '观察运行态、队列深度、活跃尚书与当前任务的执行轨迹。',
      badges: [
        `活跃任务 ${consoleData?.runtime.activeTaskCount ?? 0}`,
        `中断视图 ${filteredRuntimeInterrupts.length}`,
        `待审批 ${dashboard.pendingApprovals.length}`,
        `活跃尚书 ${consoleData?.runtime.activeMinistries.length ?? 0}`
      ]
    },
    approvals: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '集中处理高风险动作、审批阻塞与人工反馈。',
      badges: [
        `待处理 ${filteredApprovals.length}`,
        `总待审批 ${dashboard.pendingApprovals.length}`,
        `轮询 ${dashboard.polling ? '开启' : '关闭'}`
      ]
    },
    learning: {
      icon: <BrainCircuit className="h-4 w-4" />,
      description: '查看本轮学到了什么、哪些候选待确认、哪些已进入长期沉淀。',
      badges: [
        `总候选 ${consoleData?.learning.totalCandidates ?? 0}`,
        `待确认 ${consoleData?.learning.pendingCandidates ?? 0}`
      ]
    },
    evals: {
      icon: <Radar className="h-4 w-4" />,
      description: '持续 benchmark、关键链路通过率与回归健康基线。',
      badges: [`场景 ${consoleData?.evals.scenarioCount ?? 0}`, `通过率 ${consoleData?.evals.overallPassRate ?? 0}%`]
    },
    archives: {
      icon: <Database className="h-4 w-4" />,
      description: '查看长期归档的 runtime/evals 历史，并执行数据导出。',
      badges: [
        `runtime ${consoleData?.runtime.usageAnalytics.historyDays ?? 0}d`,
        `evals ${consoleData?.evals.historyDays ?? 0}d`
      ]
    },
    skills: {
      icon: <Database className="h-4 w-4" />,
      description: '管理 Skill Lab 中的技能版本、成功率、晋升与禁用。',
      badges: [`技能 ${consoleData?.skills.length ?? 0}`, `规则 ${consoleData?.rules.length ?? 0}`]
    },
    evidence: {
      icon: <AlertCircle className="h-4 w-4" />,
      description: '查看 trace、来源与证据链，确认系统为什么得出当前结论。',
      badges: [`证据 ${consoleData?.evidence.length ?? 0}`, `会话 ${consoleData?.sessions.length ?? 0}`]
    },
    connectors: {
      icon: <Cable className="h-4 w-4" />,
      description: '治理 MCP connectors、capabilities、审批策略与 transport 健康。',
      badges: [`连接器 ${consoleData?.connectors.length ?? 0}`]
    },
    skillSources: {
      icon: <Database className="h-4 w-4" />,
      description: '管理 Skill 来源优先级、manifest、安装回执与本地落库状态。',
      badges: [
        `来源 ${consoleData?.skillSources.sources.length ?? 0}`,
        `manifest ${consoleData?.skillSources.manifests.length ?? 0}`
      ]
    },
    companyAgents: {
      icon: <Users className="h-4 w-4" />,
      description: '查看公司专员、归属六部、连接器依赖和当前治理状态。',
      badges: [`专员 ${consoleData?.companyAgents.length ?? 0}`]
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
    }
  ];

  const renderCenter = () => {
    if (!consoleData) {
      return <DashboardLoadingState />;
    }

    if (dashboard.page === 'runtime') {
      return (
        <RuntimeOverviewPanel
          runtime={consoleData.runtime}
          bundle={dashboard.bundle}
          historyDays={dashboard.runtimeHistoryDays}
          statusFilter={dashboard.runtimeStatusFilter}
          onStatusFilterChange={dashboard.setRuntimeStatusFilter}
          modelFilter={dashboard.runtimeModelFilter}
          onModelFilterChange={dashboard.setRuntimeModelFilter}
          pricingSourceFilter={dashboard.runtimePricingSourceFilter}
          onPricingSourceFilterChange={dashboard.setRuntimePricingSourceFilter}
          executionModeFilter={dashboard.runtimeExecutionModeFilter}
          onExecutionModeFilterChange={dashboard.setRuntimeExecutionModeFilter}
          interactionKindFilter={dashboard.runtimeInteractionKindFilter}
          onInteractionKindFilterChange={dashboard.setRuntimeInteractionKindFilter}
          onCopyShareLink={copyShareUrl}
          onHistoryDaysChange={days => {
            dashboard.setRuntimeHistoryDays(days);
            void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
          }}
          onExport={dashboard.downloadRuntimeExport}
          onSelectTask={dashboard.selectTask}
          onRetryTask={dashboard.handleRetryTask}
          onRefreshRuntime={() => dashboard.refreshPageCenter('runtime')}
          onCreateDiagnosisTask={dashboard.handleCreateDiagnosisTask}
        />
      );
    }

    if (dashboard.page === 'approvals') {
      return (
        <ApprovalsPanel
          approvals={dashboard.pendingApprovals}
          loading={dashboard.loading}
          onExport={dashboard.downloadApprovalsExport}
          onCopyShareLink={copyShareUrl}
          executionModeFilter={dashboard.approvalsExecutionModeFilter}
          onExecutionModeFilterChange={dashboard.setApprovalsExecutionModeFilter}
          interactionKindFilter={dashboard.approvalsInteractionKindFilter}
          onInteractionKindFilterChange={dashboard.setApprovalsInteractionKindFilter}
          onDecision={dashboard.updateApproval}
        />
      );
    }

    if (dashboard.page === 'learning') {
      return (
        <LearningCenterPanel
          learning={consoleData.learning}
          loading={dashboard.loading}
          onInvalidateMemory={dashboard.handleInvalidateMemory}
          onSupersedeMemory={dashboard.handleSupersedeMemory}
          onRestoreMemory={dashboard.handleRestoreMemory}
          onRetireMemory={dashboard.handleRetireMemory}
          onCreateCounselorSelector={dashboard.handleCreateCounselorSelector}
          onEditCounselorSelector={dashboard.handleEditCounselorSelector}
          onEnableCounselorSelector={dashboard.handleEnableCounselorSelector}
          onDisableCounselorSelector={dashboard.handleDisableCounselorSelector}
          onSetLearningConflictStatus={dashboard.handleSetLearningConflictStatus}
        />
      );
    }

    if (dashboard.page === 'evals') {
      return (
        <EvalsCenterPanel
          evals={consoleData.evals}
          historyDays={dashboard.evalsHistoryDays}
          scenarioFilter={dashboard.evalScenarioFilter}
          onScenarioFilterChange={dashboard.setEvalScenarioFilter}
          outcomeFilter={dashboard.evalOutcomeFilter}
          onOutcomeFilterChange={dashboard.setEvalOutcomeFilter}
          onHistoryDaysChange={days => {
            dashboard.setEvalsHistoryDays(days);
            void dashboard.refreshPageCenter('evals', { evalsDays: days });
          }}
          onExport={dashboard.downloadEvalsExport}
        />
      );
    }

    if (dashboard.page === 'archives') {
      return (
        <ArchiveCenterPanel
          runtime={consoleData.runtime}
          evals={consoleData.evals}
          runtimeHistoryDays={dashboard.runtimeHistoryDays}
          evalsHistoryDays={dashboard.evalsHistoryDays}
          runtimeExportFilters={{
            status: dashboard.runtimeStatusFilter || undefined,
            model: dashboard.runtimeModelFilter || undefined,
            pricingSource: dashboard.runtimePricingSourceFilter || undefined,
            executionMode:
              dashboard.runtimeExecutionModeFilter === 'all' ? undefined : dashboard.runtimeExecutionModeFilter,
            interactionKind:
              dashboard.runtimeInteractionKindFilter === 'all' ? undefined : dashboard.runtimeInteractionKindFilter
          }}
          approvalsExportFilters={{
            executionMode:
              dashboard.approvalsExecutionModeFilter === 'all' ? undefined : dashboard.approvalsExecutionModeFilter,
            interactionKind:
              dashboard.approvalsInteractionKindFilter === 'all' ? undefined : dashboard.approvalsInteractionKindFilter
          }}
          onRuntimeHistoryDaysChange={days => {
            dashboard.setRuntimeHistoryDays(days);
            void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
          }}
          onEvalsHistoryDaysChange={days => {
            dashboard.setEvalsHistoryDays(days);
            void dashboard.refreshPageCenter('evals', { evalsDays: days });
          }}
          onExportRuntime={dashboard.downloadRuntimeExport}
          onExportApprovals={dashboard.downloadApprovalsExport}
          onExportEvals={dashboard.downloadEvalsExport}
        />
      );
    }

    if (dashboard.page === 'skills') {
      return (
        <SkillLabPanel
          skills={consoleData.skills}
          rules={consoleData.rules}
          loading={dashboard.loading}
          onPromote={dashboard.handlePromoteSkill}
          onDisable={dashboard.handleDisableSkill}
          onRestoreSkill={dashboard.handleRestoreSkill}
          onRetireSkill={dashboard.handleRetireSkill}
          onInvalidateRule={dashboard.handleInvalidateRule}
          onSupersedeRule={dashboard.handleSupersedeRule}
          onRestoreRule={dashboard.handleRestoreRule}
          onRetireRule={dashboard.handleRetireRule}
        />
      );
    }

    if (dashboard.page === 'evidence') {
      return <EvidenceCenterPanel evidence={consoleData.evidence} />;
    }

    if (dashboard.page === 'connectors') {
      return (
        <ConnectorsCenterPanel
          connectors={consoleData.connectors}
          onSelectTask={dashboard.selectTask}
          onCloseSession={dashboard.handleCloseConnectorSession}
          onRefreshConnectorDiscovery={dashboard.handleRefreshConnectorDiscovery}
          onEnableConnector={dashboard.handleEnableConnector}
          onDisableConnector={dashboard.handleDisableConnector}
          onSetConnectorPolicy={dashboard.handleSetConnectorPolicy}
          onClearConnectorPolicy={dashboard.handleClearConnectorPolicy}
          onSetCapabilityPolicy={dashboard.handleSetCapabilityPolicy}
          onClearCapabilityPolicy={dashboard.handleClearCapabilityPolicy}
          onConfigureConnector={dashboard.handleConfigureConnector}
        />
      );
    }

    if (dashboard.page === 'skillSources') {
      return (
        <SkillSourcesCenterPanel
          skillSources={consoleData.skillSources}
          onSelectTask={dashboard.selectTask}
          onInstallSkill={dashboard.handleInstallSkill}
          onApproveInstall={dashboard.handleApproveSkillInstall}
          onRejectInstall={dashboard.handleRejectSkillInstall}
          onEnableSource={dashboard.handleEnableSkillSource}
          onDisableSource={dashboard.handleDisableSkillSource}
          onSyncSource={dashboard.handleSyncSkillSource}
        />
      );
    }

    if (dashboard.page === 'companyAgents') {
      return (
        <CompanyAgentsPanel
          agents={consoleData.companyAgents}
          onEnableAgent={dashboard.handleEnableCompanyAgent}
          onDisableAgent={dashboard.handleDisableCompanyAgent}
        />
      );
    }

    return null;
  };

  return (
    <SidebarProvider
      className="bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.05),transparent_28%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 76)',
          '--header-height': 'calc(var(--spacing) * 16)'
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
          onQuickCreate={dashboard.handleQuickCreate}
          onCopyShareLink={copyShareUrl}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards items={summaryCards} />
              {dashboard.error ? (
                <div className="px-4 lg:px-6">
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

              <div className="px-4 lg:px-6">{renderCenter()}</div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
