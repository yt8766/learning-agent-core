# shadcn-admin Page Topology

状态：current
文档类型：note
适用范围：`apps/frontend/agent-admin` visual reference
最后核对：2026-04-30

Source: https://shadcn-admin.netlify.app/

## Reference Topology

1. App shell
   - Left sidebar on desktop.
   - Header toolbar with sidebar trigger, menu/search, icon controls, and avatar.
   - Main content inset.

2. Dashboard heading
   - Page title: `Dashboard`.
   - Right-aligned primary action.
   - Segmented tabs: `Overview`, `Analytics`, `Reports`, `Notifications`.

3. KPI cards
   - Four compact cards in a responsive grid.
   - Each card has title, value, supporting copy, and a small icon.

4. Analytics/content panels
   - Larger bordered cards for overview chart and recent activity.
   - Dense table/list styling rather than editorial sections.

## Local agent-admin Mapping

1. App shell
   - `AppSidebar` keeps project centers and workflow lab entries.
   - `SiteHeader` adopts the toolbar/search/icon-action composition.

2. Governance heading
   - `DashboardPage` renders the current center title from `PAGE_TITLES`.
   - Primary center tabs map to runtime, approvals, learning, evidence, connectors, and skills.

3. Summary cards
   - `SectionCards` keeps project metrics: health, approvals, active tasks, recent runs, console trend.
   - Visual style now follows the reference card density.

4. Center body
   - Existing project panels remain the source of truth for functionality.
   - The body is framed as a bordered shadcn panel instead of a warm floating surface.
