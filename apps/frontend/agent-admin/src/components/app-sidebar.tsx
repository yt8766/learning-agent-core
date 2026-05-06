import * as React from 'react';
import { ChevronRight, ChevronsUpDown, Command } from 'lucide-react';
import type { AdminRole } from '@agent/core';

import { NAV_ITEMS, type AppSidebarNavItem } from '@/components/app-sidebar-nav-items';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { adminAuthStore } from '@/pages/auth/store/admin-auth-store';
import { cn } from '@/utils/utils';
import type { DashboardPageKey, TaskRecord } from '@/types/admin';

export interface AdminNavigationProps {
  page: DashboardPageKey;
  health: string;
  loading: boolean;
  polling: boolean;
  pendingApprovals: number;
  tasks: TaskRecord[];
  activeTaskId?: string;
  refreshDiagnostics?: {
    scope: 'all' | 'center' | 'task';
    target: string;
    reason: string;
    outcome: 'started' | 'deduped' | 'throttled' | 'aborted' | 'completed' | 'failed';
    at: string;
  } | null;
  activeRefreshTargets?: Array<{
    scope: 'all' | 'center' | 'task';
    target: string;
    since: string;
  }>;
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onQuickCreate: () => void;
  onSelectTask: (taskId: string) => void;
}

const PLATFORM_NESTED_PAGE_KEYS: DashboardPageKey[] = ['evals', 'archives', 'skills'];
const PLATFORM_NESTED_NAV_ID = 'admin-platform-nested-nav';
const DEVELOPER_ALLOWED_PAGES: DashboardPageKey[] = ['runtime', 'learning', 'skills', 'evidence'];

type SidebarNavLink = AppSidebarNavItem & {
  badge?: string;
  items?: AppSidebarNavItem[];
};

type SidebarNavGroup = {
  title: string;
  items: SidebarNavLink[];
};

function isPlatformNestedPage(page: DashboardPageKey) {
  return PLATFORM_NESTED_PAGE_KEYS.includes(page);
}

function buildSidebarData(pendingApprovals: number, roles: AdminRole[]): SidebarNavGroup[] {
  const canSeePage = (item: AppSidebarNavItem) =>
    roles.includes('super_admin') || DEVELOPER_ALLOWED_PAGES.includes(item.key);
  const filterItem = (item: SidebarNavLink): SidebarNavLink | null => {
    const items = item.items?.filter(canSeePage);
    if (items && items.length > 0) {
      return { ...item, items };
    }
    return canSeePage(item) ? item : null;
  };

  return [
    {
      title: 'General',
      items: [
        NAV_ITEMS[0],
        { ...NAV_ITEMS[1], badge: `${pendingApprovals}` },
        NAV_ITEMS[2],
        NAV_ITEMS[3],
        NAV_ITEMS[4],
        {
          ...NAV_ITEMS[5],
          items: NAV_ITEMS.slice(6, 9)
        }
      ]
        .map(filterItem)
        .filter((item): item is SidebarNavLink => Boolean(item))
    },
    {
      title: 'Governance',
      items: [NAV_ITEMS[9], NAV_ITEMS[10], NAV_ITEMS[11], NAV_ITEMS[12], NAV_ITEMS[13]]
        .map(filterItem)
        .filter((item): item is SidebarNavLink => Boolean(item))
    }
  ];
}

export function AppSidebar(
  props: AdminNavigationProps & {
    variant?: 'default' | 'inset';
    defaultPlatformNestedExpanded?: boolean;
    roles?: AdminRole[];
  }
) {
  const {
    page,
    polling,
    pendingApprovals,
    tasks,
    onNavigate,
    variant = 'inset',
    defaultPlatformNestedExpanded,
    roles = adminAuthStore.getSnapshot().account?.roles ?? ['super_admin']
  } = props;
  const [platformNestedExpanded, setPlatformNestedExpanded] = React.useState(
    () => defaultPlatformNestedExpanded ?? isPlatformNestedPage(page)
  );

  React.useEffect(() => {
    if (isPlatformNestedPage(page)) {
      setPlatformNestedExpanded(true);
    }
  }, [page]);

  return (
    <Sidebar variant={variant} className="sticky top-0 h-screen overflow-hidden">
      <SidebarHeader>
        <TeamSwitcher polling={polling} />
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Agent Admin navigation">
          {buildSidebarData(pendingApprovals, roles).map(group =>
            React.createElement(NavGroup, {
              key: group.title,
              group,
              page,
              platformNestedExpanded,
              onTogglePlatformNested: () => setPlatformNestedExpanded(current => !current),
              onNavigate
            })
          )}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <NavUser taskCount={tasks.length} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function TeamSwitcher({ polling }: { polling: boolean }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="h-12 px-2" title="Agent Admin">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Command className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]/sidebar-wrapper:hidden">
            <span className="truncate font-semibold">Agent Admin</span>
            <span className="truncate text-xs text-muted-foreground">治理控制台</span>
          </div>
          <Badge
            variant={polling ? 'secondary' : 'outline'}
            className="rounded-md px-1.5 text-[0.68rem] group-data-[collapsible=icon]/sidebar-wrapper:hidden"
          >
            {polling ? '轮询中' : '就绪'}
          </Badge>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]/sidebar-wrapper:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavGroup({
  group,
  page,
  platformNestedExpanded,
  onTogglePlatformNested,
  onNavigate
}: {
  group: SidebarNavGroup;
  page: DashboardPageKey;
  platformNestedExpanded: boolean;
  onTogglePlatformNested: () => void;
  onNavigate: (page: DashboardPageKey) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map(item =>
          item.items
            ? React.createElement(SidebarMenuCollapsible, {
                key: item.key,
                item,
                page,
                expanded: platformNestedExpanded,
                onToggle: onTogglePlatformNested,
                onNavigate
              })
            : React.createElement(SidebarMenuLink, {
                key: item.key,
                item,
                active: item.key === page,
                onNavigate
              })
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function SidebarMenuLink({
  item,
  active,
  onNavigate
}: {
  item: SidebarNavLink;
  active: boolean;
  onNavigate: (page: DashboardPageKey) => void;
}) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} title={item.description} onClick={() => onNavigate(item.key)}>
        <Icon className="size-4" />
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]/sidebar-wrapper:hidden">
          {item.label}
        </span>
        {item.badge ? <NavBadge>{item.badge}</NavBadge> : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarMenuCollapsible({
  item,
  page,
  expanded,
  onToggle,
  onNavigate
}: {
  item: SidebarNavLink;
  page: DashboardPageKey;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (page: DashboardPageKey) => void;
}) {
  const Icon = item.icon;
  const active = item.key === page || (item.items?.some(subItem => subItem.key === page) ?? false);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        title={item.description}
        aria-label={expanded ? '收起画像治理子导航' : '展开画像治理子导航'}
        aria-expanded={expanded}
        aria-controls={PLATFORM_NESTED_NAV_ID}
        onClick={onToggle}
      >
        <Icon className="size-4" />
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]/sidebar-wrapper:hidden">
          {item.label}
        </span>
        {item.badge ? <NavBadge>{item.badge}</NavBadge> : null}
        <ChevronRight
          className={cn(
            'ml-auto size-4 transition-transform duration-200 group-data-[collapsible=icon]/sidebar-wrapper:hidden',
            expanded ? 'rotate-90' : 'rotate-0'
          )}
        />
      </SidebarMenuButton>
      {expanded ? (
        <SidebarMenuSub id={PLATFORM_NESTED_NAV_ID}>
          {item.items?.map(subItem => (
            <SidebarMenuSubItem key={subItem.key}>
              <SidebarMenuSubButton isActive={subItem.key === page} onClick={() => onNavigate(subItem.key)}>
                <span className="truncate">{subItem.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

function NavBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="rounded-full px-1 py-0 text-xs group-data-[collapsible=icon]/sidebar-wrapper:hidden">
      {children}
    </Badge>
  );
}

function NavUser({ taskCount }: { taskCount: number }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton className="h-12 px-2" title="当前值守">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            SN
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]/sidebar-wrapper:hidden">
            <span className="truncate font-semibold">当前值守</span>
            <span className="truncate text-xs text-muted-foreground">{taskCount} 个近期运行</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]/sidebar-wrapper:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
