import { Activity, AlertCircle, ArrowRightLeft, ClipboardCheck, Radar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar } from '@/components/app-sidebar';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { ArchiveCenterPanel } from '@/features/archive-center/archive-center-panel';
import { ApprovalsPanel } from '@/features/approvals-center/approvals-panel';
import { CompanyAgentsPanel } from '@/features/company-agents/company-agents-panel';
import { ConnectorsCenterPanel } from '@/features/connectors-center/connectors-center-panel';
import { EvidenceCenterPanel } from '@/features/evidence-center/evidence-center-panel';
import { EvalsCenterPanel } from '@/features/evals-center/evals-center-panel';
import { LearningCenterPanel } from '@/features/learning-center/learning-center-panel';
import { RuntimeOverviewPanel } from '@/features/runtime-overview/runtime-overview-panel';
import { SkillLabPanel } from '@/features/skill-lab/skill-lab-panel';
import { SkillSourcesCenterPanel } from '@/features/skill-sources-center/skill-sources-center-panel';
import { PAGE_TITLES, useAdminDashboard } from '@/hooks/use-admin-dashboard';

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

  const headerConfig = {
    runtime: {
      icon: <Radar className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    approvals: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    learning: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    evals: {
      icon: <Radar className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    archives: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    skills: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    evidence: {
      icon: <AlertCircle className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    connectors: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    skillSources: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
      badges: []
    },
    companyAgents: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: 'Build Your Application',
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
          onRevokeApprovalPolicy={dashboard.handleRevokeApprovalPolicy}
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
          onQuickCreate={dashboard.handleQuickCreate}
          onCopyShareLink={copyShareUrl}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 pt-3 md:p-5 md:pt-3">
            <SectionCards items={summaryCards.slice(0, 3)} />
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

              {renderCenter()}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
