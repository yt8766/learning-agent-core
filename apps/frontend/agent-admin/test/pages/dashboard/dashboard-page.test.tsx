import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '@/pages/dashboard/dashboard-page';

vi.mock('@/hooks/use-admin-dashboard', () => ({
  PAGE_TITLES: {
    runtime: 'Runtime Center',
    approvals: 'Approvals Center',
    learning: 'Learning Center',
    evals: 'Evals',
    archives: 'Archive Center',
    skills: 'Skill Lab',
    evidence: 'Evidence Center',
    connectors: 'Connector & Policy',
    skillSources: 'Skill Sources',
    companyAgents: 'Company Agents'
  },
  useAdminDashboard: () => ({
    page: 'runtime',
    title: 'Runtime Center',
    health: 'healthy 路 12:00',
    consoleData: {
      runtime: {
        activeTaskCount: 3,
        activeMinistries: ['gongbu-code'],
        usageAnalytics: {
          historyDays: 30
        },
        recentRuns: [
          {
            id: 'task_12345678',
            goal: '诊断 runtime 任务',
            status: 'running',
            currentMinistry: 'gongbu-code'
          }
        ]
      },
      learning: { totalCandidates: 2, pendingCandidates: 1, candidates: [] },
      evals: { scenarioCount: 4, overallPassRate: 98, recentRuns: [] },
      skills: [],
      evidence: [],
      connectors: [],
      skillSources: { sources: [], manifests: [], installed: [], receipts: [] },
      companyAgents: [],
      rules: [],
      tasks: [],
      sessions: [],
      approvals: []
    },
    bundle: null,
    activeTaskId: 'task_12345678',
    pendingApprovals: [],
    loading: false,
    polling: false,
    runtimeHistoryDays: 30,
    setRuntimeHistoryDays: vi.fn(),
    evalsHistoryDays: 30,
    setEvalsHistoryDays: vi.fn(),
    runtimeStatusFilter: '',
    setRuntimeStatusFilter: vi.fn(),
    runtimeModelFilter: '',
    setRuntimeModelFilter: vi.fn(),
    runtimePricingSourceFilter: '',
    setRuntimePricingSourceFilter: vi.fn(),
    runtimeExecutionModeFilter: 'all',
    setRuntimeExecutionModeFilter: vi.fn(),
    runtimeInteractionKindFilter: 'all',
    setRuntimeInteractionKindFilter: vi.fn(),
    approvalsExecutionModeFilter: 'all',
    setApprovalsExecutionModeFilter: vi.fn(),
    approvalsInteractionKindFilter: 'all',
    setApprovalsInteractionKindFilter: vi.fn(),
    evalScenarioFilter: '',
    setEvalScenarioFilter: vi.fn(),
    evalOutcomeFilter: '',
    setEvalOutcomeFilter: vi.fn(),
    refreshDiagnostics: null,
    activeRefreshTargets: [],
    shareUrl: 'https://example.com/admin',
    error: '',
    setPage: vi.fn(),
    refreshAll: vi.fn(),
    handleQuickCreate: vi.fn(),
    selectTask: vi.fn(),
    refreshPageCenter: vi.fn(),
    handleRetryTask: vi.fn(),
    handleCreateDiagnosisTask: vi.fn(),
    downloadRuntimeExport: vi.fn(),
    downloadApprovalsExport: vi.fn(),
    downloadEvalsExport: vi.fn(),
    updateApproval: vi.fn(),
    handleInvalidateMemory: vi.fn(),
    handleSupersedeMemory: vi.fn(),
    handleRestoreMemory: vi.fn(),
    handleRetireMemory: vi.fn(),
    handleCreateCounselorSelector: vi.fn(),
    handleEditCounselorSelector: vi.fn(),
    handleEnableCounselorSelector: vi.fn(),
    handleDisableCounselorSelector: vi.fn(),
    handleSetLearningConflictStatus: vi.fn(),
    handlePromoteSkill: vi.fn(),
    handleDisableSkill: vi.fn(),
    handleRestoreSkill: vi.fn(),
    handleRetireSkill: vi.fn(),
    handleInvalidateRule: vi.fn(),
    handleSupersedeRule: vi.fn(),
    handleRestoreRule: vi.fn(),
    handleRetireRule: vi.fn(),
    handleCloseConnectorSession: vi.fn(),
    handleRefreshConnectorDiscovery: vi.fn(),
    handleEnableConnector: vi.fn(),
    handleDisableConnector: vi.fn(),
    handleSetConnectorPolicy: vi.fn(),
    handleClearConnectorPolicy: vi.fn(),
    handleSetCapabilityPolicy: vi.fn(),
    handleClearCapabilityPolicy: vi.fn(),
    handleConfigureConnector: vi.fn(),
    handleInstallSkill: vi.fn(),
    handleApproveSkillInstall: vi.fn(),
    handleRejectSkillInstall: vi.fn(),
    handleEnableSkillSource: vi.fn(),
    handleDisableSkillSource: vi.fn(),
    handleSyncSkillSource: vi.fn(),
    handleEnableCompanyAgent: vi.fn(),
    handleDisableCompanyAgent: vi.fn()
  })
}));

vi.mock('../../../src/features/runtime-overview/runtime-overview-panel', () => ({
  RuntimeOverviewPanel: () => <div>runtime panel body</div>
}));

describe('DashboardPage shell', () => {
  it('renders shadcn dashboard shell with sidebar, header, cards, and center body', () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('Platform Console');
    expect(html).toContain('Runtime Center');
    expect(html).toContain('Recent Runs');
    expect(html).toContain('复制分享链接');
    expect(html).toContain('系统健康');
    expect(html).toContain('runtime panel body');
  });
});
