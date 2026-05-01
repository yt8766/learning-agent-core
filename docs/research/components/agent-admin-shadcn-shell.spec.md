# Agent Admin Shadcn Shell Specification

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin` shell visual refresh
最后核对：2026-04-30

## Overview

- Target files:
  - `apps/frontend/agent-admin/src/components/app-sidebar.tsx`
  - `apps/frontend/agent-admin/src/components/site-header.tsx`
  - `apps/frontend/agent-admin/src/pages/dashboard/dashboard-page.tsx`
  - `apps/frontend/agent-admin/src/components/section-cards.tsx`
- Screenshot: `docs/design-references/shadcn-admin/dashboard-reference-mobile.png`
- Interaction model: click-driven shell navigation and actions.

## DOM Structure

- `SidebarProvider`
  - `AppSidebar`
    - `SidebarHeader` with local `TeamSwitcher`
    - `SidebarContent` with data-driven `NavGroup` sections
    - nested profile sub-navigation under the profile item
    - `SidebarFooter` with local `NavUser`
    - `SidebarRail`
  - `SidebarInset`
    - `SiteHeader`
      - sidebar trigger and separator
      - primary governance-center navigation
      - search and action buttons
    - page title row with compact health/approval/mode status cards
    - summary cards
    - center panel body

## Computed Style Targets

### Shell

- Background: white / shadcn `--background`.
- Foreground: slate foreground / shadcn `--foreground`.
- Sidebar width: `16rem`.
- Border: `1px` `--border`.
- Radius: default shadcn radius (`0.625rem`) for buttons/tabs; `0.75rem` cards/panels.

### Header

- Height: `4rem`.
- Layout: horizontal flex, left sidebar trigger plus separator, center governance links, right search and icon actions.
- Search: follows `satnaing/shadcn-admin` `src/components/search.tsx` shape: outline button, left search icon, text `Search`, and a right `⌘K` keycap. The local version is visual-only until a project command menu is introduced.
- Actions: icon buttons for metrics snapshot, refresh, share, quick create.

### Cards

- Background: `--card`.
- Border: `--border`.
- Shadow: subtle shadcn shadow.
- Title value: compact bold numeric text.

## States & Behaviors

### Sidebar navigation

- Default state: collapsed icon rail, matching the shadcn-admin screenshot where labels and group headers are hidden.
- Trigger: click nav item.
- Behavior: calls existing `dashboard.setPage`.
- Active state: `bg-sidebar-accent text-sidebar-accent-foreground`.
- Shape: single-line `SidebarMenuButton` with icon, label, optional badge, and upstream-style collapsible chevron for nested items.

### Profile nested navigation

- Trigger: click chevron on profile item.
- State A: nested eval/archive/skills entries hidden, `aria-expanded=false`.
- State B: nested entries visible, `aria-expanded=true`.
- Transition: icon rotation only.

### Header actions

- Metrics snapshot: calls `handleRefreshMetricsSnapshots`.
- Refresh: calls `refreshAll`.
- Share: calls clipboard copy for `shareUrl`.
- Quick create: calls `handleQuickCreate`.

## Text Content

- Brand: `Agent Admin`.
- Sidebar caption: `治理控制台`.
- Groups: `General`, `Governance`.
- Search action text: `Search`.
- Header navigation: `运行中枢`, `审批中枢`, `学习中枢`, `证据中心`, `连接器与策略`, `技能工坊`.
- Dashboard compact status cards: `健康`, `审批`, `模式`.

## Responsive Behavior

- Desktop: sidebar is visible; header search and badges are visible at medium/large widths.
- Tablet: sidebar remains available through existing provider behavior; page title and compact status cards wrap.
- Mobile: cards stack; header keeps icon actions while search is hidden.
