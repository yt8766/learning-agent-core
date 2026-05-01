import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '@/pages/dashboard/dashboard-page';

const mockUseAdminDashboard = vi.fn();

vi.mock('@/hooks/use-admin-dashboard', () => ({
  PAGE_TITLES: {
    runtime: '运行中枢',
    approvals: '审批中枢',
    learning: '学习中枢',
    memory: '记忆中枢',
    profiles: '画像中枢',
    evals: '评测基线',
    archives: '归档中心',
    skills: '技能工坊',
    evidence: '证据中心',
    connectors: '连接器与策略',
    skillSources: '技能来源治理',
    companyAgents: '公司专员编排'
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
vi.mock('../../../src/features/learning-center/memory-center-panel', () => ({
  MemoryCenterPanel: () => <div>memory center panel body</div>
}));
vi.mock('../../../src/features/learning-center/profile-center-panel', () => ({
  ProfileCenterPanel: () => <div>profile center panel body</div>
}));
vi.mock('../../../src/features/learning-center/memory-governance-panel', () => ({
  MemoryGovernancePanel: () => <div>memory governance panel body</div>
}));
vi.mock('../../../src/features/learning-center/memory-resolution-queue-card', () => ({
  MemoryResolutionQueueCard: () => <div>memory resolution queue body</div>
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
      title: '运行中枢',
      health: 'healthy 路 12:00',
      platformConsoleLogAnalysis: {
        sampleCount: 4,
        summary: {
          status: 'critical',
          reasons: ['slow p95 1280ms exceeds 1200ms budget', 'slow event count 1 exceeds 0 budget'],
          budgetsMs: {
            freshAggregateP95: 600,
            slowP95: 1200
          }
        },
        byEvent: {
          'runtime.platform_console.fresh_aggregate': {
            count: 3,
            totalDurationMs: {
              min: 320,
              max: 420,
              avg: 370,
              p50: 320,
              p95: 420
            },
            timingPercentilesMs: {
              runtime: { p50: 120, p95: 150, max: 150 }
            }
          },
          'runtime.platform_console.slow': {
            count: 1,
            totalDurationMs: {
              min: 1280,
              max: 1280,
              avg: 1280,
              p50: 1280,
              p95: 1280
            },
            timingPercentilesMs: {
              runtime: { p50: 480, p95: 480, max: 480 }
            }
          }
        },
        latestSamples: []
      },
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
        approvals: [],
        diagnostics: {
          cacheStatus: 'miss',
          generatedAt: '2026-04-01T09:00:00.000Z',
          timingsMs: {
            total: 84,
            runtime: 21,
            approvals: 4,
            evals: 17
          }
        }
      },
      bundle: null,
      activeTaskId: 'task_12345678',
      observatoryFocusTarget: undefined,
      runtimeCompareTaskId: undefined,
      runtimeGraphNodeId: undefined,
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
      setObservatoryFocusTarget: vi.fn(),
      setRuntimeCompareTaskId: vi.fn(),
      setRuntimeGraphNodeId: vi.fn(),
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
      handleRefreshMetricsSnapshots: vi.fn(),
      handleQuickCreate: vi.fn(),
      selectTask: vi.fn(),
      refreshPageCenter: vi.fn(),
      handleRetryTask: vi.fn(),
      handleLaunchWorkflowTask: vi.fn(),
      handleCreateDiagnosisTask: vi.fn(),
      downloadRuntimeExport: vi.fn(),
      downloadApprovalsExport: vi.fn(),
      downloadEvalsExport: vi.fn(),
      updateApproval: vi.fn(),
      handleInvalidateMemory: vi.fn(),
      handleSupersedeMemory: vi.fn(),
      handleRestoreMemory: vi.fn(),
      handleRetireMemory: vi.fn(),
      handleResolveMemoryResolutionCandidate: vi.fn(),
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

    expect(html).toContain('治理控制台');
    expect(html).toContain('运行中枢');
    expect(html).toContain('Agent Admin');
    expect(html).toContain('审批中枢');
    expect(html).toContain('General');
    expect(html).toContain('Governance');
    expect(html).toContain('data-slot="sidebar-header"');
    expect(html).toContain('data-slot="sidebar-content"');
    expect(html).toContain('data-slot="sidebar-footer"');
    expect(html).toContain('aria-keyshortcuts="Meta+K Control+K"');
    expect(html).toContain('>Search</span>');
    expect(html).toContain('data-admin-home-status="compact"');
    expect(html).toContain('系统健康');
    expect(html).toContain('待审批');
    expect(html).toContain('活跃任务');
    expect(html).toContain('控制台趋势');
    expect(html).toContain('严重 / 1 slow / P95 1280ms');
    expect(html).toContain('slow p95 1280ms exceeds 1200ms budget');
    expect(html).toContain('指标快照');
    expect(html).toContain('控制台 84ms');
    expect(html).toContain('缓存 未命中');
    expect(html).toContain('runtime panel body');
    expect(html).toContain('data-admin-shell="shadcn-admin-inspired"');
    expect(html).toContain('data-slot="navigation-progress"');
    expect(html).toContain('data-state="idle"');
    expect(html).not.toContain('data-admin-center-tabs="primary"');
  });

  it('shows the top navigation progress bar while a page center is refreshing', () => {
    mockUseAdminDashboard.mockReturnValue(
      createDashboardOverrides({
        activeRefreshTargets: [
          {
            scope: 'center',
            target: 'approvals',
            since: '2026-04-30T12:00:00.000Z'
          }
        ]
      })
    );

    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('data-slot="navigation-progress"');
    expect(html).toContain('data-state="active"');
    expect(html).toContain('aria-label="页面切换加载进度"');
  });

  it('renders page-specific center panels for approvals, learning, memory, profiles and evals', () => {
    mockUseAdminDashboard
      .mockReturnValueOnce(createDashboardOverrides({ page: 'approvals', title: '审批中枢' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'learning', title: '学习中枢' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'memory', title: '记忆中枢' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'profiles', title: '画像中枢' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'evals', title: '评测基线' }));

    const approvalsHtml = renderToStaticMarkup(<DashboardPage />);
    const learningHtml = renderToStaticMarkup(<DashboardPage />);
    const memoryHtml = renderToStaticMarkup(<DashboardPage />);
    const profilesHtml = renderToStaticMarkup(<DashboardPage />);
    const evalsHtml = renderToStaticMarkup(<DashboardPage />);

    expect(approvalsHtml).toContain('approvals panel body');
    expect(learningHtml).toContain('learning panel body');
    expect(memoryHtml).toContain('memory center panel body');
    expect(profilesHtml).toContain('profile center panel body');
    expect(evalsHtml).toContain('evals panel body');
  });

  it('renders archive, skill, evidence, connector, skill source and company agent centers', () => {
    mockUseAdminDashboard
      .mockReturnValueOnce(createDashboardOverrides({ page: 'archives', title: '归档中心' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'skills', title: '技能工坊' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'evidence', title: '证据中心' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'connectors', title: '连接器与策略' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'skillSources', title: '技能来源治理' }))
      .mockReturnValueOnce(createDashboardOverrides({ page: 'companyAgents', title: '公司专员编排' }));

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
        title: '公司专员编排',
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
