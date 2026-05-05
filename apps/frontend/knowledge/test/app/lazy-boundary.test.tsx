import { act } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { lazy } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';

import { KnowledgeLazyBoundary } from '@/app/lazy-boundary';

import { installTinyDom } from '../tiny-dom';

vi.mock('antd', () => ({
  Alert: ({ action, message }: { action?: ReactNode; message?: ReactNode }) => (
    <div role="alert">
      {message}
      {action}
    </div>
  ),
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
  Spin: ({ tip }: { tip?: ReactNode }) => <span>{tip}</span>
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
});

async function renderBoundary(children: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<KnowledgeLazyBoundary label="知识库页面">{children}</KnowledgeLazyBoundary>);
  });
}

async function flushLazyWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('KnowledgeLazyBoundary', () => {
  it('renders a loading state while the lazy module is pending', async () => {
    const Pending = lazy(() => new Promise<{ default: () => ReactElement }>(() => undefined));

    await renderBoundary(<Pending />);

    expect(container?.textContent).toContain('正在加载知识库页面...');
  });

  it('renders the lazy child after it resolves', async () => {
    const Loaded = lazy(() => Promise.resolve({ default: () => <div>Loaded route</div> }));

    await renderBoundary(<Loaded />);
    await flushLazyWork();

    expect(container?.textContent).toContain('Loaded route');
  });

  it('renders retry UI after a lazy module fails', async () => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

    await renderBoundary(<Broken />);
    await flushLazyWork();

    expect(container?.textContent).toContain('知识库页面加载失败');
    expect(container?.textContent).toContain('重试');
  });
});
