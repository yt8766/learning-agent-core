import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/admin-api', () => ({
  getWorkflowPresets: vi.fn().mockResolvedValue([]),
  isAbortedAdminRequestError: vi.fn(() => false)
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span className="badge" data-variant={variant ?? ''}>
      {children}
    </span>
  )
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, disabled }: any) => (
    <button type={type ?? 'button'} disabled={disabled}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className ?? ''}`}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={`card-content ${className ?? ''}`}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={`card-header ${className ?? ''}`}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={`card-title ${className ?? ''}`}>{children}</h3>
}));

vi.mock('@/pages/runtime-overview/components/runtime-workflow-execution-map-card', () => ({
  RuntimeWorkflowExecutionMapCard: () => <div>RuntimeWorkflowExecutionMapCard</div>
}));

vi.mock('@/pages/runtime-overview/components/runtime-workflow-catalog-support', () => ({
  buildWorkflowLaunchGoal: vi.fn(() => 'mocked-goal-preview')
}));

import { RuntimeWorkflowCatalogCard } from '@/pages/runtime-overview/components/runtime-workflow-catalog-card';

describe('RuntimeWorkflowCatalogCard', () => {
  it('renders card title and description', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('Workflow Catalog');
    expect(html).toContain('选择一个流程');
  });

  it('renders loading state initially', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('正在加载 workflow catalog');
  });

  it('renders empty workflow count badge initially', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('0');
  });

  it('renders the goal textarea', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('输入目标');
  });

  it('renders the launch preview area', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('Launch Preview');
    expect(html).toContain('选择流程并输入目标后');
  });

  it('renders the launch button', () => {
    const html = renderToStaticMarkup(<RuntimeWorkflowCatalogCard onLaunchWorkflowTask={vi.fn()} />);

    expect(html).toContain('启动流程');
  });
});
