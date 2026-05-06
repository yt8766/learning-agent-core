# Preview Pro Welcome Shell Specification

状态：snapshot
文档类型：reference
适用范围：`apps/frontend/knowledge/src/app/layout/app-shell.tsx`
最后核对：2026-05-01

## Overview

- Target file: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- Screenshot: `docs/design-references/preview-pro-ant-design/welcome-desktop.png`
- Interaction model: click-driven Ant Design menu and buttons.

## Extracted Styles

### Header

- height: `56px`
- padding: `0px 50px`
- line-height: `56px`
- background: transparent over white layout in live page

### Sidebar

- width: `256px`
- position: `fixed`
- top: `56px`
- background: transparent / white light sider
- text color: `rgba(0, 0, 0, 0.65)`

### Menu

- width: `240px`
- font-size: `14px`
- menu text: `欢迎 管理页 Dashboard 表单页 列表页 详情页 结果页 异常页 个人页 AI 助手`

## Required Local Adaptation

- Use the Pro preview shell as the visual reference, but keep the local product identity: the top brand is `Knowledge 知识库控制台`.
- Do not render the Pro preview top action icons for docs, source, or language.
- The sidebar menu is the knowledge project menu: `总览`、`知识库`、`文档`、`对话实验室`、`观测中心`、`评测中心`、`设置`.
- Keep the right-edge circular sidebar button interactive: it toggles `256px` expanded width and `72px` collapsed width.
- Keep Header and Sider fixed; only the right-side Content area scrolls.
- `ProUser` hover menu only contains `退出登录`.

## Assets

- Welcome banner: `/pro-welcome-assets/welcome-preview.png`
- The local shell no longer uses the Pro logo or Pro user bitmap as required assets.
