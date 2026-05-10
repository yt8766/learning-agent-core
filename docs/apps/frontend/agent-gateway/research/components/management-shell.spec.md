# Management Shell Specification

状态：current
文档类型：spec
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-10

## Overview

- **Target files:** `src/app/GatewayWorkspace.tsx`, `src/app/styles/shell.css`, `src/app/styles/management.css`
- **Interaction model:** route-driven navigation with hover feedback

## Structure

- `main.app-shell.gateway-shell-restored`
- `aside.side-nav` with `brand-block`, seven `view-nav-item` entries, logout button
- `section.workspace` with sticky `workspace-header` and active page content

## Styles

- Background: pure white page background.
- Sidebar: white surface, `18px` radius, `1px` light gray border, subtle shadow.
- Navigation: icon square + label; active item uses neutral light gray fill.
- Header observer strip: glass surface, rounded `16px`, backdrop blur.

## Responsive

- Desktop: 252px sidebar + content grid.
- Mobile: sidebar becomes top sticky strip; nav scrolls horizontally.
