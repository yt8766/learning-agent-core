import { AlertCircle, BrainCircuit, Cable, ClipboardCheck, Database, Radar, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { AdminNavigation } from '../../components/admin-navigation';
import { ArchiveCenterPanel } from '../../features/archive-center/archive-center-panel';
import { ApprovalsPanel } from '../../features/approvals-center/approvals-panel';
import { CompanyAgentsPanel } from '../../features/company-agents/company-agents-panel';
import { ConnectorsCenterPanel } from '../../features/connectors-center/connectors-center-panel';
import { EvidenceCenterPanel } from '../../features/evidence-center/evidence-center-panel';
import { EvalsCenterPanel } from '../../features/evals-center/evals-center-panel';
import { LearningCenterPanel } from '../../features/learning-center/learning-center-panel';
import { RuntimeOverviewPanel } from '../../features/runtime-overview/runtime-overview-panel';
import { SkillLabPanel } from '../../features/skill-lab/skill-lab-panel';
import { SkillSourcesCenterPanel } from '../../features/skill-sources-center/skill-sources-center-panel';
import { PAGE_TITLES, useAdminDashboard } from '../../hooks/use-admin-dashboard';

function HeaderCard(props: { title: string; description: string; badges: string[] }) {
  return (
    <Card className="rounded-[32px] border-stone-200 bg-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-400">Agent Admin</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{props.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-500">{props.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.badges.map(badge => (
            <span key={badge}>
              <Badge variant="secondary">{badge}</Badge>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const dashboard = useAdminDashboard();

  const consoleData = dashboard.consoleData;

  const headerConfig = {
    runtime: {
      icon: <Radar className="h-4 w-4" />,
      description: '观察运行态、队列深度、活跃尚书与当前任务的执行轨迹。',
      badges: [
        `活跃任务 ${consoleData?.runtime.activeTaskCount ?? 0}`,
        `待审批 ${dashboard.pendingApprovals.length}`,
        `活跃尚书 ${consoleData?.runtime.activeMinistries.length ?? 0}`
      ]
    },
    approvals: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: '集中处理高风险动作、审批阻塞与人工反馈。',
      badges: [`待审批 ${dashboard.pendingApprovals.length}`, `轮询 ${dashboard.polling ? '开启' : '关闭'}`]
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

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-stone-900">
      <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)]">
        <AdminNavigation
          page={dashboard.page}
          health={dashboard.health}
          loading={dashboard.loading}
          pendingApprovals={dashboard.pendingApprovals.length}
          tasks={consoleData?.runtime.recentRuns ?? []}
          activeTaskId={dashboard.activeTaskId}
          onNavigate={dashboard.setPage}
          onRefresh={dashboard.refreshAll}
          onQuickCreate={dashboard.handleQuickCreate}
          onSelectTask={dashboard.selectTask}
        />

        <main className="space-y-6 p-8">
          <HeaderCard
            title={PAGE_TITLES[dashboard.page]}
            description={headerConfig.description}
            badges={headerConfig.badges}
          />

          {dashboard.error ? (
            <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
              <CardContent className="flex items-start gap-3 p-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-sm font-semibold">平台控制台加载失败</p>
                  <p className="mt-1 text-sm">{dashboard.error}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!consoleData ? (
            <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
              <CardContent className="p-8 text-sm text-stone-500">正在加载平台控制台数据…</CardContent>
            </Card>
          ) : null}

          {consoleData && dashboard.page === 'runtime' ? (
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
              onHistoryDaysChange={days => {
                dashboard.setRuntimeHistoryDays(days);
                void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
              }}
              onExport={dashboard.downloadRuntimeExport}
            />
          ) : null}

          {consoleData && dashboard.page === 'approvals' ? (
            <ApprovalsPanel
              approvals={dashboard.pendingApprovals}
              loading={dashboard.loading}
              onDecision={dashboard.updateApproval}
            />
          ) : null}

          {consoleData && dashboard.page === 'learning' ? (
            <LearningCenterPanel
              learning={consoleData.learning}
              loading={dashboard.loading}
              onInvalidateMemory={dashboard.handleInvalidateMemory}
              onSupersedeMemory={dashboard.handleSupersedeMemory}
              onRestoreMemory={dashboard.handleRestoreMemory}
              onRetireMemory={dashboard.handleRetireMemory}
            />
          ) : null}

          {consoleData && dashboard.page === 'evals' ? (
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
          ) : null}

          {consoleData && dashboard.page === 'archives' ? (
            <ArchiveCenterPanel
              runtime={consoleData.runtime}
              evals={consoleData.evals}
              runtimeHistoryDays={dashboard.runtimeHistoryDays}
              evalsHistoryDays={dashboard.evalsHistoryDays}
              onRuntimeHistoryDaysChange={days => {
                dashboard.setRuntimeHistoryDays(days);
                void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
              }}
              onEvalsHistoryDaysChange={days => {
                dashboard.setEvalsHistoryDays(days);
                void dashboard.refreshPageCenter('evals', { evalsDays: days });
              }}
              onExportRuntime={dashboard.downloadRuntimeExport}
              onExportEvals={dashboard.downloadEvalsExport}
            />
          ) : null}

          {consoleData && dashboard.page === 'skills' ? (
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
          ) : null}

          {consoleData && dashboard.page === 'evidence' ? (
            <EvidenceCenterPanel evidence={consoleData.evidence} />
          ) : null}

          {consoleData && dashboard.page === 'connectors' ? (
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
          ) : null}

          {consoleData && dashboard.page === 'skillSources' ? (
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
          ) : null}

          {consoleData && dashboard.page === 'companyAgents' ? (
            <CompanyAgentsPanel
              agents={consoleData.companyAgents}
              onEnableAgent={dashboard.handleEnableCompanyAgent}
              onDisableAgent={dashboard.handleDisableCompanyAgent}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
