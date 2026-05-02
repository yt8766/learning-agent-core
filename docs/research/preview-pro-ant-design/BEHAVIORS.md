# Ant Design Pro Welcome Behaviors

状态：snapshot
文档类型：reference
适用范围：`https://preview.pro.ant.design/welcome/`、`apps/frontend/knowledge`
最后核对：2026-05-01

## Browser Automation

- Tool: Playwright package with system Google Chrome and temporary profile.
- Desktop screenshot: `docs/design-references/preview-pro-ant-design/welcome-desktop.png`
- Mobile screenshot: `docs/design-references/preview-pro-ant-design/welcome-mobile.png`

## Global Layout

- Header is fixed at the top in the Pro preview layout. Extracted desktop height: `56px`.
- Sidebar is fixed under the header. Extracted desktop width: `256px`, top: `56px`, height: viewport remainder.
- Main content scrolls independently beside the sidebar.

## Interactions

- Header right actions are icon buttons. Hover behavior follows Ant Design button defaults.
- Sidebar menu is click-driven. Parent groups expand or collapse with Ant Design inline menu motion.
- `表单页` is the expanded group in the user-provided reference image; the live `/welcome/` screenshot may start with groups collapsed depending on route state.
- Floating setting button is fixed on the right side of the viewport in the live page.
- Sidebar collapse button floats on the right edge of the sider.

## Responsive

- Desktop at 1440px: fixed sidebar + content column + right quick-start cards.
- Mobile at 390px: Pro layout switches to compact responsive layout; the desktop fixed sidebar is not the primary visual target for this task.

## Assets

Downloaded to `apps/frontend/knowledge/public/pro-welcome-assets/`:

- `antd-logo.svg`
- `pro-user.png`
- `cheatsheet-banner.png`
- `welcome-preview.png`
- `welcome-layer-1.webp`
- `welcome-layer-2.webp`
