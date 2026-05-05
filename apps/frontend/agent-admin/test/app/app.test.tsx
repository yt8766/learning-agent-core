import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DashboardPageKey } from '@/types/admin';

const { mockUseAdminDashboard } = vi.hoisted(() => ({
  mockUseAdminDashboard: vi.fn()
}));

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
    companyAgents: '公司专员编排',
    workspace: '工作区治理',
    knowledgeGovernance: '知识治理',
    workflowLab: '流程实验室'
  },
  useAdminDashboard: () => mockUseAdminDashboard()
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <nav>Agent Admin</nav>
}));

vi.mock('@/components/navigation-progress', () => ({
  NavigationProgress: ({ active }: { active: boolean }) => (
    <div data-slot="navigation-progress" data-state={active ? 'active' : 'idle'} />
  )
}));

vi.mock('@/components/section-cards', () => ({
  SectionCards: () => <section>section cards</section>
}));

vi.mock('@/components/site-header', () => ({
  SiteHeader: ({ title }: { title: string }) => <header>{title}</header>
}));

vi.mock('recharts', () => {
  const Chart = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Primitive = () => <span />;
  return {
    Area: Primitive,
    AreaChart: Chart,
    Bar: Primitive,
    BarChart: Chart,
    CartesianGrid: Primitive,
    Cell: Primitive,
    Legend: Primitive,
    Line: Primitive,
    LineChart: Chart,
    Pie: Chart,
    PieChart: Chart,
    ResponsiveContainer: Chart,
    Tooltip: Primitive,
    XAxis: Primitive,
    YAxis: Primitive
  };
});

let root: Root | undefined;
let container: HTMLElement | undefined;

function renderAppAt(pathname: string, hash = '') {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { hash, origin: 'http://localhost', pathname, reload: vi.fn(), search: '' }
  });
  return renderRouterAt(pathname);
}

async function renderRouterAt(pathname: string) {
  mockUseAdminDashboard.mockReturnValue(createDashboardState(pageFromPath(pathname)));
  const { adminRoutes } = await import('@/app/admin-routes');
  function TestAdminRoutes() {
    return useRoutes(adminRoutes);
  }
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <TestAdminRoutes />
    </MemoryRouter>
  );
}

async function renderRouterClientAt(pathname: string) {
  installTinyDom();
  mockUseAdminDashboard.mockReturnValue(createDashboardState(pageFromPath(pathname)));
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { hash: '', origin: 'http://localhost', pathname, reload: vi.fn(), search: '' }
  });
  const { adminRoutes } = await import('@/app/admin-routes');
  function TestAdminRoutes() {
    return useRoutes(adminRoutes);
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[pathname]}>
        <TestAdminRoutes />
      </MemoryRouter>
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return container;
}

async function waitForText(expected: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    if (container?.textContent.includes(expected)) {
      return;
    }
  }
}

async function authenticateAdmin() {
  const { adminAuthStore } = await import('@/pages/auth/store/admin-auth-store');
  adminAuthStore.setAuthenticated(
    {
      id: 'admin_001',
      username: 'admin',
      displayName: '平台管理员',
      roles: ['super_admin'],
      status: 'enabled'
    },
    {
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-04-30T12:15:00.000Z',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
    },
    { persist: false }
  );
}

function pageFromPath(pathname: string): DashboardPageKey {
  const rawPage = pathname.replace(/^\//, '') || 'runtime';
  const pages: DashboardPageKey[] = [
    'runtime',
    'approvals',
    'learning',
    'memory',
    'profiles',
    'evals',
    'archives',
    'skills',
    'evidence',
    'connectors',
    'skillSources',
    'companyAgents',
    'workspace',
    'knowledgeGovernance',
    'workflowLab'
  ];
  return pages.includes(rawPage as DashboardPageKey) ? (rawPage as DashboardPageKey) : 'runtime';
}

function createDashboardState(page: DashboardPageKey) {
  return {
    page,
    health: 'healthy 路 12:00',
    platformConsoleLogAnalysis: null,
    consoleData: {
      runtime: {
        activeTaskCount: 1,
        activeMinistries: ['gongbu-code'],
        usageAnalytics: {
          daily: [],
          models: [],
          historyDays: 30,
          providerBillingDailyHistory: [],
          recentUsageAudit: []
        },
        recentRuns: []
      },
      learning: { totalCandidates: 0, pendingCandidates: 0, memoryResolutionCandidates: [], candidates: [] },
      evals: {
        scenarioCount: 1,
        runCount: 1,
        overallPassRate: 100,
        scenarios: [
          {
            scenarioId: 'retrieval-baseline',
            label: '检索基准',
            description: '验证治理中心能看到 benchmark 场景。',
            matchedRunCount: 1,
            passCount: 1,
            failCount: 0,
            passRate: 100
          }
        ],
        recentRuns: [
          {
            taskId: 'task_eval_001',
            scenarioIds: ['retrieval-baseline'],
            success: true,
            createdAt: '2026-05-05T10:00:00.000Z'
          }
        ],
        dailyTrend: [{ day: '2026-05-05', runCount: 1, passCount: 1, passRate: 100 }],
        scenarioTrends: [],
        historyDays: 30,
        promptRegression: {
          configPath: 'evals/prompts.yml',
          promptCount: 1,
          promptSuiteCount: 1,
          testCount: 1,
          providerCount: 1,
          suites: [
            {
              suiteId: 'core-suite',
              label: '核心套件',
              promptIds: ['prompt-1'],
              versions: ['v1'],
              promptCount: 1
            }
          ]
        }
      },
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
        generatedAt: '2026-05-05T10:00:00.000Z',
        timingsMs: { total: 12, runtime: 4, approvals: 2, evals: 3 }
      }
    },
    bundle: null,
    activeTaskId: undefined,
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
    handleDisableCompanyAgent: vi.fn()
  };
}

function installTinyDom() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  class TinyNode {
    childNodes: TinyNode[] = [];
    nodeType: number;
    nodeName: string;
    ownerDocument: TinyDocument;
    parentNode: TinyNode | null = null;
    private text = '';

    constructor(nodeType: number, nodeName: string, ownerDocument: TinyDocument) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.ownerDocument = ownerDocument;
    }

    appendChild(node: TinyNode) {
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }

    insertBefore(node: TinyNode, before: TinyNode | null) {
      const index = before ? this.childNodes.indexOf(before) : -1;
      if (index === -1) {
        return this.appendChild(node);
      }
      this.childNodes.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }

    removeChild(node: TinyNode) {
      this.childNodes = this.childNodes.filter(child => child !== node);
      node.parentNode = null;
      return node;
    }

    addEventListener() {}

    removeEventListener() {}

    get textContent() {
      return this.text || this.childNodes.map(node => node.textContent).join('');
    }

    set textContent(value: string) {
      this.text = value;
      this.childNodes = [];
    }
  }

  class TinyElement extends TinyNode {
    attributes: Record<string, string> = {};
    multiple = false;
    selected = false;
    style = {
      removeProperty: (name: string) => {
        delete this.attributes[`style:${name}`];
      },
      setProperty: (name: string, value: string) => {
        this.attributes[`style:${name}`] = value;
      }
    };
    tagName: string;

    constructor(tagName: string, ownerDocument: TinyDocument) {
      super(1, tagName.toUpperCase(), ownerDocument);
      this.tagName = this.nodeName;
    }

    get options() {
      return this.childNodes;
    }

    get value() {
      return this.attributes.value ?? '';
    }

    set value(value: string) {
      this.attributes.value = value;
    }

    removeAttribute(name: string) {
      delete this.attributes[name];
    }

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }

  class TinyText extends TinyNode {
    constructor(text: string, ownerDocument: TinyDocument) {
      super(3, '#text', ownerDocument);
      this.textContent = text;
    }
  }

  class TinyDocument {
    body: TinyElement;
    defaultView = globalThis;
    documentElement: TinyElement;
    nodeName = '#document';
    nodeType = 9;
    ownerDocument = this;

    constructor() {
      this.body = new TinyElement('body', this);
      this.documentElement = new TinyElement('html', this);
    }

    addEventListener() {}

    createComment(text: string) {
      return new TinyText(text, this);
    }

    createElement(tagName: string) {
      return new TinyElement(tagName, this);
    }

    createElementNS(_namespace: string, tagName: string) {
      return new TinyElement(tagName, this);
    }

    createTextNode(text: string) {
      return new TinyText(text, this);
    }

    removeEventListener() {}
  }

  const document = new TinyDocument();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Node', TinyNode);
  vi.stubGlobal('Element', TinyElement);
  vi.stubGlobal('HTMLElement', TinyElement);
  vi.stubGlobal('HTMLIFrameElement', class HTMLIFrameElement {});
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });
}

describe('agent-admin app shell', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
    mockUseAdminDashboard.mockReset();
    const { adminAuthStore } = await import('@/pages/auth/store/admin-auth-store');
    adminAuthStore.clear('anonymous');
  });

  it('renders the branded Chinese admin login page only on /login before authentication', async () => {
    const html = await renderAppAt('/login');

    expect(html).toContain('Agent 管理台');
    expect(html).toContain('Agent 管理台标识');
    expect(html).toContain('登入');
    expect(html).toContain('请在下方输入您的账号和密码登录后台。');
    expect(html).toContain('账号');
    expect(html).toContain('请输入账号');
    expect(html).toContain('密码');
    expect(html).toContain('显示密码');
    expect(html).toContain('点击登录，即表示您同意我们的');
    expect(html).toContain('服务条款');
    expect(html).toContain('隐私政策');
    expect(html).not.toContain('登录管理后台');
    expect(html).not.toContain('Shadcn 管理员');
    expect(html).not.toContain('电子邮件');
    expect(html).not.toContain('GitHub');
    expect(html).not.toContain('Facebook');
    expect(html).not.toContain('立即注册');
    expect(html).toContain('min-h-screen');
  });

  it('normalizes /login URLs that still carry legacy dashboard hashes before rendering login', async () => {
    const html = await renderAppAt('/login', '#/learning');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('redirects protected admin routes to /login before authentication without rendering 401', async () => {
    const html = await renderAppAt('/');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('401');
    expect(html).not.toContain('Unauthorized Access');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('normalizes authenticated /login hash URLs back to the dashboard root', async () => {
    await authenticateAdmin();
    const html = await renderAppAt('/login', '#/learning');

    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('Agent 管理台标识');
    expect(html).not.toContain('dashboard-page-body');
  });

  it('renders authenticated dashboard center paths without hash routing', async () => {
    await authenticateAdmin();
    const html = await renderAppAt('/learning');

    expect(html).toContain('学习中枢');
    expect(html).not.toContain('404');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('declares protected admin center paths through React Router route objects', async () => {
    await authenticateAdmin();
    const html = await renderRouterAt('/approvals');

    expect(html).toContain('审批中枢');
    expect(html).not.toContain('404');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the authenticated evals center route content', async () => {
    await authenticateAdmin();
    const routeContainer = await renderRouterClientAt('/evals');

    expect(routeContainer.textContent).toContain('评测基线');
    await waitForText('当前 benchmark scenarios 总数');
    expect(routeContainer.textContent).toContain('当前 benchmark scenarios 总数');
    expect(routeContainer.textContent).not.toContain('404');
    expect(routeContainer.textContent).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 401 error page on /401', async () => {
    const html = await renderAppAt('/401');

    expect(html).toContain('401');
    expect(html).toContain('Unauthorized Access');
    expect(html).toContain('Please log in with the appropriate credentials');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 403 error page on /403', async () => {
    const html = await renderAppAt('/403');

    expect(html).toContain('403');
    expect(html).toContain('Access Forbidden');
    expect(html).toContain('You don&#x27;t have necessary permission');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 404 error page for unknown routes', async () => {
    const html = await renderAppAt('/missing-admin-route');

    expect(html).toContain('404');
    expect(html).toContain('Oops! Page Not Found!');
    expect(html).toContain('It seems like the page you&#x27;re looking for');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 500 error page on /500', async () => {
    const html = await renderAppAt('/500');

    expect(html).toContain('500');
    expect(html).toContain('Oops! Something went wrong :&#x27;)');
    expect(html).toContain('We apologize for the inconvenience.');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Home');
    expect(html).not.toContain('Agent 管理台标识');
  });

  it('renders the shadcn-admin style 503 maintenance page on /503', async () => {
    const html = await renderAppAt('/503');

    expect(html).toContain('503');
    expect(html).toContain('Website is under maintenance!');
    expect(html).toContain('The site is not available at the moment.');
    expect(html).toContain('Learn more');
    expect(html).not.toContain('Back to Home');
  });
});
