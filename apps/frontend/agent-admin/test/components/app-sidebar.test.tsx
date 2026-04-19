import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { DashboardPageKey, TaskRecord } from '@/types/admin';

function renderSidebar(options?: {
  page?: DashboardPageKey;
  defaultPlatformNestedExpanded?: boolean;
  tasks?: TaskRecord[];
}) {
  const { page = 'runtime', defaultPlatformNestedExpanded, tasks = [] } = options ?? {};

  return renderToStaticMarkup(
    <SidebarProvider>
      <AppSidebar
        page={page}
        health="healthy"
        loading={false}
        polling={false}
        pendingApprovals={2}
        tasks={tasks}
        activeTaskId={undefined}
        refreshDiagnostics={null}
        activeRefreshTargets={[]}
        defaultPlatformNestedExpanded={defaultPlatformNestedExpanded}
        onNavigate={vi.fn()}
        onRefresh={vi.fn()}
        onQuickCreate={vi.fn()}
        onSelectTask={vi.fn()}
      />
    </SidebarProvider>
  );
}

describe('AppSidebar', () => {
  it('only renders an expand control for the item that actually owns nested entries', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: false });

    expect(html).toContain('展开画像治理子导航');
    expect(html).not.toContain('展开学习治理子导航');
  });

  it('hides nested governance entries when the nested section starts collapsed', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: false });

    expect(html).not.toContain('评测基线');
    expect(html).not.toContain('归档中心');
    expect(html).not.toContain('技能工坊');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows nested governance entries when the nested section starts expanded', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: true });

    expect(html).toContain('评测基线');
    expect(html).toContain('归档中心');
    expect(html).toContain('技能工坊');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('收起画像治理子导航');
  });

  it('automatically expands nested governance entries when a nested page is active', () => {
    const html = renderSidebar({ page: 'evals' });

    expect(html).toContain('评测基线');
    expect(html).toContain('归档中心');
    expect(html).toContain('技能工坊');
    expect(html).toContain('aria-expanded="true"');
  });
});
