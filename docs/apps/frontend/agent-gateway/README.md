# Agent Gateway Frontend

状态：current
文档类型：architecture
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-09

`apps/frontend/agent-gateway` 是独立的中转控制台前端，不属于 `agent-chat` 前线执行面，也不属于 `agent-admin` 六大治理中心。它负责 Agent Gateway 的 Dashboard、连接、raw config、proxy API keys、上游方、认证文件、Auth Files Manager、OAuth Policy、Quota Detail、调用管线、日志、探测、token 处理、relay smoke、写操作入口、deterministic OAuth/Auth File 生命周期和 System 信息展示。

当前入口：

- Vite app：`apps/frontend/agent-gateway`
- 页面标题：`Agent Gateway Console`
- 视觉参考：`/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的管理面。当前 shell 使用暖灰纸感背景、半透明浮动侧栏、图标导航、右上观测状态条和低饱和暖灰主色，避免退回深色实心侧栏或通用绿色后台皮肤。
- 登录态：`src/auth/auth-session.tsx`，开发态通过同源 `/api/identity/*` 调用获取 token，并由 Vite proxy 转发到 `agent-server`
- refresh token storage：`localStorage`，键为 `agent-gateway.refresh-token`
- 路由入口：`src/main.tsx` 使用 `BrowserRouter`，工作区页面链接由 `react-router-dom` 的 `NavLink` 切换，当前路径以 `/gateway` 为根。
- 读取调度：`src/main.tsx` 提供 `QueryClientProvider`，`src/app/App.tsx` 使用 `@tanstack/react-query` 拉取 snapshot、logs、usage、dashboard、raw config、API keys、quota detail 和 system models。
- HTTP client：`src/api/agent-gateway-api.ts` 与 `src/auth/auth-api.ts` 使用 `axios`；常规请求不再直接使用浏览器 `fetch`。
- API contract：`docs/contracts/api/agent-gateway.md`

## 当前屏幕边界

当前代码提供：

- 登录页：提交用户名、密码到统一 Identity 登录入口，不预填账号或密码。
- 工作区 shell：参考 CLI Proxy 管理中心的暖灰玻璃态控制台，包含浮动侧栏、品牌图标、图标导航、退出按钮、标题区和观测状态条。
- 总览指标：运行状态、输入 token 策略、输出 token 策略、日志数量与用量数量。
- Dashboard：展示连接状态、API Base、版本、API key 数、Auth Files 数、provider key 数、模型数和 routing 摘要。
- Connection：保存远程 CLI Proxy Management API profile，并触发 deterministic connection check。
- Config：展示 `config.yaml` raw editor、diff、保存和 reload 操作入口。
- API Keys：展示 proxy API key masked prefix，并提供替换、更新、删除操作入口。
- Providers：provider 列表、状态、优先级、模型族、base URL、超时和保存/删除入口。
- Provider Config：展示 Gemini、Codex、Claude、Vertex、OpenAI-compatible、Ampcode 专属配置骨架，包含 OpenAI-compatible model discovery/test model 与 Ampcode upstream/model mappings/force mappings 操作入口。
- Credential Files：auth file 列表、状态、最近检查时间、保存/删除入口和 OAuth start/complete/refresh 操作入口。
- Auth Files Manager：展示 batch upload/download/delete、status toggle、field patch、model listing、filter/search/pagination/compact/list diagram 操作入口。
- OAuth Policy：展示 excluded models、model aliases/fork alias、callback/status polling 与 Vertex import 操作入口。
- Quotas：额度、重置时间、状态、告警和保存入口。
- Quota Detail：展示通过 management `api-call` 归一化后的 provider-specific quota projection。
- Pipeline：token count、preprocess、relay、accounting 的请求闭环展示。
- Logs：request log manager、搜索、隐藏 management traffic、清空、错误日志下载入口，以及 logs/usage/probe 摘要。
- System：CLI Proxy API version、latest version、quick links 和 `/v1/models` grouped projection。
- Workflow controls：确认弹窗、通知中心和未保存变更 guard 的基础组件。

当前 workspace 包含 Dashboard、Connection、Config、API Keys、Provider Config、Auth Files Manager、OAuth Policy、Quota Detail、Logs、Pipeline、Providers、Credential Files 和 System views。页面切换由 URL 驱动：`/gateway` 是总览，其他页面使用 `/gateway/<view>` 路径；Mutable flows 使用确认、通知、错误、loading 和未保存状态提示。

页面只消费 `@agent/core` 的稳定 contract 和 `src/api/agent-gateway-api.ts`，不得直接读取 backend 内部实现或 raw vendor payload。

当前前端按统一 Identity 的短 access token + 长 refresh token 工作：

- access token 只保存在 React session state 中。
- refresh token 通过 `auth-storage.ts` 写入 `localStorage`。
- `/api/identity/refresh` 会轮换 refresh token；前端必须把响应里的新 refresh token 写回 `agent-gateway.refresh-token`。继续使用旧 refresh token 会触发 `401 refresh_token_reused` 并撤销 session。
- 开发态 React StrictMode 可能重放 mount effect；`auth-session.tsx` 会对同一个 refresh token 的并发刷新做 promise 合并，避免同一 token 被并发提交两次。
- `GatewayAuthProvider` 默认使用模块级稳定 auth API 单例；不要在 render 默认参数或组件体内反复 `createGatewayAuthApi()`，否则 `refreshAccessToken` 依赖会变化并导致恢复会话 effect 循环刷新、持续写入 refresh token。
- API client 遇到 `401` 且错误码为 `ACCESS_TOKEN_EXPIRED` 时只刷新一次 access token，并重试原请求。
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

Vite dev server 默认端口是 `5175`，并把 `/api/*` 代理到 `http://localhost:3000`。前端 auth client 默认请求 `/api/identity/*`，Gateway API client 默认请求 `/api/agent-gateway/*`；不要新增裸 `/identity/*` 或 `/agent-gateway/*` 前端调用。
