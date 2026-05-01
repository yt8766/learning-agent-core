# agent-admin shadcn-admin Visual Refresh

状态：current
文档类型：note
适用范围：`apps/frontend/agent-admin`
最后核对：2026-04-30

Updated on 2026-04-30.

## Current Implementation

`agent-admin` now uses https://shadcn-admin.netlify.app/ as a visual reference for its shell while keeping project-specific governance functionality.
Component-level checks also reference https://github.com/satnaing/shadcn-admin/tree/main, especially `src/components/layout/*`, `src/components/search.tsx`, and `src/components/ui/sidebar.tsx`.

The refresh is intentionally a style and shell-composition pass, not a product clone:

- Sidebar navigation still represents runtime, approvals, learning, workspace, memory, profile, evals, archives, skills, evidence, connectors, skill sources, company agents, and workflow lab.
- Sidebar composition now mirrors upstream `src/components/layout/app-sidebar.tsx`: `SidebarHeader` hosts a local `TeamSwitcher`, `SidebarContent` renders data-driven `NavGroup` sections, `SidebarFooter` hosts a local `NavUser`, and `SidebarRail` is present.
- Sidebar now starts expanded after refresh so governance-center labels remain visible. Users can still collapse it manually with the rail or header trigger.
- Sidebar groups intentionally use upstream-style `General` / `Governance` labels while each item still maps to this project's governance centers.
- Sidebar brand no longer owns the health/approval/mode status tiles. Those compact status tiles live in the dashboard title row so the home surface carries the operational snapshot.
- Header navigation now carries the primary governance-center links. The old content-area primary tabs are intentionally removed to match the shadcn-admin shell hierarchy.
- Header actions still call the existing admin hooks for metric snapshots, refresh, share link copy, and quick create.
- Header search mirrors the upstream `Search` component as an outline button with `⌘K` keycap, but it does not open a command palette yet because `agent-admin` has no command-menu provider in this pass.
- Main cards still show project health, approvals, tasks, runs, and console trend.
- Center panels still come from `renderDashboardCenter` and existing feature modules.
- `/login` is the only unauthenticated route that renders the branded Chinese admin login card. Protected admin entry points must not reuse the login surface as an error state.
- `/401`, `/403`, `/404`, `/500`, and `/503` render the dedicated `src/features/errors/admin-error-page.tsx` surface inspired by upstream `src/features/errors/*`: a full-screen centered status code, short title, muted description, and the upstream-style action set (`Go Back` / `Back to Home`, or `Learn more` for maintenance).
- `/401` is an explicit error-state route, not the normal unauthenticated entry state. Unauthenticated protected entry points redirect toward `/login`; unknown paths resolve to the 404 surface.
- Dashboard center navigation uses path routes, not hash routes. `/learning`, `/runtime`, and `/approvals` are canonical; `/login#/learning` is invalid and is normalized to `/login` for anonymous sessions or `/learning` for authenticated sessions.

## Design Rules

- Prefer white shadcn surfaces, slate foreground, muted slate text, light borders, and compact rounded-md controls.
- Avoid reintroducing the previous warm beige console palette for the main shell.
- Keep cards as bordered white metric cards rather than large warm floating cards.
- Use icon buttons for toolbar actions when an icon exists.
- Keep primary governance-center navigation in the header. Do not reintroduce duplicate large tabs inside the content title row.
- Keep login and error surfaces visually separate. Login owns the Agent 管理台 card treatment; error pages own the sparse shadcn-admin status-code treatment.
- Treat status pages by their operational meaning: 401 for authentication errors, 403 for permission denial, 404 for missing pages, and 500/503 for server-side failures or maintenance.

## Reference Artifacts

- Behavior notes: `docs/research/shadcn-admin/BEHAVIORS.md`
- Page topology: `docs/research/shadcn-admin/PAGE_TOPOLOGY.md`
- Shell spec: `docs/research/components/agent-admin-shadcn-shell.spec.md`
- Screenshot: `docs/design-references/shadcn-admin/dashboard-reference-mobile.png`

## Verification Anchors

- `apps/frontend/agent-admin/test/pages/dashboard/dashboard-page.test.tsx`
- `apps/frontend/agent-admin/test/components/app-sidebar.test.tsx`
- `apps/frontend/agent-admin/test/app/app.test.tsx`

These tests protect the shadcn-admin shell markers while preserving center rendering and sidebar behavior.
