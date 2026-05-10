# Agent Gateway Backend

状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/domains/agent-gateway`、`apps/backend/agent-server/src/api/agent-gateway`
最后核对：2026-05-10

`agent-server` 已提供 Agent Gateway 中转入口，契约以 [Agent Gateway API](/docs/contracts/api/agent-gateway.md) 和 `@agent/core` 的 `contracts/agent-gateway` schema 为准。当前实现包含 schema-first 读写接口、Gateway 调用方与调用方 API key、调用方月度额度、OpenAI-compatible `/v1/models` 与 `/v1/chat/completions` runtime、repository 边界、secret vault、provider router、deterministic relay runtime、日志/用量记录、deterministic OAuth/Auth File 生命周期第一版，以及 CLI Proxy management parity 的 deterministic connection/config/API key/quota/log/system surface。

本主题主文档是 [Agent Gateway API](/docs/contracts/api/agent-gateway.md)。本文只覆盖 `agent-server` 内已落地的后端模块、边界和验证入口。

当前入口：

- `AgentGatewayModule`：`apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- `AgentGatewayAuthGuard`：负责将统一 Identity access token 校验为 Gateway API 访问会话，并把 Identity roles 投影为 Gateway `admin` / `operator` / `viewer`。
- `AgentGatewayAuthService`：迁移兼容服务，仅保留旧 `/agent-gateway/auth/*` 本地双 token 入口；新前端不再调用。
- `AgentGatewayService`：负责 runtime/config/provider/auth-file/quota projection、写命令、logs、usage、probe、token count、preprocess 与 usage accounting 的领域编排。
- `AgentGatewayManagementClient`：项目自定义 management client 边界；默认实现 `MemoryAgentGatewayManagementClient`。显式配置 real mode 后使用 `CliProxyManagementClient` 访问真实 CLI Proxy `/v0/management`，并在进入 controller 前归一化为 `@agent/core` schema。
- `AgentGatewayConnectionService`：保存 remote management profile 并检查连接状态，只返回 masked management key。
- `AgentGatewayConfigFileService`：读取、diff、保存 raw `config.yaml` 和 reload projection。
- `AgentGatewayApiKeyService`：管理 proxy API keys，查询只返回 `GatewayApiKeyListResponseSchema` 的 masked prefix 与 usage projection。
- `AgentGatewayClientService` / `AgentGatewayClientApiKeyService` / `AgentGatewayClientQuotaService`：管理作为中转调用方的 Gateway clients、一次性展示的 client API key、终态 revoke、月度 token/request quota、usage 和 `/v1/*` request logs。Identity 用户只用于控制台登录，不等同于 runtime 调用方。
- `AgentGatewayOpenAICompatibleController`：挂载不带 `/api` 前缀的 `GET /v1/models` 与 `POST /v1/chat/completions`。runtime 使用 `Authorization: Bearer <client-api-key>`，不接受 Identity access token 作为调用方凭据。
- `AgentGatewayRuntimeAuthService` / `AgentGatewayRuntimeAccountingService`：负责 client key scope、过期、client 状态、默认额度、显式额度、usage、lastUsedAt 和 request log 记录；runtime 错误统一返回 OpenAI-compatible `{ error: { message, type, code } }` 外壳。
- `AgentGatewayLogService`：提供 request log tail/search、request error files 和 clear logs projection。
- `AgentGatewayQuotaDetailService`：提供 provider-specific quota detail 的稳定 projection。
- `AgentGatewaySystemService`：提供 system version/latest/build links 与 grouped model discovery projection。
- `AgentGatewayRelayService`：负责 relay 请求的 provider 选择、mock provider 调用、日志和用量记录。
- `AgentGatewayOAuthService`：负责 deterministic OAuth start/complete 与 credential file 状态更新。
- `AgentGatewayAuthController`：挂载迁移兼容的 `POST /api/agent-gateway/auth/login` 与 `POST /api/agent-gateway/auth/refresh`。规范登录入口是 Identity 的 `/api/identity/login`、`/api/identity/refresh`、`/api/identity/me` 和 `/api/identity/logout`。
- `AgentGatewayController`：挂载基础 runtime/provider/auth-file/quota/log/usage/probe/token/preprocess/accounting/relay/OAuth 入口，并挂载 connection、raw config、API keys、quota details、logs 和 system 基础入口。
- `AgentGatewayManagementController`：挂载 CLI Proxy parity 管理入口，包括 dashboard、provider-specific config、Auth Files、OAuth provider auth-url start、OAuth model aliases/callback/status/Vertex import、`api-call` quota refresh、request log download、latest-version、request-log setting 和 frontend-local login storage cleanup projection。
- `AgentGatewayOAuthCallbackController`：保留未鉴权的浏览器回跳入口 `GET /api/agent-gateway/oauth/callback`，仅作为手动 fallback 或部署自定义 callback base 时使用。默认 provider OAuth start 保留 CLI Proxy 返回的本地回调端口 URL，例如 Codex `localhost:1455`、Claude `localhost:54545`、Antigravity `localhost:51121`。

## Real CLI Proxy Mode

默认管理面使用 deterministic memory client，便于本地和测试闭环。需要连接真实 CLI Proxy management API 时，显式设置：

```bash
AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy
AGENT_GATEWAY_MANAGEMENT_API_BASE=<base-url>
AGENT_GATEWAY_MANAGEMENT_KEY=<key>
```

`CliProxyManagementClient` 会把 `<base-url>` 归一化到 `/v0/management`，同时发送 `Authorization: Bearer <key>` 与 `X-Management-Key: <key>` 调用参考项目接口，并把 provider config、Auth Files、OAuth、quota、logs、system 等 vendor payload 转换为项目自有 schema 后再返回给 controller。

## 当前实现边界

- Provider、Credential File、Quota、logs、usage 当前通过 `AgentGatewayRepository` 边界读写，默认实现是内存 repository。
- `preprocess` 和 `accounting` 当前仍是确定性 helper；`relay` 已提供 deterministic mock provider 闭环，尚不是生产 vendor SDK 转发。
- Controller 必须继续只做 schema parse、HTTP 错误映射和 service 调用；不得内联 provider SDK 调用、OAuth vendor payload 或 secret 处理。
- 查询 projection 不返回明文 secret、raw request body、raw provider response 或未过滤 headers。

## 领域边界

- `repositories/`：runtime config、providers、credential files、quotas、logs、usage、OAuth state 的 repository contract 与内存实现。
- `management/`：remote management profile、raw config、API keys、provider-specific config、Auth Files、OAuth auth-url/status/callback/policy、quota detail、request logs、system info/model discovery 的项目自定义 client 边界；不得让 CLI Proxy raw response 直接穿透 controller 或 UI。`cli-proxy-management-client.ts` 负责 `/v0/management` base URL normalize、management key 双 header、schema normalization 和上游错误映射；OAuth provider start 会把 `POST /api/agent-gateway/oauth/:providerId/start` 归一化为 CLI Proxy 的 `/:provider-auth-url?is_webui=true` 调用。
- OAuth provider start 不改写 CLI Proxy 返回的授权 URL。Codex、Claude、Antigravity 依赖 CLI Proxy WebUI flow 启动的本地 callback forwarder；Kimi 使用 device authorization URL 和 `user_code`。
- API keys adapter 对齐 CLI Proxy 原生协议：`GET /api-keys` 读取 `{ "api-keys": [...] }`，`PUT /api-keys` 提交字符串数组，`PATCH /api-keys` 提交 `{ index, value }`，`DELETE /api-keys?index=<n>` 删除。
- Auth Files adapter 对齐 CLI Proxy 原生协议：上传按文件逐个调用 `POST /auth-files?name=<file.json>` 并提交原始 JSON 内容；删除使用 `DELETE /auth-files?name=<file>`、`DELETE /auth-files?all=true` 或字符串数组 body。
- System connection check 使用 CLI Proxy 真实存在的 `GET /config` 与 `X-CPA-VERSION` / `X-CPA-BUILD-DATE` 响应头；latest version 使用 `GET /latest-version`。
- `config/`、`api-keys/`、`logs/`、`quotas/`、`system/`：围绕 management client 的领域 service facade，controller 只调用这些 facade。
- `providers/`：项目自定义 provider adapter 接口和 deterministic mock provider，不泄漏 vendor SDK 类型。
- `runtime/agent-gateway-router.ts`：按 routing strategy、provider status、priority 和 requested model 选择 provider。
- `runtime/agent-gateway-relay.service.ts`：执行 `preprocess -> route -> provider adapter -> accounting -> log`。
- `runtime/agent-gateway-runtime-auth.service.ts` 与 `runtime/agent-gateway-runtime-accounting.service.ts`：只服务 OpenAI-compatible `/v1/*` 调用方鉴权和额度记账；默认额度为 `1_000_000` token / `10_000` request，并以当前 usage 计算是否超额。
- `secrets/`：明文 secret 只出现在写命令入口，落库或 projection 只保留 masked value / `secretRef`。
- `oauth/agent-gateway-oauth.service.ts`：提供 deterministic start/complete 第一实现，vendor-specific OAuth 细节留在 adapter 层。
- `test/agent-gateway/agent-gateway.module.spec.ts`：覆盖 `AgentGatewayModule` 的 Nest DI smoke；新增 provider、service 或可选测试时钟等构造参数时，必须通过显式 token 或非构造注入方式避免让 `Function` / `String` 这类裸类型进入 Nest provider 解析。

认证配置：

- Agent Gateway Console 当前接入统一 Identity，不再直接初始化独立数据库用户，也不再使用 `AGENT_GATEWAY_ADMIN_USERNAME` / `AGENT_GATEWAY_ADMIN_PASSWORD` 作为规范登录来源。
- 本地开发账号由 Identity 域负责；需要种子管理员时配置 `IDENTITY_ADMIN_USERNAME` / `IDENTITY_ADMIN_PASSWORD` / `IDENTITY_ADMIN_DISPLAY_NAME`，或通过 Identity 用户管理 API 创建。
- `AGENT_GATEWAY_AUTH_SECRET`、`AGENT_GATEWAY_ADMIN_USERNAME`、`AGENT_GATEWAY_ADMIN_PASSWORD` 只服务旧 `/api/agent-gateway/auth/*` 兼容入口；不要在新代码或新文档中把它们作为 Gateway Console 登录方式。

边界约束：

- Controller 只接收/返回稳定 contract，不直接处理 CLI Proxy raw payload。
- token 计算当前是 deterministic fallback，不引入第三方 tokenizer；接入真实 tokenizer 时必须先通过 provider/adapter 边界转换为 `TokenCountResult`。
- preprocess 阶段负责输入标准化与 input token 估算；postprocess/accounting 只返回 usage summary，不保存 raw provider response、secret、headers 或完整请求体。
- Provider、Credential File、Quota 写操作、deterministic OAuth 与 deterministic relay 已接线；后续接真实 vendor SDK、持久化数据库或 provider-specific OAuth 时，必须先补 core schema、adapter 测试和文档。

验证入口：

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```
