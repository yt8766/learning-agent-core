import { act } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => {
  const Container = ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  );
  const Text = ({ children }: { children?: ReactNode }) => <span>{children}</span>;
  const renderMenuItems = (items?: { children?: unknown; key?: string; label?: ReactNode }[]) =>
    items?.map(item => (
      <div key={item.key}>
        {item.label}
        {Array.isArray(item.children)
          ? renderMenuItems(item.children as { children?: unknown; key?: string; label?: ReactNode }[])
          : null}
      </div>
    ));

  function Form({ children }: { children?: ReactNode }) {
    return <form>{children}</form>;
  }
  Form.Item = Container;

  function Layout({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  Layout.Content = Container;
  Layout.Header = Container;
  Layout.Sider = Container;

  function Descriptions({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  Descriptions.Item = Container;

  function Input() {
    return <input />;
  }
  Input.Password = Input;

  const Typography = {
    Paragraph: Text,
    Text,
    Title: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>
  };

  return {
    Alert: ({ message }: { message?: ReactNode }) => <div>{message}</div>,
    App: Container,
    Avatar: Container,
    Button: Container,
    Card: Container,
    Checkbox: () => <input type="checkbox" />,
    Col: Container,
    ConfigProvider: Container,
    Descriptions,
    Divider: () => <hr />,
    Dropdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Empty: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
    Flex: Container,
    Form,
    Input,
    Layout,
    Menu: ({ items }: { items?: { children?: unknown; key?: string; label?: ReactNode }[] }) => (
      <nav>{renderMenuItems(items)}</nav>
    ),
    Modal: Container,
    Popconfirm: Container,
    Progress: ({ percent }: { percent?: number }) => <span>{percent}</span>,
    Row: Container,
    Select: Container,
    Space: Container,
    Spin: () => <span>loading</span>,
    Statistic: ({ title, value }: { title?: ReactNode; value?: ReactNode }) => (
      <span>
        {title}
        {value}
      </span>
    ),
    Switch: () => <button type="button" />,
    Table: () => <table />,
    Tag: Text,
    theme: {
      defaultAlgorithm: {},
      useToken: () => ({ hashId: '', theme: {}, token: {} })
    },
    Timeline: Container,
    Typography,
    Upload: Container
  };
});

vi.mock('@ant-design/icons', () =>
  Object.fromEntries(
    'ApartmentOutlined ApiOutlined AppstoreOutlined BookOutlined BranchesOutlined CameraOutlined CheckCircleOutlined CloudServerOutlined CloudSyncOutlined DatabaseOutlined DeleteOutlined DeploymentUnitOutlined ExperimentOutlined EyeInvisibleOutlined FileTextOutlined HddOutlined HomeOutlined InboxOutlined KeyOutlined LeftOutlined LockOutlined LogoutOutlined MessageOutlined MonitorOutlined MoreOutlined PlayCircleOutlined PlusOutlined QuestionCircleOutlined ReloadOutlined RightOutlined SafetyCertificateOutlined SafetyOutlined SaveOutlined SearchOutlined SendOutlined SettingOutlined ThunderboltOutlined UploadOutlined UserOutlined'
      .split(' ')
      .map(name => [name, () => null])
  )
);

vi.mock('@xyflow/react', () => ({
  Background: () => <div>background</div>,
  Controls: () => <div>controls</div>,
  Handle: () => <span />,
  MiniMap: () => <div>mini-map</div>,
  Position: { Bottom: 'bottom', Top: 'top' },
  ReactFlow: ({ children, nodes }: { children?: ReactNode; nodes: { id: string; data: { label: string } }[] }) => (
    <div>
      {nodes.map(node => (
        <button key={node.id} type="button">
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

import { App, KnowledgeRoutes, resolvePostLoginPath, resolveViewFromPath } from '../src/app/App';
import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { AuthProvider } from '../src/pages/auth/auth-provider';
import { installTinyDom } from './tiny-dom';
import { installLocalStorageMock } from './local-storage-mock';

let root: Root | undefined;
let container: HTMLElement | undefined;

describe('Knowledge App shell', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it('renders the login gate at the canonical login route when no tokens are stored', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).toContain('Knowledge');
    expect(html).toContain('登录');
    expect(html).toContain('账号');
    expect(html).not.toContain('dev@example.com');
    expect(html).not.toContain('secret');
  });

  it('keeps unauthenticated protected paths from rendering the authenticated workspace', () => {
    installLocalStorageMock();

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/knowledge-bases']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).not.toContain('知识库控制台');
    expect(html).not.toContain('知识库治理驾驶舱');
  });

  it('redirects authenticated login visits back to the workspace instead of the 404 route', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <KnowledgeRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(html).not.toContain('404');
    expect(html).not.toContain('抱歉，您访问的页面不存在。');
  });

  it('renders the authenticated workspace navigation when tokens exist', () => {
    installLocalStorageMock();
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');
    localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
    localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('ProUser');
    expect(html).toContain('Knowledge');
    expect(html).toContain('RAG Ops 控制台');
    expect(html).toContain('总览');
    expect(html).toContain('RAG 运行健康');
    expect(html).toContain('摄取管线');
    expect(html).toContain('检索实验室');
    expect(html).toContain('Trace 观测');
    expect(html).toContain('评测回归');
    expect(html).toContain('检索质量');
    expect(html).toContain('引用覆盖');
    expect(html).toContain('反馈闭环');
    expect(html).toContain('治理策略');
    expect(html).toContain('知识空间');
    expect(html).toContain('摄取管线');
    expect(html).toContain('检索实验室');
    expect(html).toContain('Trace 观测');
    expect(html).toContain('评测回归');
    expect(html).toContain('系统策略');
    expect(html).toContain('个人设置');
    expect(html).toContain('退出登录');
    expect(html).not.toContain('主题设置');
    expect(html).not.toContain('异常页');
    expect(html).not.toContain('exception403');
    expect(html).not.toContain('exception404');
    expect(html).not.toContain('exception500');
    expect(html).not.toContain('管理页');
    expect(html).not.toContain('基础表单');
    expect(html).not.toContain('Ant Design Pro Cheatsheet');
    expect(html).not.toContain('欢迎使用 Ant Design Pro V6');
    expect(html).not.toContain('github.com/ant-design/ant-design-pro');
    expect(html).not.toContain('data-menu-id="rc-menu-uuid-ai"');
    expect(html).not.toContain('data-menu-id="rc-menu-uuid-welcome"');
    expect(html).not.toContain('aria-label="源码"');
    expect(html).not.toContain('aria-label="语言"');
  });

  it('renders the authenticated evals route content', async () => {
    container = await renderAuthenticatedRoute('/evals');

    await waitForText('运行记录');
    expect(container.textContent).toContain('评测回归');
  });

  it('renders the authenticated agent flow route and resolves the lazy canvas chunk', async () => {
    container = await renderAuthenticatedRoute('/agent-flow');

    await waitForText('background');
    expect(container.textContent).toContain('Agent Flow');
    expect(container.textContent).toContain('Input');
    expect(container.textContent).toContain('Retrieve Knowledge');
  });

  it('does not map exception routes into a sidebar navigation item', () => {
    expect(resolveViewFromPath('/exception/403')).toBeUndefined();
    expect(resolveViewFromPath('/exception/404')).toBeUndefined();
    expect(resolveViewFromPath('/exception/500')).toBeUndefined();
    expect(resolveViewFromPath('/missing-page')).toBeUndefined();
  });

  it('resolves the post-login destination from protected route state', () => {
    expect(resolvePostLoginPath({ from: { pathname: '/knowledge-bases' } })).toBe('/knowledge-bases');
    expect(resolvePostLoginPath({ from: { pathname: '/login' } })).toBe('/');
    expect(resolvePostLoginPath(undefined)).toBe('/');
  });
});

function createFakeApi(): KnowledgeFrontendApi {
  const stub = vi.fn().mockResolvedValue({});
  return {
    getDashboardOverview: vi.fn().mockResolvedValue({ widgets: [], generatedAt: '' }),
    listKnowledgeBases: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listEmbeddingModels: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listDocuments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    uploadKnowledgeFile: stub,
    createDocumentFromUpload: stub,
    getDocument: stub,
    getLatestDocumentJob: stub,
    listDocumentChunks: stub,
    uploadDocument: stub,
    reprocessDocument: stub,
    deleteDocument: stub,
    listRagModelProfiles: vi.fn().mockResolvedValue({ items: [] }),
    listConversations: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listConversationMessages: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    chat: stub,
    streamChat: stub,
    createFeedback: stub,
    listEvalDatasets: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listEvalRuns: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    listEvalRunResults: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    compareEvalRuns: stub,
    getObservabilityMetrics: stub,
    listTraces: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    getTrace: stub,
    listWorkspaceUsers: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    getSettingsModelProviders: stub,
    getSettingsApiKeys: stub,
    getSettingsStorage: stub,
    getSettingsSecurity: stub,
    getChatAssistantConfig: vi.fn().mockResolvedValue({
      deepThinkEnabled: true,
      defaultKnowledgeBaseIds: [],
      modelProfileId: 'knowledge-rag',
      webSearchEnabled: false,
      quickPrompts: [],
      thinkingSteps: [],
      updatedAt: ''
    }),
    listAgentFlows: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'flow_default_rag',
          name: '默认 RAG 智能代理',
          description: '验证知识库智能代理流程',
          version: 1,
          status: 'active',
          nodes: [
            { id: 'input', type: 'input', label: 'Input', position: { x: 0, y: 80 }, config: {} },
            {
              id: 'knowledge_retrieve',
              type: 'knowledge_retrieve',
              label: 'Retrieve Knowledge',
              position: { x: 260, y: 80 },
              config: { topK: 5 }
            }
          ],
          edges: [{ id: 'edge_input_retrieve', source: 'input', target: 'knowledge_retrieve' }],
          createdAt: '2026-05-04T00:00:00.000Z',
          updatedAt: '2026-05-04T00:00:00.000Z'
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    }),
    saveAgentFlow: stub,
    updateAgentFlow: stub,
    runAgentFlow: stub
  } as unknown as KnowledgeFrontendApi;
}

async function renderAuthenticatedRoute(path: string) {
  installTinyBrowserDom();
  installLocalStorageMock();
  localStorage.setItem('knowledge_access_token', 'access');
  localStorage.setItem('knowledge_refresh_token', 'refresh');
  localStorage.setItem('knowledge_access_token_expires_at', String(Date.now() + 120_000));
  localStorage.setItem('knowledge_refresh_token_expires_at', String(Date.now() + 600_000));

  const routeContainer = document.createElement('div');
  document.body.appendChild(routeContainer);
  root = createRoot(routeContainer);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeApiProvider client={createFakeApi()}>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
              <KnowledgeRoutes />
            </MemoryRouter>
          </AuthProvider>
        </KnowledgeApiProvider>
      </QueryClientProvider>
    );
  });

  return routeContainer;
}

async function waitForText(text: string) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    await act(async () => {
      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    if (document.body.textContent.includes(text)) {
      return;
    }
  }
  throw new Error(`Expected text not found: ${text}`);
}

function installTinyBrowserDom() {
  installTinyDom();

  const head = document.createElement('head');
  document.body.appendChild(head);
  Object.assign(document, {
    createElementNS: (_namespaceURI: string | null, qualifiedName: string) => document.createElement(qualifiedName),
    head,
    querySelector: (selector: string) => (selector === 'head' ? head : null),
    querySelectorAll: () => []
  });
  Object.assign(globalThis.Node, {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  });
  vi.stubGlobal('SVGElement', globalThis.Element);
  vi.stubGlobal('ShadowRoot', class ShadowRoot {});
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: () => '',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible'
  }));
  globalThis.matchMedia = vi.fn().mockReturnValue({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: '',
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  });
}
