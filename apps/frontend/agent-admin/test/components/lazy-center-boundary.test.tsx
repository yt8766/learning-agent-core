import { act } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { lazy } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';

import { LazyCenterBoundary } from '@/components/lazy-center-boundary';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => {
    buttonProps.latestOnClick = onClick;
    return <button type="button">{children}</button>;
  }
}));

const buttonProps = vi.hoisted(() => ({
  latestOnClick: undefined as (() => void) | undefined
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

const dashboardLoadingStateProps = vi.hoisted(() => ({
  latestMessage: undefined as string | undefined
}));

vi.mock('@/pages/dashboard/dashboard-loading-state', () => ({
  DashboardLoadingState: ({ message }: { message?: string }) => {
    dashboardLoadingStateProps.latestMessage = message;
    return <div>dashboard loading shell</div>;
  }
}));

let root: Root | undefined;
let container: HTMLElement | undefined;
let consoleError: MockInstance | undefined;

beforeAll(() => {
  installTinyDom();
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container = undefined;
  consoleError?.mockRestore();
  consoleError = undefined;
  buttonProps.latestOnClick = undefined;
});

async function renderBoundary(children: ReactNode, onRetry?: () => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <LazyCenterBoundary label="Runtime Center" onRetry={onRetry}>
        {children}
      </LazyCenterBoundary>
    );
  });
}

async function flushLazyWork() {
  await act(async () => {
    await Promise.resolve();
  });
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
    style: Record<string, string> = {};
    tagName: string;

    constructor(tagName: string, ownerDocument: TinyDocument) {
      super(1, tagName.toUpperCase(), ownerDocument);
      this.tagName = this.nodeName;
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
    nodeName = '#document';
    nodeType = 9;
    ownerDocument = this;

    constructor() {
      this.body = new TinyElement('body', this);
    }

    addEventListener() {}

    createComment(text: string) {
      return new TinyText(text, this);
    }

    createElement(tagName: string) {
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
}

describe('LazyCenterBoundary', () => {
  it('renders loading copy while a center chunk is pending', async () => {
    const Pending = lazy(() => new Promise<{ default: () => ReactElement }>(() => undefined));

    await renderBoundary(<Pending />);

    expect(dashboardLoadingStateProps.latestMessage).toBe('正在加载 Runtime Center...');
  });

  it('renders the center child after it resolves', async () => {
    const Loaded = lazy(() => Promise.resolve({ default: () => <div>Runtime center loaded</div> }));

    await renderBoundary(<Loaded />);
    await flushLazyWork();

    expect(container?.textContent).toContain('Runtime center loaded');
  });

  it('renders error copy when a center chunk fails', async () => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

    await renderBoundary(<Broken />);
    await flushLazyWork();

    expect(container?.textContent).toContain('Runtime Center 加载失败');
    expect(container?.textContent).toContain('重试');
  });

  it('calls onRetry when retry is clicked after a center chunk fails', async () => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRetry = vi.fn();
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

    await renderBoundary(<Broken />, onRetry);
    await flushLazyWork();

    await act(async () => {
      buttonProps.latestOnClick?.();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
