import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '@/pages/dashboard/dashboard-page';

const mockUseAdminDashboard = vi.fn();

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
  useAdminDashboard: () => mockUseAdminDashboard()
}));

vi.mock('../../../src/features/runtime-overview/runtime-overview-panel', () => ({
  RuntimeOverviewPanel: () => <div>runtime panel body</div>
}));
vi.mock('../../../src/features/approvals-center/approvals-panel', () => ({
  ApprovalsPanel: () => <div>approvals panel body</div>,
  filterApprovals: (items: unknown[]) => items
}));
vi.mock('../../../src/features/learning-center/learning-center-panel', () => ({
  LearningCenterPanel: () => <div>learning panel body</div>
}));
vi.mock('../../../src/features/evals-center/evals-center-panel', () => ({
  EvalsCenterPanel: () => <div>evals panel body</div>
}));
vi.mock('../../../src/features/archive-center/archive-center-panel', () => ({
  ArchiveCenterPanel: () => <div>archive panel body</div>
}));
vi.mock('../../../src/features/skill-lab/skill-lab-panel', () => ({
  SkillLabPanel: () => <div>skill lab panel body</div>
}));
vi.mock('../../../src/features/evidence-center/evidence-center-panel', () => ({
  EvidenceCenterPanel: () => <div>evidence panel body</div>
}));
vi.mock('../../../src/features/connectors-center/connectors-center-panel', () => ({
  ConnectorsCenterPanel: () => <div>connectors panel body</div>
}));
vi.mock('../../../src/features/skill-sources-center/skill-sources-center-panel', () => ({
  SkillSourcesCenterPanel: () => <div>skill sources panel body</div>
}));
vi.mock('../../../src/features/company-agents/company-agents-panel', () => ({
  CompanyAgentsPanel: () => <div>company agents panel body</div>
}));

describe('DashboardPage shell', () => {
  function createDashboardOverrides(overrides: Partial<ReturnType<typeof mockUseAdminDashboard>> = {}) {
    return {
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
      handleDisableCompanyAgent: vi.fn(),
      ...overrides
    };
  }

  it('renders shadcn dashboard shell with sidebar, header, cards, and center body', () => {
    mockUseAdminDashboard.mockReturnValue(createDashboardOverrides());

    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('Build Your Application');
    expect(html).toContain('Runtime Center');
    expect(html).toContain('系统健康');
    expect(html).toContain('待审批');
    expect(html).toContain('活跃任务');
    expect(html).toContain('runtime panel body');
  });

  it('renders page-specific center panels for approvals, learning and evals', () => {
    mockUseAdminDashboard
      .mockReturnValueOnce(createDashboardOverrides({ page: 'approvals', title: 'Approvals Center' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'learning', title: 'Learning Center' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'evals', title: 'Evals' }));

    const approvalsHtml = renderToStaticMarkup(<DashboardPage />);
    const learningHtml = renderToStaticMarkup(<DashboardPage />);
    const evalsHtml = renderToStaticMarkup(<DashboardPage />);

    expect(approvalsHtml).toContain('approvals panel body');
    expect(learningHtml).toContain('learning panel body');
    expect(evalsHtml).toContain('evals panel body');
  });

  it('renders archive, skill, evidence, connector, skill source and company agent centers', () => {
    mockUseAdminDashboard
      .mockReturnValueOnce(createDashboardOverrides({ page: 'archives', title: 'Archive Center' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'skills', title: 'Skill Lab' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'evidence', title: 'Evidence Center' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'connectors', title: 'Connector & Policy' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'skillSources', title: 'Skill Sources' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'companyAgents', title: 'Company Agents' }));

    const archivesHtml = renderToStaticMarkup(<DashboardPage />);
    const skillsHtml = renderToStaticMarkup(<DashboardPage />);
    const evidenceHtml = renderToStaticMarkup(<DashboardPage />);
    const connectorsHtml = renderToStaticMarkup(<DashboardPage />);
    const skillSourcesHtml = renderToStaticMarkup(<DashboardPage />);
    const companyAgentsHtml = renderToStaticMarkup(<DashboardPage />);

    expect(archivesHtml).toContain('archive panel body');
    expect(skillsHtml).toContain('skill lab panel body');
    expect(evidenceHtml).toContain('evidence panel body');
    expect(connectorsHtml).toContain('connectors panel body');
    expect(skillSourcesHtml).toContain('skill sources panel body');
    expect(companyAgentsHtml).toContain('company agents panel body');
  });

  it('keeps rendering the shell when center data is missing and shows the control-plane error card', () => {
    mockUseAdminDashboard.mockReturnValue(
      createDashboardOverrides({
        page: 'companyAgents',
        title: 'Company Agents',
        error: 'platform console offline',
        consoleData: {
          runtime: {
            activeTaskCount: 0,
            activeMinistries: [],
            usageAnalytics: {
              historyDays: 30
            },
            recentRuns: []
          },
          learning: { totalCandidates: 0, pendingCandidates: 0, candidates: [] },
          evals: { scenarioCount: 0, overallPassRate: 0, recentRuns: [], historyDays: 30 },
          skills: [],
          evidence: [],
          connectors: [],
          skillSources: { sources: [], manifests: [], installed: [], receipts: [] },
          companyAgents: [],
          rules: [],
          tasks: [],
          sessions: [],
          approvals: []
        }
      })
    );

    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('平台控制台加载失败');
    expect(html).toContain('platform console offline');
    expect(html).toContain('company agents panel body');
    expect(html).toContain('活跃任务');
    expect(html).toContain('待审批');
  });
});
