# Agent Gateway CLI Proxy Parity

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`
最后核对：2026-05-12

本文记录 `apps/frontend/agent-gateway` 与 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的管理能力对齐状态。参考项目是 CLI Proxy API Management API 的 Web UI；本仓库当前既对齐管理面，也提供 `agent-server` 内建 CLIProxyAPI runtime engine。`CliProxyManagementClient` 只作为外部 CLIProxyAPI 迁移 / 导入 adapter，不是 `/v1/*` 默认运行时。streaming、真实 vendor SDK 矩阵、计费和数据库持久化仍不属于本 parity 文档范围。

## Contract Gate

Full CLIProxyAPI parity 的第一道门禁是 `packages/core/src/contracts/agent-gateway`。CPAMC 管理矩阵已经按 Dashboard、Runtime、Gateway clients、Usage、Raw config、Proxy API keys、Provider configs、Auth Files、OAuth、Migration、Quota、Logs 和 System 分组记录；前端只能消费这些 schema-first projection，不直接读取 CPAMC raw payload。

前端 route id 固定为 12 个：`dashboard`、`runtime`、`clients`、`usageStats`、`config`、`aiProviders`、`authFiles`、`oauth`、`migration`、`quota`、`logs`、`system`。这些 route id 是 CPAMC 功能吸收后的 Agent Gateway 语义命名；CPAMC 原始页面名、hash route 和 raw management API client 都不能作为本仓库前端稳定接口。

Runtime adapter kind 固定为 `deterministic`、`http`、`process`、`native-ts`。`deterministic` 只用于 CI/local harness；`http`、`process` 和后续 `native-ts` executor 都必须先投影到 `GatewayRuntimeInvocation`、`GatewayRuntimeExecutorConfig`、`GatewayRuntimeError`、quota snapshot 或 stream event，再进入 UI 或日志。

鉴权必须分流：控制台 `/api/*` 使用 Identity access token；runtime `/v1/*` 使用 Gateway client API key。页面文案中出现的 management key、Gateway client API key 和 provider secret 不是同一个凭据，查询面只展示 masked value、prefix、状态或 `secretRef`。

Secret projection 是 parity 约束的一部分。OAuth `accessToken` / `refreshToken`、provider `apiKey`、auth file 原文、headers、stderr、raw response 和 raw token payload 不得进入 runtime 边界 schema，也不得作为前端页面 props。

## 已落地

- Remote management connection：`GatewaySaveConnectionProfileRequestSchema`、`GatewayConnectionProfileSchema`、`GatewayConnectionStatusResponseSchema`，后端默认由 `MemoryAgentGatewayManagementClient` 提供 deterministic projection，前端由 `ConnectionPage` 展示。
- Raw config：`GatewayRawConfigResponseSchema`、`GatewaySaveRawConfigRequestSchema`、`GatewayConfigDiffResponseSchema`、`GatewayReloadConfigResponseSchema`，前端由 `ConfigEditorPage` 展示 raw YAML editor、diff、save、reload 入口。
- Proxy API keys：`GatewayApiKeyListResponseSchema`、`GatewayReplaceApiKeysRequestSchema`、`GatewayUpdateApiKeyRequestSchema`、`GatewayDeleteApiKeyRequestSchema`，查询 projection 只返回 masked prefix、状态和 usage，不返回明文 key。
- Request logs：`GatewayLogSearchRequestSchema`、`GatewayRequestLogListResponseSchema`、`GatewayLogFileListResponseSchema`、`GatewayClearLogsResponseSchema`，前端由 `/logs` 的 `LogsManagerPage` 展示 tail/search/hide-management/clear/download 操作入口；清空日志必须通过 `AgentGatewayApiClient.clearLogs()`，响应必须按 core schema parse。
- Runtime health：`GatewayRuntimeHealthResponseSchema` 已扩展为 executor health、top-level active requests、active streams、usage audit queue 和 cooldown projection；`/runtime` 和 `/system` 只展示这些项目自有字段，不展示 vendor headers、SDK error 或 raw provider payload。
- Quota detail：`GatewayQuotaDetailListResponseSchema` 已作为 provider-specific quota projection 的稳定外壳。
- System：`GatewaySystemVersionResponseSchema`、`GatewaySystemModelsResponseSchema`，前端由 `SystemPage` 展示 Agent Gateway Core 版本、latest、quick links、请求日志、本地登录态清理和 grouped model discovery。
- Workflow controls：`ConfirmDialog`、`NotificationCenter`、`useUnsavedChangesGuard` 已作为 destructive/mutable flow 的 UI 基础件。
- Provider/Auth/OAuth UI：`ProviderConfigPage`、`AuthFilesManagerPage`、`OAuthPolicyPage` 已接入 `GatewayWorkspace` 导航和 `AgentGatewayApiClient`。Provider 页面消费 `provider-configs` projection，支持在 provider 卡片内打开可编辑表单，并调用保存、模型发现、测试模型接口；保存、发现和测试必须在同一卡片内显示 loading、success 或 error 反馈，不能只触发 promise 后静默刷新。Auth Files 页面消费 `auth-files` projection 并调用批量上传、批量删除、单项删除、批量下载、状态切换、字段修补、模型列举和下载接口；页面已对齐参考项目的筛选轨道、问题/停用筛选、通配符搜索、富信息文件卡片、单项操作、批量选择/反选/取消、关系视图、字段修补弹窗和模型列举弹窗。`GatewayAuthFileSchema` 已显式承载 disabled、prefix、proxyUrl、priority、headers、note、authIndex、size/status/success/failed 等认证文件投影；字段修补表单提交 `PATCH /auth-files/fields`，CLIProxy adapter 会把 disabled 映射到 `/auth-files/status`，把 prefix/proxyUrl/priority/headers/note 映射到 `/auth-files/fields`。模型列举必须通过弹窗结果面板展示 `GET /auth-files/:id/models` 的模型数量、模型列表和错误状态。OAuth 页面展示 Codex、Anthropic、Antigravity、Gemini CLI、Kimi 授权登录，调用 provider OAuth start、Gemini CLI start、status 和 callback，并在页面内维护授权链接、state、provider-native callback URL / device user code 和提交状态。点击开始登录时要同步打开 OAuth 新标签，拿到授权 URL 后自动导航；手动回调输入示例必须保留上游原生本地端口，例如 Codex `localhost:1455`、Anthropic `localhost:54545`、Antigravity `localhost:51121`、Gemini CLI `localhost:8085`，不能统一替换成 Agent Gateway callback。前端文案已切换为 Agent Gateway 自有中文管理中心命名。
- Auth Files 行为边界：状态切换入口支持显式 `disabled` 值；当 `disabled` 未传时按当前列表状态自动取反并兜底为 `true`，以保证“单条/批量”与无参数回调场景都不误判状态。
- Built-in OAuth callback：默认 memory / fallback 模式的 provider OAuth start 生成 provider-native 授权链接，不能把 agent-server 自己的 `/api/agent-gateway/oauth/callback` 当作用户要打开的授权链接。Codex 必须指向 `auth.openai.com` 并回跳 `localhost:1455/auth/callback`，Anthropic 必须指向 `claude.ai` 并回跳 `localhost:54545/callback`，Antigravity 必须指向 Google OAuth 并回跳 `localhost:51121/oauth-callback`。真实 CLI Proxy adapter 模式若返回 callback 占位链接，也会在 service 层统一兜底改写为对应 provider 的原生授权链接。
- Restored route wiring：`App.tsx` 通过 `@tanstack/react-query` 读取 snapshot、logs、usage、usage analytics、API keys、raw config、dashboard、clients、quota detail、runtime health、system info、system models、provider configs 和 auth files，`GatewayWorkspace` 只向页面传递 schema-first props 和回调；`GatewayWorkspacePages.tsx` 只保留 thin compatibility wrapper，真实页面接线在 `src/app/routes/gateway-page-wiring.tsx`。`/usage` 页面消费 `GatewayUsageAnalyticsResponseSchema`，从 runtime request logs 展示使用统计概览、趋势、请求日志、Provider 统计和模型统计，不允许使用静态统计样例。所有成功写入后 invalidates `['agent-gateway']` 查询前缀，避免静态样例与真实后端状态分叉。页面回调如果没有拿到 `AgentGatewayApiClient` 必须显式失败，不允许 fallback 到 demo migration preview/apply、OAuth payload、auth file upload、provider/model 样例、provider test result 或 raw CPAMC client。
- Dashboard：`DashboardPage` 已接入 workspace，用 `GatewayDashboardSummaryResponseSchema` 展示连接、API Base、版本、管理密钥、认证文件、provider 凭据、模型数量和 routing 摘要。
- Quota Detail：`QuotaDetailPage` 已接入 workspace，用 `GatewayQuotaDetailListResponseSchema` 展示通过 management `api-call` 归一化的 provider-specific quota projection。
- Gap contracts：`agent-gateway-cli-proxy-parity.schemas.ts` 已补 dashboard summary、provider-specific config、OAuth model alias rule、Vertex credential import、management api-call、request-log setting、clear-login-storage、Ampcode upstream/model mapping 的 schema-first contract。
- External import mode：`AgentGatewayModule` 默认仍使用 deterministic memory management implementation；显式设置 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy`、`AGENT_GATEWAY_MANAGEMENT_API_BASE`、`AGENT_GATEWAY_MANAGEMENT_KEY` 后会使用 `CliProxyManagementClient` 导入 / 归一化已有 CLIProxyAPI 管理面数据。Migration apply report 已固定为 imported/skipped/failed/warnings，默认只导入 safe resources；unsafe conflicts 需要 `confirmUnsafeConflicts=true`，且报告不得包含 management key、raw upstream config、raw auth file 内容或可调用明文 secret。该模式不得作为 `/v1/models` 或 `/v1/chat/completions` 的运行时依赖。

## 仍不覆盖

- 生产 OpenAI-compatible relay 流量转发、计费、长期持久化和数据库迁移仍不属于本 parity surface。
- Auth Files 的 OAuth excluded、recent request 状态条、quota 专属卡片和 raw auth file 下载预览编辑尚未完全覆盖；这些能力需要继续扩展 `@agent/core` schema、后端 adapter 和 `AgentGatewayApiClient`，再进入 UI。`disabled` 启停语义与 prefix/proxy/header/note 字段已进入稳定 `GatewayAuthFile` projection，不再只依赖 metadata 保守展示。
- `CliProxyManagementClient` 对真实 vendor payload 采用保守 normalizer；新增 CLI Proxy 字段时必须先扩展 `@agent/core` schema 和 adapter 测试，再暴露给 controller/UI。
- Backend `clearLoginStorage` 只是 command projection；真实清理只允许由前端 auth storage helper 处理，后端不得触碰 Chrome profile、Cookie、Local Storage、Session Storage、IndexedDB 或站点缓存目录。

## 验证入口

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm check:docs
```
