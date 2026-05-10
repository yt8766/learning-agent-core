# Agent Gateway 参考管理页

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin/src/pages/agent-gateway`
最后核对：2026-05-09

`agent-admin` 当前内嵌一组 Agent Gateway 参考管理页，用于按 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的白色管理中心视觉还原左侧栏、仪表盘和关键管理页。该入口是 admin 内的展示与导航壳，不替代独立 `apps/frontend/agent-gateway` 应用，也不改变六大治理中心的后端 projection 契约。

## 当前路由

- `/`：Agent Gateway 仪表盘，展示欢迎卡片、系统概览和当前配置摘要。
- `/config`：配置面板。
- `/ai-providers`：AI 提供商配置。
- `/auth-files`：认证文件管理。
- `/oauth`：OAuth登录。
- `/quota`：配额管理。
- `/system`：中心信息。

这些路由仍位于 `ProtectedAdminRoute` 下，未登录时按 admin 原有规则跳转 `/login`。

## 实现边界

- 路由表：`apps/frontend/agent-admin/src/app/admin-routes.tsx`。
- 页面：`apps/frontend/agent-admin/src/pages/agent-gateway/agent-gateway-pages.tsx`。
- 页面壳：`apps/frontend/agent-admin/src/pages/agent-gateway/agent-gateway-shell.tsx`。
- 复用组件：`apps/frontend/agent-admin/src/pages/agent-gateway/agent-gateway-widgets.tsx`。
- 状态管理：`apps/frontend/agent-admin/src/pages/agent-gateway/agent-gateway-store.ts` 使用 `zustand@^5.0.12` 管理配置页 tab 与认证文件筛选等局部 UI 状态。
- 视觉样式：`apps/frontend/agent-admin/src/pages/agent-gateway/agent-gateway.css` 只做样式入口，布局、通用面板、管理页专项样式分别在同目录 `agent-gateway-layout.css`、`agent-gateway-panels.css`、`agent-gateway-management.css`。
- 回归测试：`apps/frontend/agent-admin/test/pages/agent-gateway/agent-gateway-routes.test.tsx`。

页面使用本项目自己的品牌与图标组合：

- 左侧栏是参考图的纯白卡片式侧栏，只保留 7 个选项：仪表盘、配置面板、AI提供商、认证文件、OAuth登录、配额管理、中心信息。
- 品牌短名显示为 `AGMC`，不沿用参考项目的 `CPAMC` 名称。
- 图标使用 `lucide-react`，不复制参考项目 logo 或 SVG 资源。
- 供应商名称保留 Gemini、Codex、Claude、Vertex、OpenAI 等配置域语义；项目壳、导航和删除按钮等文案已换成 Agent Gateway 语境。
- `/` 仪表盘按参考图 2 的欢迎卡、时间版本、系统概览 bento 卡片与当前配置摘要呈现；`/config`、`/ai-providers`、`/auth-files`、`/oauth`、`/quota`、`/system` 分别按参考项目 `src/pages` 对应页面的配置编辑工作区、提供商分块卡片、筛选区、OAuth 管理区、配额条与系统信息卡还原。

## 后续约束

- 若这些页面接入真实 Agent Gateway API，先更新 `docs/contracts/api/agent-gateway.md` 或对应 admin facade 文档，再实现 API client 与页面消费。
- 不要从 `apps/frontend/agent-admin` 直接导入 `apps/frontend/agent-gateway/src`，也不要复制独立应用的 store。跨应用复用应先收敛到稳定 contract 或本地 facade。
- 若需要继续像素级贴近参考项目，可以只调整 `agent-gateway.css` 与本目录页面组件，不要改动原 `dashboard` 六大治理中心页面。
