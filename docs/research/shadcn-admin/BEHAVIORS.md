# shadcn-admin Behavior Notes

状态：current
文档类型：note
适用范围：`apps/frontend/agent-admin` visual reference
最后核对：2026-04-30

Source: https://shadcn-admin.netlify.app/
Source implementation: https://github.com/satnaing/shadcn-admin/tree/main

Captured on 2026-04-30 for the `agent-admin` visual refresh.

## Global Behavior

- The reference uses a compact shadcn dashboard shell: left app sidebar, top toolbar, page title, segmented tabs, summary cards, then dense content panels.
- The page is mostly static at the shell level. Primary interactions are click-driven navigation, command/search entry, icon buttons, theme/settings/profile actions, and tab selection. In source, `src/components/search.tsx` implements search as an outline button with `aria-keyshortcuts="Meta+K Control+K"`.
- Cards use hover-capable shadcn primitives but no large scroll-driven or parallax motion is visible in the dashboard shell.
- The mobile viewport collapses the shell into top icon controls and stacks cards vertically.

## Visual Tokens

- Font family from the reference HTML: Inter and Manrope via Google Fonts. The local implementation uses existing Geist Variable as a close in-repo equivalent to avoid dependency churn.
- Main palette: white background, slate foreground, muted slate text, light slate border, near-black primary button.
- Primary radius: `0.625rem`; cards and tabs are modestly rounded rather than pill/large rounded.
- Cards: white card background, `1px` light border, subtle shadow, compact header/content spacing.

## Interactions Implemented Locally

- Sidebar navigation remains project-specific and routes to `agent-admin` centers.
- Header search is a visual command/search affordance with no backend search behavior added in this pass.
- Header actions remain project actions: metrics snapshot, refresh, copy share link, quick create.
- Page tabs navigate between primary governance centers while preserving sidebar navigation for all project centers.
