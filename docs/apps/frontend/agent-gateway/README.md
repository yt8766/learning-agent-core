# Agent Gateway Frontend

状态：current
文档类型：architecture
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-12

`apps/frontend/agent-gateway` 是独立的中转控制台前端，不属于 `agent-chat` 前线执行面，也不属于 `agent-admin` 六大治理中心。它负责 Agent Gateway 的仪表盘、Runtime Engine、调用方管理、使用统计、配置面板、AI 提供商、认证文件、OAuth 登录、迁移导入、配额管理、日志和中心信息展示。

当前入口：

- Vite app：`apps/frontend/agent-gateway`
- 页面标题：`Agent Gateway Console`
- 视觉参考：`/Users/dev/Desktop/Cli-Proxy-API-Management-Center/src/pages` 与 `http://localhost:8317/management.html#/` 系列页面。当前 shell 使用纯白控制台风格：白色页面背景、白色左侧栏、浅灰边框、轻阴影、12 项图标导航和右上观测状态条；登录页使用参考项目左右分屏结构，但名称和图标替换为 Agent Gateway 自有语义。`/runtime` 展示内建 CLIProxyAPI runtime engine health、executor 状态、active requests 和 streaming 能力；`/usage` 展示使用统计概览、趋势、请求日志、Provider 统计和模型统计；`/ai-providers` 已按参考项目还原为纵向大卡、虚线空状态和底部 provider 图标浮条，并从参考项目搬入 Gemini、Codex、Claude、Vertex、OpenAI、Ampcode 等 SVG；Provider 卡片支持进入可编辑表单，保存配置和测试模型都必须在卡片内显示 loading、success 或 error 反馈；`/auth-files` 已按参考项目继续补齐筛选轨道、过滤控制、富信息文件卡片、单项删除、批量选择/反选/取消、批量状态切换、关系视图、字段修补弹窗和模型列举弹窗；`/oauth` 展示 Codex/Anthropic/Antigravity/Gemini CLI/Kimi 授权登录卡；`/migration` 展示 CLIProxyAPI 迁移预览、冲突确认和 apply 报告；`/quota` 已按参考项目还原为 provider quota sections、分页/全部显示切换、刷新全部和 quota card；`/logs` 展示 request logs 搜索、tail、下载和清理入口；`/system` 已按参考项目还原为居中 about card、信息 tile、quick links、模型标签和登录/请求日志操作区。仪表盘恢复参考项目的背景浮动、watermark、hero/card 进入和状态点脉冲动效。工作区页面统一记录在 `docs/apps/frontend/agent-gateway/research/`。
- 状态管理：`src/app/agent-gateway-store.ts` 使用 `zustand@^5.0.12` 管理登录页 UI 状态。
- 样式入口：`src/app/App.scss`，应用内样式全部使用 Sass（`.scss`），由 `sass` devDependency 交给 Vite 编译；`management.scss` 和 `usage-stats.scss` 只做 `@use` 聚合，具体规则按页面域拆在 `src/app/styles/management/` 与 `src/app/styles/usage-stats/`，不要恢复 `.css` 文件。
- 登录态：`src/auth/auth-session.tsx`，开发态通过同源 `/api/identity/*` 调用获取 token，并由 Vite proxy 转发到 `agent-server`
- refresh token storage：`localStorage`，键为 `agent-gateway.refresh-token`
- 路由入口：`src/main.tsx` 使用 `BrowserRouter`，工作区页面链接由 `react-router-dom` 的 `NavLink` 切换。
- 读取调度：`src/main.tsx` 提供 `QueryClientProvider`，`src/app/App.tsx` 使用 `@tanstack/react-query` 拉取 snapshot、logs、usage、usage analytics、dashboard、runtime health、Gateway clients、client quota/api-keys/logs、raw config、API keys、quota detail、system models、provider configs 和 auth files；mutable 操作成功后统一 invalidates `['agent-gateway']` 前缀查询。
- HTTP client：`src/api/agent-gateway-api.ts` 与 `src/auth/auth-api.ts` 使用 `axios`；常规请求不再直接使用浏览器 `fetch`。
- API contract：`docs/contracts/api/agent-gateway.md`

## Contract And Auth Boundaries

`apps/frontend/agent-gateway` 的 CPAMC parity 必须先过 `@agent/core` contract gate。Dashboard、Runtime、Gateway clients、Usage、Raw config、Proxy API keys、Provider configs、Auth Files、OAuth、Migration、Quota、Logs 和 System 页面只能消费 `packages/core/src/contracts/agent-gateway` 导出的 schema/type；外部 CLIProxyAPI 返回值只能由后端迁移 adapter 归一化后进入页面。

鉴权边界不可混用：控制台 `/api/*` 请求使用 Identity access token；runtime `/v1/*` 请求使用 Gateway client API key。Identity 用户负责登录和管理操作，Gateway client API key 负责真实 runtime 调用方身份，provider secret 只由后端 secret vault / adapter 持有。

页面只展示 secret projection：masked value、prefix、状态、账号元数据或 `secretRef`。不得在 props、React state、localStorage、日志或错误提示中保存 OAuth `accessToken` / `refreshToken`、provider `apiKey`、auth file 原文、raw provider headers、process `stderr`、raw response 或 raw token payload。Runtime 页面展示的 executor adapter kind 只能是 `deterministic`、`http`、`process` 或 `native-ts`。

## 当前屏幕边界

当前代码提供：

- 登录页：参考 CLI Proxy 管理中心登录页，左侧黑底品牌大字 `AGENT / GATEWAY / API`，右侧展示 `Agent Gateway Management Center`、用户名、管理密钥、记住密码和登录按钮；不展示语言切换、当前地址和自定义连接地址块。
- 工作区 shell：纯白左侧栏，只包含 12 个选项：`仪表盘`、`Runtime`、`调用方管理`、`使用统计`、`配置面板`、`AI提供商`、`认证文件`、`OAuth登录`、`迁移导入`、`配额管理`、`日志`、`中心信息`。
- Route ids 固定为 `dashboard`、`runtime`、`clients`、`usageStats`、`config`、`aiProviders`、`authFiles`、`oauth`、`migration`、`quota`、`logs`、`system`。这些 id 是 CPAMC 功能吸收后的 Agent Gateway 语义命名，不保留 CPAMC 原始路由或 raw API client 作为前端入口。
- 仪表盘：`/`，展示连接状态、API Base、版本、管理密钥数、认证文件数、provider 凭据数、模型数和 routing 摘要；保留 `dashboard-orb-float`、`dashboard-hero-enter`、`dashboard-card-enter` 和状态点 pulse 等参考项目动效钩子。
- Runtime：`/runtime`，展示 embedded runtime engine health、executor status、active requests、active streams、usage queue、failed audit queue 和 cooldown 状态；该页面反映 `agent-server` 内建 CLIProxyAPI runtime，而不是外部 CLIProxyAPI 连接状态。已接入 `GET /api/agent-gateway/runtime/health`，响应必须通过 `@agent/core` 的 `GatewayRuntimeHealthResponseSchema` 解析。
- 调用方管理：`/clients`，展示 runtime 调用方、client API key 数量、月度 token/request 额度、request log 数量、启停和创建调用方操作；已接入 `GET/POST/PATCH /api/agent-gateway/clients`、`POST /clients/:id/api-keys`、`GET/PUT /clients/:id/quota`、`GET /clients/:id/logs`。这里的调用方是中转站 runtime principal，不等同于 Identity 控制台用户。
- 使用统计：`/usage`，展示总请求数、总成本、总 token、缓存 token、使用趋势、请求日志、Provider 统计和模型统计；已接入 `GET /api/agent-gateway/usage/analytics`，响应必须通过 `@agent/core` 的 `GatewayUsageAnalyticsResponseSchema` 解析。当前数据来自 runtime client request logs 聚合；成本或 cache token 只有在后端 runtime accounting / request log contract 提供真实字段时才展示非零值，前端不得自行合成假数据。
- 配置面板：`/config`，展示 Agent Gateway `config.yaml` raw editor、diff、保存和 reload 操作入口。
- AI 提供商：`/ai-providers`，展示 Gemini API 密钥、Codex API 配置、Claude API 配置、Vertex API 配置、OpenAI 兼容配置、Ampcode 桥接配置，采用参考项目大标题、宽白色大卡、灰色主按钮、虚线空状态和底部图标浮条；每个 provider 卡片可打开编辑态表单，保存时调用 `PUT /api/agent-gateway/provider-configs`，模型发现调用 `GET /provider-configs/:id/models`，模型测试调用 `POST /provider-configs/:id/test-model`。保存、发现和测试必须在卡片内显示等待、成功或错误反馈，不允许用户点击后没有状态变化。
- 认证文件：`/auth-files`，展示批量上传/下载/删除、批量状态切换、选择当前页、选中筛选结果、反选当前页、取消选择、单项下载、单项删除、状态切换、字段修补、模型列举、OAuth 模型别名配置、筛选/搜索/分页/紧凑/关系图操作入口；页面结构采用参考项目筛选 tag rail、filter controls、provider avatar 文件卡片和 sticky 批量操作条。文件卡片展示 path、providerId、project、account、size、priority、authIndex、success/failed、prefix、proxyUrl、headers、note、statusMessage 和 metadata 摘要；搜索支持 `*` 通配符并覆盖 metadata 投影字段；排序支持最近更新、名称、供应商、模型数量、状态和优先级。状态切换通过 `GatewayAuthFilePatchRequest.disabled` 表达真实启用/停用语义；字段修补必须进入弹窗表单并提交 providerId、accountEmail、projectId、status、disabled、prefix、proxyUrl、priority、note、headers 和 metadata，后端 `CliProxyManagementClient` 会分别映射到 CLIProxyAPI 的 `/auth-files/status` 与 `/auth-files/fields`。模型列举必须进入弹窗结果面板并调用 `GET /auth-files/:id/models`，弹窗内需要展示 loading、success 或 error 反馈以及模型数量/列表结果。OAuth 别名入口通过 `GET/PUT /agent-gateway/oauth/model-aliases/:providerId` 接口按 provider 聚合管理。空态卡片本身也是上传入口，避免用户点击说明文字没有反应。筛选重置、搜索聚焦、分页数量、排序、问题文件、已禁用、紧凑模式和关系图均是有状态控件，不再保留纯装饰按钮。页面状态（筛选、搜索、分页大小、排序、紧凑/关系图模式）持久化在 `localStorage` 的 `agent-gateway:auth-files-manager-v1`，用于保留上次操作习惯。写操作在页面内统一显示等待、成功或错误反馈；缺少回调时必须显示“当前页面尚未接入该操作”，不能静默成功。已消费 `GET/POST/DELETE /api/agent-gateway/auth-files`、`PATCH /auth-files/fields`、`GET /auth-files/:id/models`、`GET /agent-gateway/oauth/model-aliases/:providerId`、`PATCH /agent-gateway/oauth/model-aliases/:providerId` 和 `GET /auth-files/:id/download`。
- OAuth 登录：`/oauth`，展示 Codex、Anthropic、Antigravity、Gemini CLI、Kimi OAuth 登录卡；初始态只展示标题、说明和开始登录按钮。点击开始登录时前端必须同步打开一个空白新标签，后端返回授权 URL 后自动把新标签导航到 OAuth provider，避免用户还要手动点“打开链接”。启动成功后前端会按 `state` 进行周期轮询，直到状态变成 `completed`/`error`/`expired`，并保持可见提示；提交 callback URL 成功后在卡片内显示短时成功反馈（约 5 秒后回到可重试空态）。Codex / Anthropic / Antigravity / Gemini CLI 保留回调 URL 手动提交，输入框示例必须使用各 provider 原生本地回跳地址：Codex `http://localhost:1455/auth/callback?...`、Anthropic `http://localhost:54545/callback?...`、Antigravity `http://localhost:51121/oauth-callback?...`、Gemini CLI `http://localhost:8085/oauth2callback?...`，不得统一写成 Agent Gateway `/api/agent-gateway/oauth/callback`。当 provider 使用 Agent Gateway callback 时，`GET /api/agent-gateway/oauth/callback` 完成提交后返回 HTML，并自动跳回 `/oauth?oauthProvider=...&oauthState=...&oauthStatus=...`。Gemini CLI 支持可选 Google Cloud 项目 ID；Kimi 使用 device authorization URL 和用户代码，不展示回调 URL 输入。已接入 `POST /oauth/:providerId/start`、`POST /oauth/gemini-cli/start`、浏览器回跳 `GET /oauth/callback`、`GET /oauth/status/:state` 和手动提交 `POST /oauth/callback`。
- 迁移导入：`/migration`，输入既有 CLIProxyAPI `apiBase` 和 management key 后调用 `POST /api/agent-gateway/migration/preview`，展示 `GatewayMigrationPreviewSchema` 的资源列表、create/update/skip/conflict 统计和冲突原因；预览按钮保持可点击，缺少地址或 key 时在页面内显示错误，而不是灰掉后没有反馈；执行导入调用 `POST /api/agent-gateway/migration/apply`，默认只提交 safe resources，只有勾选确认后才把 unsafe conflict source ids 传入 `confirmUnsafeConflicts`。apply report 展示 imported/skipped/failed/warnings 汇总、warning 文案和 failure 原因，但不得展示 management key、raw upstream payload 或 raw auth file 内容。
- 配额管理：`/quota`，展示 Claude、Antigravity、Codex、Gemini CLI、Kimi 分段 quota cards、分页/全部显示切换、刷新全部、进度条和原始 quota table；已接入 `POST /quotas/details/:providerKind/refresh` 和 `PATCH /quotas/:id`。
- 日志：`/logs`，展示 request logs 搜索、hide management traffic、状态筛选、下载请求、下载错误日志、Raw/Parsed 切换和清空日志入口；清空日志必须调用 `AgentGatewayApiClient.clearLogs()` 并解析 `GatewayClearLogsResponseSchema`，成功后触发统一数据刷新。
- 中心信息：`/system`，展示 Agent Gateway Management Center about card、Web UI/API/build/connection 信息 tile、quick links、请求日志、本地登录态清理和 runtime `/v1/models` grouped projection；模型列表只展示后端 `GET /api/agent-gateway/system/models` 返回的 discovery 结果，不再用 snapshot provider families 合成假模型；已接入 `GET /system/latest-version`、`PUT /system/request-log`、`POST /system/clear-login-storage` 和模型刷新。
- Workflow controls：确认弹窗、通知中心和未保存变更 guard 的基础组件。

当前 workspace 暴露 12 个视图。页面切换由 URL 驱动：`/` 是仪表盘，其他页面使用 `/runtime`、`/clients`、`/usage`、`/config`、`/ai-providers`、`/auth-files`、`/oauth`、`/migration`、`/quota`、`/logs`、`/system`；Mutable flows 使用确认、通知、错误、loading 和未保存状态提示。

页面只消费 `@agent/core` 的稳定 contract 和 `src/api/agent-gateway-api.ts`，不得直接读取 backend 内部实现、CPAMC raw API client 或 raw vendor payload。`GatewayWorkspace` / `routes/gateway-page-wiring.tsx` 是页面与 `AgentGatewayApiClient` 的唯一联动层：页面保持 callback-driven，后端响应由 `App.tsx` 查询后注入为 props。

## Production Readiness Boundary

当前 UI 已从后端读取 dashboard、runtime health、clients、provider configs、auth files、OAuth、quota 和 system projection，但仍不能把“页面已接线”理解为“完整复刻可用”。生产可用前端必须继续完成以下 contract 对齐：

- Runtime 页面消费 `GatewayRuntimeExecutorConfigSchema` / health projection，展示 executor facade、health、active requests、active streams、usage queue 和 cooldowns，而不是空 executor 或 skeleton 状态。CI 默认 executor 仍是 deterministic local harness；接真实 provider 时必须继续通过 runtime-engine adapter 边界。
- OAuth 页面消费 `GatewayOAuthCredentialRecordSchema` 派生状态。页面不得展示或缓存 access token / refresh token；只展示账号、项目、状态、过期时间和 auth file/secret ref 的 masked projection。
- Quota 页面消费 `GatewayProviderQuotaSnapshotSchema`，按 provider/auth file/model 维度展示真实额度；不能只展示 snapshot 里的第一条示例 quota。
- Auth Files 页面当前已投影参考项目的文件字段、批量操作和弹窗体验；`disabled` 启停语义、prefix/proxyUrl/priority/headers/note 已进入 `@agent/core` Auth File contract，并由后端 adapter 映射到 CLIProxyAPI。参考项目里的 OAuth excluded、recent request 状态条、quota 专属卡片和 raw auth file 预览编辑仍需要先补稳定 contract、adapter 和后端 API 后再接入前端，不能在浏览器端用 raw CPAMC payload 临时拼接。
- 迁移页面消费 `GatewayMigrationPreviewSchema` 和 `GatewayMigrationApplyResponseSchema`，支持连接既有 CLIProxyAPI、预览差异、确认导入和展示导入报告。前端只把 `apiBase`、management key、selected source ids 和 `confirmUnsafeConflicts` 传给后端；不得在浏览器中解析或持久化 raw upstream payload、raw API key secret、OAuth token 或 auth file 内容。
- 所有 mutation 必须走 `AgentGatewayApiClient`，成功后 invalidates `['agent-gateway']` 查询前缀；不得提交硬编码 demo 文件、demo quota、demo provider payload、raw CPAMC client 请求或无 client 时的 fallback preview/apply/OAuth payload。`GatewayWorkspacePages.tsx` 只保留 thin compatibility wrapper，真实接线边界在 `src/app/routes/gateway-page-wiring.tsx`；如果页面回调没有拿到 `AgentGatewayApiClient`，必须显式失败，而不是静默返回样例数据。AI Provider 保存/模型发现/模型测试、Auth File 字段修补/模型列举也属于 mutation 或远端操作闭环，必须共用同一状态反馈语义。
- 新建调用方、生成 client API key、保存额度、迁移预览、OAuth start/callback、Auth File 上传等写操作必须有 loading / success / error 可见反馈；禁止只触发 promise 后在 UI 上没有任何变化。调用方管理页在缺少 mutation callback 时必须以错误反馈暴露未接线状态，不能把 undefined handler 当作成功提交。

## Smoke 验证边界

当前本地依赖中没有 Playwright、jsdom、happy-dom、`@testing-library/dom` 或 `@testing-library/user-event`，因此 `agent-gateway` 前端真实操作 smoke 采用 Vitest + React element callback 方式覆盖接线，不做浏览器点击级 E2E。固定入口是：

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-real-operation-smoke.test.tsx
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts
```

该 smoke 覆盖登录后工作区页面注入的真实操作链路：CLIProxyAPI migration preview/apply、OAuth start/status/callback、Auth File 上传/删除/下载/字段修补/模型列举、quota refresh/update、client API key 创建，以及 Runtime page health projection。断言重点是页面 callback 只调用 `AgentGatewayApiClient`，成功写入后触发统一 gateway data changed 回调，由 `App.tsx` 负责 invalidates `['agent-gateway']`。同时覆盖 Auth Files 页面不渲染无反馈刷新/装饰按钮、空态可上传、筛选控件有状态，以及 Clients 页面缺少写操作回调时暴露未接线状态。

后端 HTTP smoke 使用真实 `AppModule` 和 Identity token 覆盖 dashboard、system models、quota refresh、Auth File 上传/列表、client 创建、one-time API key 创建和 client quota 查询，用来证明页面写操作依赖的 HTTP 入口不是只停留在 service mock。

仍需人工浏览器或 Playwright 真机联调的事项：

- 登录后在 Vite dev server 中逐页点击 `/migration`、`/oauth`、`/auth-files`、`/quota`、`/clients`、`/runtime`，确认按钮 disabled/loading/error 状态、文件选择器和 callback URL 输入体验。
- Auth File 批量上传需要真实浏览器 `File` / file picker 行为验证；当前 Vitest smoke 只验证上传 payload 已经交给 `AgentGatewayApiClient.batchUploadAuthFiles`。
- OAuth 复制链接、打开新窗口和外部授权回跳需要真实浏览器权限与后端 callback 配合验证。
- Migration apply、quota refresh 和 client key 创建需要连接真实 `agent-server`，确认 mutation 成功后 React Query 重新拉取页面数据。

`apps/frontend/agent-gateway` 已具备可用管理中心的迁移闭环：Identity 登录、后端接口拉取页面数据、provider/auth-file/OAuth/quota/system/runtime 页面、CLIProxyAPI migration preview/apply 和 mutation invalidation 均已接入真实 API client。它现在可以承载“从既有 CLIProxyAPI 管理数据迁移到本地 Agent Gateway”的低门槛流程；真正的 0 成本生产替代仍取决于后端接入真实 vendor OAuth token exchange、真实 runtime executor 和真实账号额度抓取。

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
