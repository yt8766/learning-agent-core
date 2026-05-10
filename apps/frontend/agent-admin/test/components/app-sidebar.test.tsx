import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { DashboardPageKey, TaskRecord } from '@/types/admin';

function renderSidebar(options?: {
  page?: DashboardPageKey;
  defaultPlatformNestedExpanded?: boolean;
  tasks?: TaskRecord[];
  roles?: ['super_admin'] | ['developer'];
}) {
  const { page = 'runtime', defaultPlatformNestedExpanded, tasks = [], roles } = options ?? {};

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
        roles={roles}
        onNavigate={vi.fn()}
        onRefresh={vi.fn()}
        onQuickCreate={vi.fn()}
        onSelectTask={vi.fn()}
      />
    </SidebarProvider>
  );
}

describe('AppSidebar', () => {
  it('starts expanded after refresh so center labels remain visible', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: false });

    expect(html).toContain('data-collapsible="expanded"');
    expect(html).toContain('group-data-[collapsible=icon]/sidebar-wrapper:hidden');
    expect(html).toContain('group-data-[collapsible=icon]/sidebar-wrapper:size-12');
  });

  it('labels the navigation group as governance centers plus dedicated entries', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: false });

    expect(html).toContain('General');
    expect(html).toContain('Governance');
    expect(html).toContain('data-slot="sidebar-group"');
    expect(html).toContain('data-slot="sidebar-menu-button"');
    expect(html).not.toContain('六部治理台');
    expect(html).not.toContain('健康</p>');
    expect(html).not.toContain('模式</p>');
  });

  it('renders a workspace navigation entry for the agent workspace center', () => {
    const html = renderSidebar({ defaultPlatformNestedExpanded: false });

    expect(html).toContain('Agent Workspace');
    expect(html).toContain('工作区');
  });

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

  it('keeps the full admin navigation visible for developer accounts', () => {
    const html = renderSidebar({ roles: ['developer'], defaultPlatformNestedExpanded: true });

    expect(html).toContain('运行中枢');
    expect(html).toContain('审批中枢');
    expect(html).toContain('学习中枢');
    expect(html).toContain('Agent Workspace');
    expect(html).toContain('记忆中枢');
    expect(html).toContain('画像中枢');
    expect(html).toContain('评测基线');
    expect(html).toContain('归档中心');
    expect(html).toContain('技能工坊');
    expect(html).toContain('证据中心');
    expect(html).toContain('连接器与策略');
    expect(html).toContain('技能来源');
    expect(html).toContain('公司专员');
    expect(html).toContain('知识治理');
    expect(html).toContain('工作流实验室');
  });
});
