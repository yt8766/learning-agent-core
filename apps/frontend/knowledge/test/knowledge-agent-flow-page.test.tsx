import React, { type ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { AgentFlowPage } from '../src/pages/agent-flow/agent-flow-page';
import type { AgentFlowRecord } from '../src/types/api';

vi.mock('antd', () => ({
  Alert: ({ message }: { message?: ReactNode }) => <div role="alert">{message}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  Empty: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
  Select: ({
    onChange,
    options,
    value
  }: {
    onChange?: (value: string) => void;
    options?: { label: ReactNode; value: string }[];
    value?: string;
  }) => (
    <select onChange={event => onChange?.(event.currentTarget.value)} value={value}>
      {options?.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Spin: () => <span>loading</span>,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>
  }
}));

vi.mock('@ant-design/icons', () =>
  Object.fromEntries(
    'ApartmentOutlined ApiOutlined BranchesOutlined CheckCircleOutlined CloudSyncOutlined DatabaseOutlined PlayCircleOutlined SaveOutlined SendOutlined ThunderboltOutlined'
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
  ReactFlow: ({
    children,
    nodes,
    onNodeClick
  }: {
    children?: ReactNode;
    nodes: { id: string; data: { label: string } }[];
    onNodeClick?: (event: unknown, node: { id: string }) => void;
  }) => (
    <div>
      {nodes.map(node => (
        <button key={node.id} onClick={() => onNodeClick?.({}, node)} type="button">
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

const defaultFlow: AgentFlowRecord = {
  id: 'flow_default_rag',
  name: '默认 RAG 智能代理',
  description: '验证知识库智能代理流程',
  version: 1,
  status: 'active',
  nodes: [
    {
      id: 'input',
      type: 'input',
      label: '用户输入',
      position: { x: 0, y: 80 },
      config: {}
    },
    {
      id: 'knowledge_retrieve',
      type: 'knowledge_retrieve',
      label: '知识检索',
      position: { x: 260, y: 80 },
      config: { topK: 5 }
    }
  ],
  edges: [{ id: 'edge_input_retrieve', source: 'input', target: 'knowledge_retrieve' }],
  createdAt: '2026-05-04T00:00:00.000Z',
  updatedAt: '2026-05-04T00:00:00.000Z'
};

let mountedRoot: Root | undefined;

beforeAll(() => {
  installTinyDom();
});

afterEach(async () => {
  if (mountedRoot) {
    await act(async () => {
      mountedRoot?.unmount();
    });
    mountedRoot = undefined;
  }
});

describe('Knowledge agent flow page', () => {
  it('loads the default flow and runs it with the canonical test message', async () => {
    const runAgentFlow = vi.fn<KnowledgeFrontendApi['runAgentFlow']>().mockResolvedValue({
      runId: 'run_1',
      flowId: 'flow_default_rag',
      status: 'completed',
      output: {},
      createdAt: '2026-05-04T00:00:01.000Z',
      updatedAt: '2026-05-04T00:00:01.000Z'
    });
    const container = await renderClient(
      <KnowledgeApiProvider client={createApi({ runAgentFlow })}>
        <AgentFlowPage />
      </KnowledgeApiProvider>
    );

    await flushEffects();

    expect(container.textContent).toContain('智能代理');
    expect(container.textContent).toContain('用户输入');
    expect(container.textContent).toContain('知识检索');

    await act(async () => {
      clickButtonByText(container, '运行流程');
    });
    await flushEffects();

    expect(runAgentFlow).toHaveBeenCalledWith('flow_default_rag', {
      flowId: 'flow_default_rag',
      input: { knowledgeBaseIds: [], message: '验证知识库智能代理流程', variables: {} }
    });
    expect(container.textContent).toContain('run_1');
  });
});

function createApi(overrides: Partial<KnowledgeFrontendApi> = {}): KnowledgeFrontendApi {
  const stub = vi.fn().mockResolvedValue({});
  const api: KnowledgeFrontendApi = {
    getDashboardOverview: stub,
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
    getChatAssistantConfig: stub,
    listAgentFlows: vi.fn<KnowledgeFrontendApi['listAgentFlows']>().mockResolvedValue({
      items: [defaultFlow],
      page: 1,
      pageSize: 20,
      total: 1
    }),
    runAgentFlow: vi.fn<KnowledgeFrontendApi['runAgentFlow']>(),
    saveAgentFlow: vi
      .fn<KnowledgeFrontendApi['saveAgentFlow']>()
      .mockImplementation(input => Promise.resolve({ flow: input.flow })),
    updateAgentFlow: vi
      .fn<KnowledgeFrontendApi['updateAgentFlow']>()
      .mockImplementation((flowId, input) => Promise.resolve({ flow: { ...input.flow, id: flowId } }))
  } as unknown as KnowledgeFrontendApi;
  return Object.assign(api, overrides);
}

async function renderClient(element: React.ReactNode) {
  const container = document.createElement('div') as unknown as TinyElement;
  document.body.appendChild(container);
  mountedRoot = createRoot(container);
  await act(async () => {
    mountedRoot?.render(element);
  });
  return container;
}

function flushEffects() {
  return act(async () => {
    await Promise.resolve();
  });
}

function clickButtonByText(root: TinyElement, text: string) {
  const button = findElement(root, node => node.tagName === 'BUTTON' && node.textContent.includes(text));
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  button.click();
}

function findElement(root: TinyElement, predicate: (node: TinyElement) => boolean): TinyElement | undefined {
  if (predicate(root)) {
    return root;
  }
  for (const child of root.childNodes) {
    if (isTinyElement(child)) {
      const found = findElement(child, predicate);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function isTinyElement(node: unknown): node is TinyElement {
  return typeof node === 'object' && node !== null && 'tagName' in node;
}

function installTinyDom() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  class TinyEvent {
    bubbles: boolean;
    currentTarget?: TinyNode;
    target?: TinyNode;
    type: string;

    constructor(type: string, init: { bubbles?: boolean } = {}) {
      this.bubbles = init.bubbles ?? true;
      this.type = type;
    }
  }

  class TinyNode {
    childNodes: TinyNode[] = [];
    nodeName: string;
    nodeType: number;
    ownerDocument: TinyDocument;
    parentNode: TinyNode | null = null;
    private listeners = new Map<string, ((event: TinyEvent) => void)[]>();
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

    addEventListener(type: string, listener: (event: TinyEvent) => void) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: (event: TinyEvent) => void) {
      const listeners = this.listeners.get(type) ?? [];
      this.listeners.set(
        type,
        listeners.filter(item => item !== listener)
      );
    }

    dispatchEvent(event: TinyEvent) {
      event.target ??= this;
      event.currentTarget = this;
      for (const listener of this.listeners.get(event.type) ?? []) {
        listener(event);
      }
      if (event.bubbles && this.parentNode) {
        this.parentNode.dispatchEvent(event);
      }
      return true;
    }

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
    style: Record<string, string> = {};
    tagName: string;

    constructor(tagName: string, ownerDocument: TinyDocument) {
      super(1, tagName.toUpperCase(), ownerDocument);
      this.tagName = this.nodeName;
    }

    click() {
      this.dispatchEvent(new TinyEvent('click'));
    }

    get value() {
      return this.attributes.value ?? '';
    }

    set value(nextValue: string) {
      this.attributes.value = nextValue;
    }

    get options() {
      return this.childNodes.filter(
        (child): child is TinyElement => child instanceof TinyElement && child.tagName === 'OPTION'
      );
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

  class TinyDocument extends TinyNode {
    body: TinyElement;
    defaultView = globalThis;
    documentElement: TinyElement;

    constructor() {
      super(9, '#document', undefined as unknown as TinyDocument);
      this.ownerDocument = this;
      this.body = new TinyElement('body', this);
      this.documentElement = new TinyElement('html', this);
    }

    createComment(text: string) {
      return new TinyText(text, this);
    }

    createElement(tagName: string) {
      return new TinyElement(tagName, this);
    }

    createTextNode(text: string) {
      return new TinyText(text, this);
    }
  }

  const document = new TinyDocument();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Event', TinyEvent);
  vi.stubGlobal('Node', TinyNode);
  vi.stubGlobal('Element', TinyElement);
  vi.stubGlobal('HTMLElement', TinyElement);
  vi.stubGlobal('HTMLIFrameElement', class HTMLIFrameElement {});
}

type TinyElement = InstanceType<typeof Element> & { childNodes: TinyElement[]; click: () => void; tagName: string };
