# Ant Design Pro Welcome Topology

状态：snapshot
文档类型：reference
适用范围：`https://preview.pro.ant.design/welcome/`、`apps/frontend/knowledge`
最后核对：2026-05-01

## Sections

1. **Top Header**
   - Full-width bar at top.
   - Left brand in live `/welcome/` page: Ant Design Pro logo + title.
   - Right actions: document icon, source/fork icon, language icon, avatar, `ProUser`.

2. **Left Sidebar**
   - Fixed vertical menu.
   - Top starts under the header.
   - Menu items: `欢迎`、`管理页`、`Dashboard`、`表单页`、`列表页`、`详情页`、`结果页`、`异常页`、`个人页`、`AI 助手`.
   - User reference requires `表单页` expanded with `基础表单` selected.

3. **Welcome Content**
   - Page title row: `欢迎使用 Ant Design Pro V6🎉`.
   - Main white card: `Ant Design Pro Cheatsheet`, badges, blue cheatsheet image, feature list, quick start/code/table sections.
   - Right column: three numbered quick cards.
   - Floating setting button on right side.

4. **Footer**
   - Version and copyright text at bottom.

## Implementation Mapping

- Header and sidebar live in `apps/frontend/knowledge/src/app/layout/app-shell.tsx`.
- Welcome content maps to `apps/frontend/knowledge/src/pages/overview/overview-page.tsx`.
- Exact visual styling lives in `apps/frontend/knowledge/src/styles/knowledge-pro.css`.
