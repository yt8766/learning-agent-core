# Agent Gateway Frontend

状态：current
文档类型：architecture
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-10

`apps/frontend/agent-gateway` 是独立的中转控制台前端，不属于 `agent-chat` 前线执行面，也不属于 `agent-admin` 六大治理中心。它负责 Agent Gateway 的仪表盘、调用方管理、配置面板、AI 提供商、认证文件、OAuth 登录、配额管理和中心信息展示。

当前入口：

- Vite app：`apps/frontend/agent-gateway`
- 页面标题：`Agent Gateway Console`
- 视觉参考：`/Users/dev/Desktop/Cli-Proxy-API-Management-Center/src/pages` 与 `http://localhost:8317/management.html#/` 系列页面。当前 shell 使用纯白控制台风格：白色页面背景、白色左侧栏、浅灰边框、轻阴影、7 项图标导航和右上观测状态条；登录页使用参考项目左右分屏结构，但名称和图标替换为 Agent Gateway 自有语义。`/ai-providers` 已按参考项目还原为纵向大卡、虚线空状态和底部 provider 图标浮条，并从参考项目搬入 Gemini、Codex、Claude、Vertex、OpenAI、Ampcode 等 SVG；`/auth-files` 已按参考项目还原筛选轨道、过滤控制、文件卡片和批量操作浮条；`/oauth` 展示 Codex/Claude/Antigravity/Kimi 授权登录卡；`/quota` 已按参考项目还原为 provider quota sections、分页/全部显示切换、刷新全部和 quota card；`/system` 已按参考项目还原为居中 about card、信息 tile、quick links、模型标签和登录/请求日志操作区。仪表盘恢复参考项目的背景浮动、watermark、hero/card 进入和状态点脉冲动效。工作区页面统一记录在 `docs/apps/frontend/agent-gateway/research/`。
- 状态管理：`src/app/agent-gateway-store.ts` 使用 `zustand@^5.0.12` 管理登录页 UI 状态。
- 登录态：`src/auth/auth-session.tsx`，开发态通过同源 `/api/identity/*` 调用获取 token，并由 Vite proxy 转发到 `agent-server`
- refresh token storage：`localStorage`，键为 `agent-gateway.refresh-token`
- 路由入口：`src/main.tsx` 使用 `BrowserRouter`，工作区页面链接由 `react-router-dom` 的 `NavLink` 切换。
- 读取调度：`src/main.tsx` 提供 `QueryClientProvider`，`src/app/App.tsx` 使用 `@tanstack/react-query` 拉取 snapshot、logs、usage、dashboard、Gateway clients、client quota/api-keys/logs、raw config、API keys、quota detail、system models、provider configs 和 auth files；mutable 操作成功后统一 invalidates `['agent-gateway']` 前缀查询。
- HTTP client：`src/api/agent-gateway-api.ts` 与 `src/auth/auth-api.ts` 使用 `axios`；常规请求不再直接使用浏览器 `fetch`。
- API contract：`docs/contracts/api/agent-gateway.md`

## 当前屏幕边界

当前代码提供：

- 登录页：参考 CLI Proxy 管理中心登录页，左侧黑底品牌大字 `AGENT / GATEWAY / API`，右侧展示 `Agent Gateway Management Center`、用户名、管理密钥、记住密码和登录按钮；不展示语言切换、当前地址和自定义连接地址块。
- 工作区 shell：纯白左侧栏，只包含 8 个选项：`仪表盘`、`调用方管理`、`配置面板`、`AI提供商`、`认证文件`、`OAuth登录`、`配额管理`、`中心信息`。
- 仪表盘：`/`，展示连接状态、API Base、版本、管理密钥数、认证文件数、provider 凭据数、模型数和 routing 摘要；保留 `dashboard-orb-float`、`dashboard-hero-enter`、`dashboard-card-enter` 和状态点 pulse 等参考项目动效钩子。
- 调用方管理：`/clients`，展示 runtime 调用方、client API key 数量、月度 token/request 额度、request log 数量、启停和创建调用方操作；已接入 `GET/POST/PATCH /api/agent-gateway/clients`、`POST /clients/:id/api-keys`、`GET/PUT /clients/:id/quota`、`GET /clients/:id/logs`。这里的调用方是中转站 runtime principal，不等同于 Identity 控制台用户。
- 配置面板：`/config`，展示 Agent Gateway `config.yaml` raw editor、diff、保存和 reload 操作入口。
- AI 提供商：`/ai-providers`，展示 Gemini API 密钥、Codex API 配置、Claude API 配置、Vertex API 配置、OpenAI 兼容配置、Ampcode 桥接配置，采用参考项目大标题、宽白色大卡、灰色主按钮、虚线空状态和底部图标浮条；已消费 `GET/PUT /api/agent-gateway/provider-configs`、`GET /provider-configs/:id/models` 和 `POST /provider-configs/:id/test-model`。
- 认证文件：`/auth-files`，展示批量上传/下载/删除、状态切换、字段修补、模型列举、筛选/搜索/分页/紧凑/关系图操作入口；页面结构采用参考项目筛选 tag rail、filter controls、provider avatar 文件卡片和 sticky 批量操作条；已消费 `GET/POST/DELETE /api/agent-gateway/auth-files`、`PATCH /auth-files/fields`、`GET /auth-files/:id/models` 和 `GET /auth-files/:id/download`。
- OAuth 登录：`/oauth`，展示 Codex、Claude、Antigravity、Kimi OAuth 登录卡；初始态只展示标题、说明和开始登录按钮，点击开始登录并拿到授权 URL 后才展开授权链接、复制/打开、状态刷新区域。Codex/Claude/Antigravity 保留 Callback URL 手动提交；Kimi 使用 device authorization URL 和用户代码，不展示 Callback URL 输入。已接入 `POST /oauth/:providerId/start`、浏览器回跳 `GET /oauth/callback`、`GET /oauth/status/:state` 和手动提交 `POST /oauth/callback`。
- 配额管理：`/quota`，展示 Claude、Antigravity、Codex、Gemini CLI、Kimi 分段 quota cards、分页/全部显示切换、刷新全部、进度条和原始 quota table；已接入 `POST /quotas/details/:providerKind/refresh` 和 `PATCH /quotas/:id`。
- 中心信息：`/system`，展示 Agent Gateway Management Center about card、Web UI/API/build/connection 信息 tile、quick links、请求日志、本地登录态清理和 `/v1/models` grouped projection；已接入 `GET /system/latest-version`、`PUT /system/request-log` 和 `POST /system/clear-login-storage`。
- Workflow controls：确认弹窗、通知中心和未保存变更 guard 的基础组件。

当前 workspace 暴露 8 个视图。页面切换由 URL 驱动：`/` 是仪表盘，其他页面使用 `/clients`、`/config`、`/ai-providers`、`/auth-files`、`/oauth`、`/quota`、`/system`；Mutable flows 使用确认、通知、错误、loading 和未保存状态提示。

页面只消费 `@agent/core` 的稳定 contract 和 `src/api/agent-gateway-api.ts`，不得直接读取 backend 内部实现或 raw vendor payload。`GatewayWorkspace` 是页面与 `AgentGatewayApiClient` 的唯一联动层：页面保持 callback-driven，后端响应由 `App.tsx` 查询后注入为 props。

当前前端按统一 Identity 的短 access token + 长 refresh token 工作：

- access token 只保存在 React session state 中。
- refresh token 通过 `auth-storage.ts` 写入 `localStorage`。
- `/api/identity/refresh` 会轮换 refresh token；前端必须把响应里的新 refresh token 写回 `agent-gateway.refresh-token`。继续使用旧 refresh token 会触发 `401 refresh_token_reused` 并撤销 session。
- 开发态 React StrictMode 可能重放 mount effect；`auth-session.tsx` 会对同一个 refresh token 的并发刷新做 promise 合并，避免同一 token 被并发提交两次。
- `GatewayAuthProvider` 默认使用模块级稳定 auth API 单例；不要在 render 默认参数或组件体内反复 `createGatewayAuthApi()`，否则 `refreshAccessToken` 依赖会变化并导致恢复会话 effect 循环刷新、持续写入 refresh token。
- API client 遇到 `401` 且错误码为 `ACCESS_TOKEN_EXPIRED` 或 `UNAUTHENTICATED` 时只刷新一次 access token，并重试原请求；如果 refresh token 也失效，回到登录页重新登录。
- 登录表单不预填本地账号或密码；账号来自 `agent-server` Identity 域，开发种子账号使用 `IDENTITY_ADMIN_USERNAME` / `IDENTITY_ADMIN_PASSWORD`，不再使用 `AGENT_GATEWAY_ADMIN_USERNAME` / `AGENT_GATEWAY_ADMIN_PASSWORD`。
- `/agent-gateway/auth/*` 是后端迁移兼容入口，当前前端不得调用。

开发入口：

```bash
pnpm --dir apps/frontend/agent-gateway dev
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm --dir apps/frontend/agent-gateway build
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test
pnpm check:docs
```

Vite dev server 默认端口是 `5176`，并把 `/api/*` 代理到 `http://localhost:3000`。前端 auth client 默认请求 `/api/identity/*`，Gateway API client 默认请求 `/api/agent-gateway/*`；不要新增裸 `/identity/*` 或 `/agent-gateway/*` 前端调用。
