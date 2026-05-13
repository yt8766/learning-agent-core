# Agent Gateway Backend

状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/domains/agent-gateway`、`apps/backend/agent-server/src/api/agent-gateway`
最后核对：2026-05-11

`agent-server` 已提供 Agent Gateway 中转入口，契约以 [Agent Gateway API](/docs/contracts/api/agent-gateway.md) 和 `@agent/core` 的 `contracts/agent-gateway` schema 为准。当前实现包含 schema-first 读写接口、Gateway 调用方与调用方 API key、调用方月度额度、OpenAI-compatible `/v1/models` 与 `/v1/chat/completions` embedded runtime engine、repository 边界、secret vault、provider router、runtime quota/usage audit、日志/用量记录、通过 provider adapter 隔离的 OAuth/Auth File 生命周期、可配置真实 OAuth token exchange / device polling 边界、真实 provider executor HTTP client 边界，以及 CLI Proxy management parity 的 connection/config/API key/quota/log/system surface。显式 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 时，system models 与 quota refresh 走真实 CLI Proxy management client；未接入真实上游时才允许 memory/deterministic harness 作为本地 smoke。

本主题主文档是 [Agent Gateway API](/docs/contracts/api/agent-gateway.md)。本文只覆盖 `agent-server` 内已落地的后端模块、边界和验证入口。

当前入口：

- `AgentGatewayModule`：`apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- `AgentGatewayAuthGuard`：负责将统一 Identity access token 校验为 Gateway API 访问会话，并把 Identity roles 投影为 Gateway `admin` / `operator` / `viewer`。
- `AgentGatewayAuthService`：迁移兼容服务，仅保留旧 `/agent-gateway/auth/*` 本地双 token 入口；新前端不再调用。
- `AgentGatewayService`：负责 runtime/config/provider/auth-file/quota projection、写命令、logs、usage、probe、token count、preprocess 与 usage accounting 的领域编排。
- `AgentGatewayUsageAnalyticsService`：负责管理面 `GET /api/agent-gateway/usage/analytics` 聚合，从 client repository 的 `GatewayClientRequestLog` 生成使用统计 summary、trend、request logs、Provider 统计、模型统计和筛选项；不得读取 raw provider payload 或合成不存在的成本/cache token。
- `AgentGatewayManagementClient`：项目自定义 management client 边界；默认实现 `MemoryAgentGatewayManagementClient`。显式配置 real mode 后使用 `CliProxyManagementClient` 访问真实 CLI Proxy `/v0/management`，并在进入 controller 前归一化为 `@agent/core` schema。
- `AgentGatewayConnectionService`：保存 remote management profile 并检查连接状态，只返回 masked management key。
- `AgentGatewayConfigFileService`：读取、diff、保存 raw `config.yaml` 和 reload projection。
- `AgentGatewayApiKeyService`：管理 proxy API keys，查询只返回 `GatewayApiKeyListResponseSchema` 的 masked prefix 与 usage projection。
- `AgentGatewayClientService` / `AgentGatewayClientApiKeyService` / `AgentGatewayClientQuotaService`：管理作为中转调用方的 Gateway clients、一次性展示的 client API key、终态 revoke、月度 token/request quota、usage 和 `/v1/*` request logs。Identity 用户只用于控制台登录，不等同于 runtime 调用方。
- `RuntimeEngineModule` / `RuntimeEngineFacade`：`agent-server` 内建 CLIProxyAPI runtime engine 的稳定入口，当前负责 runtime health、OpenAI Chat/Responses invocation、stream event、runtime quota precheck、usage audit queue、cooldown projection 和 OpenAI-compatible 错误映射。管理面和 `/v1/*` controller 只能调用 facade，不直接执行 CLI 子进程或连接外部 CLIProxyAPI。
- `AgentGatewayOpenAICompatibleController`：挂载不带 `/api` 前缀的 `GET /v1/models` 与 `POST /v1/chat/completions`。runtime 使用 `Authorization: Bearer <client-api-key>`，不接受 Identity access token 作为调用方凭据。
- `AgentGatewayRuntimeAuthService` / `AgentGatewayRuntimeAccountingService`：负责 client key scope、过期、client 状态、默认额度、显式额度、usage、lastUsedAt 和 request log 记录；runtime 错误统一返回 OpenAI-compatible `{ error: { message, type, code } }` 外壳。
- `AgentGatewayLogService`：提供 request log tail/search、request error files 和 clear logs projection。
- `AgentGatewayQuotaDetailService`：提供 provider-specific quota detail 的稳定 projection。
- `AgentGatewaySystemService`：提供 system version/latest/build links 与 grouped model discovery projection。
- `AgentGatewayRelayService`：负责 legacy relay smoke 请求的 provider 选择、deterministic provider 调用、日志和用量记录；不再作为 `/v1/*` 规范 runtime。
- `AgentGatewayOAuthService`：负责 OAuth provider adapter 路由、flow state、Auth File metadata projection、credential secret vault 写入和 status/callback 生命周期。
- `AgentGatewayAuthController`：挂载迁移兼容的 `POST /api/agent-gateway/auth/login` 与 `POST /api/agent-gateway/auth/refresh`。规范登录入口是 Identity 的 `/api/identity/login`、`/api/identity/refresh`、`/api/identity/me` 和 `/api/identity/logout`。
- `AgentGatewayController`：挂载基础 runtime/provider/auth-file/quota/log/usage/probe/token/preprocess/accounting/relay/OAuth 入口，并挂载 connection、raw config、API keys、quota details、logs 和 system 基础入口。
- `AgentGatewayManagementController`：挂载 CLI Proxy parity 管理入口，包括 dashboard、provider-specific config、Auth Files、OAuth provider auth-url start、OAuth model aliases/callback/status/Vertex import、`api-call` quota refresh、request log download、latest-version、request-log setting 和 frontend-local login storage cleanup projection。
- `AgentGatewayOAuthCallbackController`：保留未鉴权的浏览器回跳入口 `GET /api/agent-gateway/oauth/callback`，只解析 `provider`、`state`、`code` / `error` 和原始 redirect URL 后交给 `AgentGatewayOAuthService`。Controller 不处理 raw token，也不写 Auth File 或 secret vault。

## Management Parity Surface

`2026-05-11` 后端管理面 parity 已按 CLI Proxy Management Center 的稳定投影收敛，controller 与 service 的 ownership 如下：

| Endpoint                                                                                                 | Controller owner                                              | Service boundary                                                                          | Response schema                                                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/agent-gateway/config/raw` / `PUT /api/agent-gateway/config/raw`                                | `AgentGatewayController`                                      | `AgentGatewayConfigFileService.readRawConfig/saveRawConfig`                               | `GatewayRawConfigResponseSchema`                                                                |
| `GET /api/agent-gateway/provider-configs` / `PUT /api/agent-gateway/provider-configs/:providerId`        | `AgentGatewayManagementController`                            | `AgentGatewayProviderConfigService.list/saveProviderConfig`                               | `GatewayProviderSpecificConfigListResponseSchema` / `GatewayProviderSpecificConfigRecordSchema` |
| `GET /api/agent-gateway/auth-files` / `POST /api/agent-gateway/auth-files`                               | `AgentGatewayManagementController`                            | `AgentGatewayAuthFileManagementService.list/uploadAuthFiles`                              | `GatewayAuthFileListResponseSchema` / `GatewayAuthFileBatchUploadResponseSchema`                |
| `GET /api/agent-gateway/quotas/details` / `POST /api/agent-gateway/quotas/details/:providerKind/refresh` | `AgentGatewayController` / `AgentGatewayManagementController` | `AgentGatewayQuotaDetailService.list` / `AgentGatewayApiCallService.refreshProviderQuota` | `GatewayQuotaDetailListResponseSchema`                                                          |
| `GET /api/agent-gateway/logs/tail` / `DELETE /api/agent-gateway/logs`                                    | `AgentGatewayController`                                      | `AgentGatewayLogService.tail/clearLogs`                                                   | `GatewayRequestLogListResponseSchema` / `GatewayClearLogsResponseSchema`                        |
| `GET /api/agent-gateway/system/models`                                                                   | `AgentGatewayController`                                      | `AgentGatewaySystemService.models`                                                        | `GatewaySystemModelsResponseSchema`                                                             |
| `POST /api/agent-gateway/oauth/:providerId/start`                                                        | `AgentGatewayManagementController`                            | `AgentGatewayOAuthPolicyService.startProviderOAuth`                                       | `GatewayProviderOAuthStartResponseSchema`                                                       |

这些管理接口的 controller 必须保持 thin：只做 body/query/param 的 `@agent/core` schema parse、调用 service、返回前用 matching response/projection schema parse。provider raw payload、Auth File 内容解析、OAuth provider 差异、quota source 和 log projection 都留在 domain service 或 management adapter 内，不能在 controller 内展开。

管理 service 必须保证 secret projection：

- `apiKey`、`accessToken`、`refreshToken`、`authorization`、raw Auth File content、raw provider response 和敏感 headers 不得出现在序列化 HTTP response 中。
- 可展示凭据只允许使用 `apiKeyMasked`、`maskedSecret`、`secretRef`、`credentialId`、`authIndex` 等稳定字段。
- Auth File `metadata` 只允许 `string | number | boolean | null`；数组或对象类 provider 原始内容必须在 service projection 中转为可展示字符串或被丢弃，不能穿透到公共 schema。
- Delegate client 返回值即使来自 `MemoryAgentGatewayManagementClient` 或 `CliProxyManagementClient`，进入 controller 前也必须再次通过 matching schema parse。

Management adapter 与 runtime 的职责分离：

- `management/` 目录下的 client/service 只负责控制台管理：config、provider config、Auth Files、OAuth start/status/callback、quota details、request logs 和 system models。
- `runtime-engine/` 是 `/v1/*` 的内建执行主链，负责 protocol normalization、executor routing、streaming、runtime auth/accounting 和 provider call adapter。
- `CliProxyManagementClient` 可以作为迁移与上游管理 API adapter，但不是默认 runtime executor；`AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 只改变 management/system/quota 读取来源，不允许让 `/v1/chat/completions` 依赖外部 CLIProxyAPI server。

## Embedded Runtime Engine

Agent Gateway 现在把 `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/` 视为规范 CLIProxyAPI 实现。runtime engine 拥有协议归一、executor routing、HTTP/process client 边界、streaming 转换、OAuth/auth-file 生命周期、runtime quota precheck 与 usage audit queue。Controller、management service 和前端只能依赖 runtime-engine facade 与 `@agent/core` contract；不得直接运行 CLI 子进程、穿透 vendor SDK 类型、或把外部 CLIProxyAPI server 当作 `/v1/*` 默认运行时。

`RuntimeEngineFacade.health()` 必须返回 `GatewayRuntimeHealthResponseSchema`：整体 status、checkedAt、executor health、top-level activeRequests、activeStreams、usageQueue `{ pending, failed }` 和 cooldowns。`usageQueue` 只统计已经进入 facade 的 runtime invocation；`/v1/models` 的调用方 accounting 不会伪造成 provider invocation。Quota deny 会以项目自有 cooldown projection 暴露 `quota_exceeded`，不得把 vendor rate-limit headers、SDK error 或 raw provider payload 放入 health。

真实 provider executor 边界：

- `executors/gateway-runtime-executor-http-client.ts` 是 provider HTTP 调用边界。executor 只能接收 `{ status, headers, body, stream }` 这类项目自定义响应，不得把 raw vendor response、headers、SDK error 或 secret 传给 facade/controller。
- `OpenAICompatibleRuntimeExecutor` 通过 `baseUrl`、`apiKeySecretRef`、`modelAliases`、`GatewayRuntimeExecutorHttpClient` 和 `resolveSecret(secretRef)` 执行 OpenAI-compatible `/chat/completions` 与 `/responses`；模型发现走 `/models`，公开模型 alias 会映射到 provider model。
- `ProviderRuntimeExecutor` 提供 Claude、Gemini、Kimi、Antigravity、Codex 等 provider 的统一 executor interface、错误归一、模型发现和 stream event projection。当前 fake-client 测试覆盖接口契约；真实 provider payload 细节仍必须在 adapter 层继续补齐。
- `DeterministicOpenAICompatibleExecutor` 只允许作为 CI/local fallback harness，不是 production executor，不得用于宣称真实 vendor runtime 已接通。

中心信息的模型列表必须走真实 discovery：显式 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 时，`AgentGatewaySystemService.models()` 必须优先调用 `CliProxyManagementClient.discoverModels()`，把真实 CLIProxyAPI management 返回的模型投影为 `GatewaySystemModelsResponse`；本地/内建 runtime 模式才调用 `RuntimeEngineFacade.listModels()`。前端只展示该接口返回的模型，不得再用 snapshot provider families 或 memory helper 合成“看起来像真实”的模型列表。

## External CLIProxyAPI Import Mode

`CliProxyManagementClient` 只作为迁移 / 导入 adapter：它可以从已有 CLIProxyAPI 实例读取 config、provider config、Auth Files、API keys、quota snapshots、request logs 和 system 信息，并把 raw response 归一化为项目稳定 schema。它不是默认 Agent Gateway runtime，也不得成为 `/v1/models` 或 `/v1/chat/completions` 的必要依赖。需要显式导入真实 CLI Proxy management API 时，设置：

```bash
AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy
AGENT_GATEWAY_MANAGEMENT_API_BASE=<base-url>
AGENT_GATEWAY_MANAGEMENT_KEY=<key>
```

`CliProxyManagementClient` 会把 `<base-url>` 归一化到 `/v0/management`，同时发送 `Authorization: Bearer <key>` 与 `X-Management-Key: <key>` 调用参考项目接口，并把 provider config、Auth Files、OAuth、quota、logs、system 等 vendor payload 转换为项目自有 schema 后再返回给 controller。quota refresh 不再构造 deterministic placeholder：`refreshQuotaDetails(providerKind)` 必须通过 `/api-call` management 边界读取上游 provider/auth-file/model 额度，并归一化为 `GatewayQuotaDetailListResponse`；返回项的 `id` 采用 `provider:authFile:model:window` 形态时，前端可追踪到对应 auth file。

真实 CLIProxyAPI 导入必须走 preview -> apply 两步：

1. 调用 migration preview，读取远端 config、provider config、Auth Files、masked API key metadata、quota snapshots 和 request logs，只返回 `GatewayMigrationPreviewSchema`。
2. 检查 `conflicts`。Auth File 本地已存在、API key 仅有 masked prefix 等 unsafe 项默认不会写入；需要导入 masked API key metadata 时必须显式设置 `confirmUnsafeConflicts=true`。
3. 调用 migration apply。重复导入同一个 upstream API key 时按 source id 幂等跳过，不重复创建本地 client key；provider/quota/log 继续按 repository upsert/append 语义处理。apply report 必须包含 imported/skipped/failed/warnings，但不得包含 source management key、raw upstream config、raw auth file path/content、OAuth token 或可调用 API key secret。

迁移 adapter 对真实 CLIProxyAPI 字段差异采用兼容解析：额外字段会被忽略；缺少非关键展示字段时使用稳定默认值；masked API key 只作为 prefix/metadata 导入，不能还原为可调用明文 secret。即使 `confirmUnsafeConflicts=true`，导入的 masked upstream key 也必须是 `disabled` client API key metadata，不能被 runtime auth 当作 active secret 使用；真实可调用 key 必须由本地 `POST /api/agent-gateway/clients/:clientId/api-keys` 重新生成。

## Production Persistence

Agent Gateway repository / client repository / secret vault 默认仍使用内存实现，适合本地 smoke。生产启用 Postgres 时设置：

```bash
AGENT_GATEWAY_PERSISTENCE=postgres
AGENT_GATEWAY_DATABASE_URL=postgres://...
```

`AGENT_GATEWAY_DATABASE_URL` 缺省时会回退到 `DATABASE_URL`；`AGENT_GATEWAY_PERSISTENCE` 缺省时会跟随 `BACKEND_PERSISTENCE`。只要解析结果是 `postgres`，`AgentGatewayModule` 会同时切换：

- `AGENT_GATEWAY_REPOSITORY` -> `PostgresAgentGatewayRepository`
- `AGENT_GATEWAY_CLIENT_REPOSITORY` -> `PostgresAgentGatewayClientRepository`
- `AGENT_GATEWAY_SECRET_VAULT` -> `PostgresAgentGatewaySecretVault`

上线前必须确保数据库已经应用 runtime schema，至少包含：

- `agent_gateway_records`
- `agent_gateway_client_records`
- `agent_gateway_secrets`

这些表的当前 SQL 定义位于 `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts`。生产环境不要依赖 Nest 启动时自动建表；应由部署流程先执行 DB migration / runtime schema apply，再启动 `agent-server`。`agent_gateway_secrets.secret_value` 存放 provider secret ref 与 Auth File 内容，生产库必须使用受控访问、备份加密和最小权限账号。

## 当前实现边界

- Provider、Credential File、Quota、logs、usage 当前通过 `AgentGatewayRepository` 边界读写，默认实现是内存 repository；配置 `AGENT_GATEWAY_PERSISTENCE=postgres` 后切换到 Postgres repository 与 Postgres secret vault。
- `preprocess` 和 `accounting` 当前仍是确定性 helper；`relay` 只保留为 legacy deterministic smoke 闭环，尚不是生产 vendor SDK 转发。生产 provider 调用必须进入 `runtime-engine/executors/*` 的 HTTP/process client 边界。
- Controller 必须继续只做 schema parse、HTTP 错误映射和 service 调用；不得内联 provider SDK 调用、OAuth vendor payload 或 secret 处理。
- 查询 projection 不返回明文 secret、raw request body、raw provider response 或未过滤 headers。

## Production Readiness Contracts

`2026-05-11` 的生产迁移计划把后续可用标准固定为 contract-first：

- Runtime executor 配置必须通过 `GatewayRuntimeExecutorConfigSchema` 暴露。生产 executor 可以读取 `secretRef`、命令 profile、base URL 和模型别名，但不得把 CLI stderr、vendor raw response、SDK error 对象或 headers 返回到 controller/UI。
- OAuth 登录后的凭证必须通过 `GatewayOAuthCredentialRecordSchema` 投影。后端只向页面返回 `secretRef`、账号、项目、scope、过期时间、状态和检查时间；真实 access token / refresh token 只能存在 secret vault 或 auth file 存储边界。
- Provider/auth-file/model 额度必须通过 `GatewayProviderQuotaSnapshotSchema` 或 CLI Proxy `/api-call` quota source 投影。默认 memory quota 只能作为开发 smoke，不等同于登录账号的真实额度；真实上游模式下不得返回固定 provider placeholder 伪装成账号额度。
- CLIProxyAPI 导入必须先返回 `GatewayMigrationPreviewSchema`，用户确认后再返回 `GatewayMigrationApplyResponseSchema`。导入 adapter 可以读取上游 raw payload，但进入 repository 前必须归一化为 `@agent/core` schema。

`2026-05-11` 已完成的 production-readiness 切片包括：durable repository / secret vault 边界、OAuth adapter 生命周期、runtime executor facade、provider executor HTTP client 边界、provider quota inspector、CLIProxyAPI migration preview/apply、前端迁移页面，以及端到端 smoke：CLIProxyAPI metadata import -> 创建 runtime client key -> `/v1/models` -> `/v1/chat/completions` -> usage/log/client quota/provider quota 可见。固定回归入口见 [Agent Gateway Production Smoke](/docs/apps/backend/agent-server/agent-gateway-production-smoke.md)。

仍不能把当前实现描述为“真实生产 vendor 全替代”的范围：

- production vendor OAuth 已有项目自有 `GatewayOAuthHttpClient`、fetch-backed client、provider config 和 callback/device poll 写 vault 边界；但默认 DI 尚未读取生产环境变量并装配真实 provider config，未配置时仍使用 deterministic provider harness 作为 CI fallback；
- runtime executor 已有 facade、协议归一、OpenAI-compatible HTTP executor、provider executor interface、错误归一和 stream projection fake-client 回归；但默认 DI 仍注册 deterministic local harness 作为 CI fallback，尚未按生产环境变量装配真实 provider credentials；
- provider quota inspector 已能从 Auth File projection 计算 provider/auth-file/model 额度；CLI Proxy management mode 已通过 `/api-call` quota source 读取真实上游额度，其他内建真实账号额度抓取仍取决于后续 provider adapter；
- Postgres repository / secret vault 已可通过 `AGENT_GATEWAY_PERSISTENCE=postgres` 生产启用；部署前仍必须完成数据库 schema migration 和 secret 存储访问策略配置。

## 领域边界

- `repositories/`：runtime config、providers、credential files、quotas、logs、usage、OAuth state 的 repository contract 与内存实现。
- `management/`：remote management profile、raw config、API keys、provider-specific config、Auth Files、OAuth auth-url/status/callback/policy、quota detail、request logs、system info/model discovery 的项目自定义 client 边界；不得让 CLI Proxy raw response 直接穿透 controller 或 UI。`cli-proxy-management-client.ts` 负责 `/v0/management` base URL normalize、management key 双 header、schema normalization 和上游错误映射；`cli-proxy-management-client.quota.ts` 负责 `/api-call` quota refresh payload 归一化；OAuth provider start 会把 `POST /api/agent-gateway/oauth/:providerId/start` 归一化为 CLI Proxy 的 `/:provider-auth-url?is_webui=true` 调用。
- 内建 OAuth adapter 位于 `runtime-engine/oauth/`，当前覆盖 `codex`、`claude`、`gemini-cli`、`antigravity` 和 `kimi`。`createDefaultGatewayOAuthProviders` 在收到 `providerConfigs + httpClient` 时创建 `ConfigurableGatewayOAuthProvider`，否则回退 deterministic provider harness。配置字段包括 `clientId`、`clientSecret`、`authUrl`、`tokenUrl`、`deviceUrl`、`scopes`、`publicBaseUrl` 和 `flow`。
- Codex、Claude 和 Antigravity 默认走 authorization code，内建 fallback 生成 provider-native authorize URL，而不是 Agent Gateway callback URL：Codex 回跳 `http://localhost:1455/auth/callback`，Claude 回跳 `http://localhost:54545/callback`，Antigravity 回跳 `http://localhost:51121/oauth-callback`。收到生产 `providerConfigs + GatewayOAuthHttpClient` 后，`start` 才使用配置化 `authUrl`、`clientId`、`scopes`、`state` 与 `${publicBaseUrl}/api/agent-gateway/oauth/callback` 生成可由 Agent Gateway 直接完成 token exchange 的授权 URL；`completeCallback` 只通过项目自有 `GatewayOAuthHttpClient.exchangeAuthorizationCode` 调用 `tokenUrl`，并把返回 token 归一化为 credential projection。Gemini CLI 走单独 start 入口。
- Kimi 走 device flow，`start` 不要求 callback URL 输入，只通过 `GatewayOAuthHttpClient.startDeviceAuthorization` 获取 `verificationUri` / `userCode` / 内部 `deviceCode`；`status` 在 pending 时通过 `GatewayOAuthHttpClient.pollDeviceToken` 轮询 `tokenUrl`，收到 token 后立刻写 secret vault 并把 flow 标记为 `completed`。内部 `deviceCode` 不随 `start` 响应返回前端。
- OAuth callback 或 device poll 完成后，raw `access_token` / `refresh_token` 只能写入 `AgentGatewaySecretVault.writeCredentialFileContent`，Auth File 查询投影只保留 `id`、`provider`、`path`、`status` 和 `lastCheckedAt`。当前 vault 同时写入 provider 级 `secretRef`，用于后续 runtime executor 按稳定引用读取凭证。
- API keys adapter 对齐 CLI Proxy 原生协议：`GET /api-keys` 读取 `{ "api-keys": [...] }`，`PUT /api-keys` 提交字符串数组，`PATCH /api-keys` 提交 `{ index, value }`，`DELETE /api-keys?index=<n>` 删除。
- Auth Files adapter 对齐 CLI Proxy 原生协议：上传按文件逐个调用 `POST /auth-files?name=<file.json>` 并提交原始 JSON 内容；删除使用 `DELETE /auth-files?name=<file>`、`DELETE /auth-files?all=true` 或字符串数组 body。
- System connection check 使用 CLI Proxy 真实存在的 `GET /config` 与 `X-CPA-VERSION` / `X-CPA-BUILD-DATE` 响应头；latest version 使用 `GET /latest-version`。
- `config/`、`api-keys/`、`logs/`、`quotas/`、`system/`：围绕 management client 的领域 service facade，controller 只调用这些 facade。
- `providers/`：项目自定义 provider adapter 接口和 legacy deterministic provider，不泄漏 vendor SDK 类型。
- `runtime-engine/`：内建 CLIProxyAPI runtime engine。`runtime-engine.facade.ts` 是 controller 可调用的唯一稳定入口；`protocols/` 负责 OpenAI/Claude/Gemini 等协议 normalize/project；`executors/` 负责 provider HTTP client、OpenAI-compatible executor、provider executor interface 和 CI fallback harness；`accounting/` 负责 runtime quota 和 usage audit。
- `runtime/agent-gateway-router.ts`：legacy deterministic relay 的 provider 选择器，仅服务 management smoke / relay 兼容入口，不再作为 `/v1/*` 规范 runtime。
- `runtime/agent-gateway-relay.service.ts`：legacy deterministic relay，执行 `preprocess -> route -> provider adapter -> accounting -> log`；后续生产 runtime 能力必须收敛到 `runtime-engine/` facade。
- `runtime/agent-gateway-runtime-auth.service.ts` 与 `runtime/agent-gateway-runtime-accounting.service.ts`：只服务 OpenAI-compatible `/v1/*` 调用方鉴权和额度记账；默认额度为 `1_000_000` token / `10_000` request，并以当前 usage 计算是否超额。
- `secrets/`：明文 secret 只出现在写命令入口，落库或 projection 只保留 masked value / `secretRef`。
- `oauth/agent-gateway-oauth.service.ts`：提供 OAuth flow orchestration，provider-specific start/callback/status/project 细节必须留在 `runtime-engine/oauth/*` adapter 层。
- `test/agent-gateway/agent-gateway.module.spec.ts`：覆盖 `AgentGatewayModule` 的 Nest DI smoke；新增 provider、service 或可选测试时钟等构造参数时，必须通过显式 token 或非构造注入方式避免让 `Function` / `String` 这类裸类型进入 Nest provider 解析。
- `test/agent-gateway/agent-gateway-http.smoke.spec.ts`：使用真实 `AppModule`、统一 Identity 登录和 HTTP server 覆盖受保护 Gateway 入口。当前固定验证完整 management parity 读面 schema projection、管理 mutation 的 masked projection、dashboard、system models、quota refresh、Auth File 上传/列表、client 创建、one-time API key 创建和 client quota 查询，防止 service 单测通过但 controller/auth/query 接线断开。

认证配置：

- Agent Gateway Console 当前接入统一 Identity，不再直接初始化独立数据库用户，也不再使用 `AGENT_GATEWAY_ADMIN_USERNAME` / `AGENT_GATEWAY_ADMIN_PASSWORD` 作为规范登录来源。
- 本地开发账号由 Identity 域负责；需要种子管理员时配置 `IDENTITY_ADMIN_USERNAME` / `IDENTITY_ADMIN_PASSWORD` / `IDENTITY_ADMIN_DISPLAY_NAME`，或通过 Identity 用户管理 API 创建。
- `AGENT_GATEWAY_AUTH_SECRET`、`AGENT_GATEWAY_ADMIN_USERNAME`、`AGENT_GATEWAY_ADMIN_PASSWORD` 只服务旧 `/api/agent-gateway/auth/*` 兼容入口；不要在新代码或新文档中把它们作为 Gateway Console 登录方式。

边界约束：

- Controller 只接收/返回稳定 contract，不直接处理 CLI Proxy raw payload。
- token 计算当前是 deterministic fallback，不引入第三方 tokenizer；接入真实 tokenizer 时必须先通过 provider/adapter 边界转换为 `TokenCountResult`。
- preprocess 阶段负责输入标准化与 input token 估算；postprocess/accounting 只返回 usage summary，不保存 raw provider response、secret、headers 或完整请求体。
- Provider、Credential File、Quota 写操作、OAuth adapter 生命周期、真实 OAuth HTTP client 边界与 deterministic relay 已接线；后续把真实 provider config 接入生产 DI、真实 vendor SDK、持久化数据库或账号额度抓取时，必须先补 core schema、adapter 测试和文档。

验证入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-http.smoke.spec.ts
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```
