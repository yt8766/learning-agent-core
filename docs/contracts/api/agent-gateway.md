# Agent Gateway API

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-gateway` 中转控制台、`agent-server` Agent Gateway API、Provider / 凭据 / 配额 / 日志治理接口
最后核对：2026-05-10

本文记录从 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 参考项目提炼出的 Agent Gateway API 领域模型。当前仓库已落 schema-first contract、统一 Identity 登录接入、Gateway 调用方管理、client API key、client quota、OpenAI-compatible `/v1/models` 与 `/v1/chat/completions` runtime、runtime/config/provider/auth-file/quota projection、读写命令、logs / usage / probe、token count、preprocess、accounting、deterministic relay runtime、secret vault、deterministic OAuth/Auth File 生命周期，以及独立 `apps/frontend/agent-gateway` 中转前端。2026-05-09 起，远程 management connection、raw config、proxy API keys、request log projection、quota detail、system version/model discovery 已有 deterministic 管理面第一版。

## 实现状态

- `current`：当前代码已提供的 HTTP 入口、schema projection 或前端消费能力。
- `compat`：迁移兼容入口，当前代码仍保留，但新前端、新 API 和新文档不得继续依赖。
- `planned`：参考项目中尚未纳入本仓库当前稳定 contract 的高级能力。CLI Proxy management parity 的 Dashboard、provider-specific config、Auth Files、OAuth policy、`api-call` quota、logs 和 system runtime 已进入 current；`/v1/models` 与非 streaming `/v1/chat/completions` 已进入 current。streaming、真实 vendor SDK 矩阵、计费和数据库持久化仍属于后续生产化范围。
- 任何 projection 都不得暴露 raw vendor payload、明文 secret、未过滤 headers 或第三方错误对象。

当前实现入口：

- Stable contract：`packages/core/src/contracts/agent-gateway/`
- CLI Proxy parity extension：`packages/core/src/contracts/agent-gateway/agent-gateway-cli-proxy-parity.schemas.ts`
- Backend domain：`apps/backend/agent-server/src/domains/agent-gateway/`
- Backend API：`apps/backend/agent-server/src/api/agent-gateway/agent-gateway.controller.ts`
- Frontend relay app：`apps/frontend/agent-gateway/`

管理面 HTTP 入口在 `agent-server` 全局 `/api` 前缀下生效；OpenAI-compatible runtime 入口显式排除全局前缀，保持 `GET /v1/models` 与 `POST /v1/chat/completions`。`agent-gateway` 前端以 `/api/*` 发起同源管理请求，Vite 开发代理只需要把 `/api/*` 转发到后端：

| 能力                     | 后端入口                                                  | 前端同源访问                                              | 状态      |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------- | --------- |
| 登录                     | `POST /api/identity/login`                                | `POST /api/identity/login`                                | `current` |
| 刷新短 token             | `POST /api/identity/refresh`                              | `POST /api/identity/refresh`                              | `current` |
| Gateway legacy 登录      | `POST /api/agent-gateway/auth/login`                      | 不再由前端调用                                            | `compat`  |
| Gateway legacy 刷新      | `POST /api/agent-gateway/auth/refresh`                    | 不再由前端调用                                            | `compat`  |
| 总览快照                 | `GET /api/agent-gateway/snapshot`                         | `GET /api/agent-gateway/snapshot`                         | `current` |
| 上游方                   | `GET /api/agent-gateway/providers`                        | `GET /api/agent-gateway/providers`                        | `current` |
| 认证文件                 | `GET /api/agent-gateway/credential-files`                 | `GET /api/agent-gateway/credential-files`                 | `current` |
| 配额                     | `GET /api/agent-gateway/quotas`                           | `GET /api/agent-gateway/quotas`                           | `current` |
| 日志                     | `GET /api/agent-gateway/logs?limit=50`                    | `GET /api/agent-gateway/logs?limit=50`                    | `current` |
| 用量                     | `GET /api/agent-gateway/usage?limit=50`                   | `GET /api/agent-gateway/usage?limit=50`                   | `current` |
| Gateway clients          | `GET /api/agent-gateway/clients`                          | `GET /api/agent-gateway/clients`                          | `current` |
| Gateway client 创建      | `POST /api/agent-gateway/clients`                         | `POST /api/agent-gateway/clients`                         | `current` |
| Gateway client 更新      | `PATCH /api/agent-gateway/clients/:clientId`              | `PATCH /api/agent-gateway/clients/:clientId`              | `current` |
| Gateway client 启停      | `PATCH /api/agent-gateway/clients/:clientId/enable` / `disable` | `PATCH /api/agent-gateway/clients/:clientId/enable` / `disable` | `current` |
| Client API keys          | `GET /api/agent-gateway/clients/:clientId/api-keys`       | `GET /api/agent-gateway/clients/:clientId/api-keys`       | `current` |
| Client API key 创建      | `POST /api/agent-gateway/clients/:clientId/api-keys`      | `POST /api/agent-gateway/clients/:clientId/api-keys`      | `current` |
| Client quota             | `GET /api/agent-gateway/clients/:clientId/quota`          | `GET /api/agent-gateway/clients/:clientId/quota`          | `current` |
| Client quota 更新        | `PUT /api/agent-gateway/clients/:clientId/quota`          | `PUT /api/agent-gateway/clients/:clientId/quota`          | `current` |
| Client request logs      | `GET /api/agent-gateway/clients/:clientId/logs`           | `GET /api/agent-gateway/clients/:clientId/logs`           | `current` |
| Runtime models           | `GET /v1/models`                                          | runtime client 直接调用                                   | `current` |
| Runtime chat completions | `POST /v1/chat/completions`                               | runtime client 直接调用                                   | `current` |
| 探测                     | `POST /api/agent-gateway/probe`                           | `POST /api/agent-gateway/probe`                           | `current` |
| token 估算               | `POST /api/agent-gateway/token-count`                     | `POST /api/agent-gateway/token-count`                     | `current` |
| 前处理                   | `POST /api/agent-gateway/preprocess`                      | `POST /api/agent-gateway/preprocess`                      | `current` |
| 后处理记账               | `POST /api/agent-gateway/accounting`                      | `POST /api/agent-gateway/accounting`                      | `current` |
| 配置更新                 | `PATCH /api/agent-gateway/config`                         | `PATCH /api/agent-gateway/config`                         | `current` |
| 上游方保存               | `PUT /api/agent-gateway/providers/:id`                    | `PUT /api/agent-gateway/providers/:id`                    | `current` |
| 上游方删除               | `DELETE /api/agent-gateway/providers/:id`                 | `DELETE /api/agent-gateway/providers/:id`                 | `current` |
| 认证文件保存             | `PUT /api/agent-gateway/credential-files/:id`             | `PUT /api/agent-gateway/credential-files/:id`             | `current` |
| 认证文件删除             | `DELETE /api/agent-gateway/credential-files/:id`          | `DELETE /api/agent-gateway/credential-files/:id`          | `current` |
| 配额更新                 | `PATCH /api/agent-gateway/quotas/:id`                     | `PATCH /api/agent-gateway/quotas/:id`                     | `current` |
| Relay smoke              | `POST /api/agent-gateway/relay`                           | `POST /api/agent-gateway/relay`                           | `current` |
| OAuth deterministic 启动 | `POST /api/agent-gateway/oauth/start`                     | `POST /api/agent-gateway/oauth/start`                     | `current` |
| OAuth 完成               | `POST /api/agent-gateway/oauth/complete`                  | `POST /api/agent-gateway/oauth/complete`                  | `current` |
| 连接保存                 | `PUT /api/agent-gateway/connection/profile`               | `PUT /api/agent-gateway/connection/profile`               | `current` |
| 连接检查                 | `POST /api/agent-gateway/connection/check`                | `POST /api/agent-gateway/connection/check`                | `current` |
| Raw config               | `GET /api/agent-gateway/config/raw`                       | `GET /api/agent-gateway/config/raw`                       | `current` |
| Raw config diff          | `POST /api/agent-gateway/config/raw/diff`                 | `POST /api/agent-gateway/config/raw/diff`                 | `current` |
| Raw config 保存          | `PUT /api/agent-gateway/config/raw`                       | `PUT /api/agent-gateway/config/raw`                       | `current` |
| Config reload            | `POST /api/agent-gateway/config/reload`                   | `POST /api/agent-gateway/config/reload`                   | `current` |
| Proxy API keys           | `GET /api/agent-gateway/api-keys`                         | `GET /api/agent-gateway/api-keys`                         | `current` |
| Proxy API keys 替换      | `PUT /api/agent-gateway/api-keys`                         | `PUT /api/agent-gateway/api-keys`                         | `current` |
| Proxy API key 更新       | `PATCH /api/agent-gateway/api-keys/:index`                | `PATCH /api/agent-gateway/api-keys/:index`                | `current` |
| Proxy API key 删除       | `DELETE /api/agent-gateway/api-keys/:index`               | `DELETE /api/agent-gateway/api-keys/:index`               | `current` |
| Quota detail             | `GET /api/agent-gateway/quotas/details`                   | `GET /api/agent-gateway/quotas/details`                   | `current` |
| Request logs tail        | `GET /api/agent-gateway/logs/tail`                        | `GET /api/agent-gateway/logs/tail`                        | `current` |
| Request logs search      | `POST /api/agent-gateway/logs/search`                     | `POST /api/agent-gateway/logs/search`                     | `current` |
| Request error files      | `GET /api/agent-gateway/logs/request-error-files`         | `GET /api/agent-gateway/logs/request-error-files`         | `current` |
| Logs clear               | `DELETE /api/agent-gateway/logs`                          | `DELETE /api/agent-gateway/logs`                          | `current` |
| System info              | `GET /api/agent-gateway/system/info`                      | `GET /api/agent-gateway/system/info`                      | `current` |
| System models            | `GET /api/agent-gateway/system/models`                    | `GET /api/agent-gateway/system/models`                    | `current` |
| Provider configs         | `GET /api/agent-gateway/provider-configs`                 | `GET /api/agent-gateway/provider-configs`                 | `current` |
| Provider config 保存     | `PUT /api/agent-gateway/provider-configs/:id`             | `PUT /api/agent-gateway/provider-configs/:id`             | `current` |
| Provider models          | `GET /api/agent-gateway/provider-configs/:id/models`      | `GET /api/agent-gateway/provider-configs/:id/models`      | `current` |
| Provider model test      | `POST /api/agent-gateway/provider-configs/:id/test-model` | `POST /api/agent-gateway/provider-configs/:id/test-model` | `current` |
| Auth files               | `GET /api/agent-gateway/auth-files`                       | `GET /api/agent-gateway/auth-files`                       | `current` |
| Auth files 上传          | `POST /api/agent-gateway/auth-files`                      | `POST /api/agent-gateway/auth-files`                      | `current` |
| Auth files 字段修补      | `PATCH /api/agent-gateway/auth-files/fields`              | `PATCH /api/agent-gateway/auth-files/fields`              | `current` |
| Auth files 删除          | `DELETE /api/agent-gateway/auth-files`                    | `DELETE /api/agent-gateway/auth-files`                    | `current` |
| OAuth Gemini CLI         | `POST /api/agent-gateway/oauth/gemini-cli/start`          | `POST /api/agent-gateway/oauth/gemini-cli/start`          | `current` |
| OAuth provider auth-url  | `POST /api/agent-gateway/oauth/:providerId/start`         | `POST /api/agent-gateway/oauth/:providerId/start`         | `current` |
| OAuth browser callback   | `GET /api/agent-gateway/oauth/callback`                   | `GET /api/agent-gateway/oauth/callback`                   | `current` |
| OAuth callback           | `POST /api/agent-gateway/oauth/callback`                  | `POST /api/agent-gateway/oauth/callback`                  | `current` |
| OAuth status             | `GET /api/agent-gateway/oauth/status/:state`              | `GET /api/agent-gateway/oauth/status/:state`              | `current` |
| Vertex import            | `POST /api/agent-gateway/oauth/vertex/import`             | `POST /api/agent-gateway/oauth/vertex/import`             | `current` |
| Latest version           | `GET /api/agent-gateway/system/latest-version`            | `GET /api/agent-gateway/system/latest-version`            | `current` |
| Request log setting      | `PUT /api/agent-gateway/system/request-log`               | `PUT /api/agent-gateway/system/request-log`               | `current` |
| Clear login storage      | `POST /api/agent-gateway/system/clear-login-storage`      | `POST /api/agent-gateway/system/clear-login-storage`      | `current` |

## 设计目标

- 将参考项目的 `/config`、`/api-keys`、`/gemini-api-key`、`/auth-files`、`/oauth-*`、`/logs`、`/api-call` 等散接口收敛为稳定领域 API。
- 在 `agent-server` 内实现简易 CLIProxyAPI runtime，而不是让后端只连接外部 CLIProxyAPI。运行时调用方通过独立 Gateway client 与 client API key 鉴权，Identity 用户只负责控制台登录与管理操作。
- `/v1/models` 与 `/v1/chat/completions` 使用 OpenAI-compatible 响应；首期拒绝 streaming，`stream: true` 返回 `stream_not_supported`。
- runtime 错误统一返回 `{ error: { message, type, code } }`，不得泄漏 Nest 默认错误外壳、raw provider error、secret、headers 或第三方 SDK 对象。
- 前端必须是独立 workspace 项目，落点为 `apps/frontend/agent-gateway`；它只做中转站控制台，不进入 `agent-admin` 六大治理中心，也不复用 `agent-chat` 执行面。
- 独立中转前端只消费 camelCase、schema 校验后的领域模型，不直接依赖参考项目的 hyphen-case raw payload。
- 登录采用统一 Identity 的短 access token + 长 refresh token。access token 保存在 React session state；refresh token 当前按 contract 标注存放在 `localStorage`，键为 `agent-gateway.refresh-token`。Identity refresh 会轮换 refresh token，因此前端的 `GatewayRefreshResponse` 必须包含并保存新的 `refreshToken`、`refreshTokenExpiresAt` 和 `refreshTokenStorage`；继续提交旧 refresh token 会得到 `401 refresh_token_reused`。
- Agent Gateway 不再直接初始化独立数据库用户，也不要求 `AGENT_GATEWAY_ADMIN_USERNAME` / `AGENT_GATEWAY_ADMIN_PASSWORD`。控制台账号由 `agent-server` Identity 域管理；本地种子用户继续通过 `IDENTITY_ADMIN_USERNAME` / `IDENTITY_ADMIN_PASSWORD` 或用户管理 API 创建。
- `POST /api/agent-gateway/auth/login` 和 `POST /api/agent-gateway/auth/refresh` 是迁移兼容入口，仅服务旧客户端；新增前端必须接入 canonical `/api/identity/*`，允许本地开发通过同源 `/api/identity/*` 调用完成；受保护 Gateway API 只接受 Identity access token。
- 明文 secret 只允许出现在创建、替换或保存命令 payload 中；查询 projection 默认只返回 masked value 或 `secretRef`。
- 保留 `authIndex` 作为 Provider、Auth File、Quota、Log、Recent Request 的跨域关联键。
- Provider-specific response、quota payload、OAuth callback 细节和第三方错误对象必须在 adapter 层归一，不穿透到页面或公共 contract。

## 参考来源

参考项目主要类型与 API 分组：

- `src/types/config.ts`：Gateway 配置、quota exceeded policy、provider config 聚合。
- `src/types/provider.ts`：Gemini / Codex / Claude / Vertex / OpenAI-compatible provider key 与 model alias。
- `src/types/authFile.ts`：OAuth / CLI auth file 列表、状态、最近请求。
- `src/types/oauth.ts`：OAuth provider、device flow、excluded models、model alias。
- `src/types/quota.ts`：Claude、Codex、Gemini CLI、Antigravity、Kimi quota payload 与 UI state。
- `src/services/api/*`：真实 management API endpoint、raw payload normalize、批量上传/删除与 probe API。

## 领域边界

```mermaid
erDiagram
  GatewayRuntime ||--|| GatewayConfig : has
  GatewayRuntime ||--o{ ManagementApiKey : authorizes
  GatewayConfig ||--o{ ProviderCredentialSet : configures
  ProviderCredentialSet ||--o{ ProviderCredential : contains
  ProviderCredentialSet ||--o{ ModelAliasRule : maps
  GatewayRuntime ||--o{ AuthCredentialFile : owns
  AuthCredentialFile ||--o{ QuotaSnapshot : reports
  AuthCredentialFile ||--o{ RecentRequestBucket : observes
  GatewayRuntime ||--o{ RuntimeLogEntry : emits
  OAuthPolicy ||--o{ OAuthExcludedModelRule : excludes
  OAuthPolicy ||--o{ OAuthModelAliasRule : aliases
  GatewayInvocation ||--|| GatewayPreprocessResult : prepares
  GatewayInvocation ||--|| GatewayRoutingDecision : routes
  GatewayInvocation ||--|| GatewayPostprocessResult : reconciles
  GatewayInvocation ||--|| GatewayUsageRecord : accounts
```

## 核心模型

### GatewayRuntime

运行时连接与版本 projection。

```ts
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

type GatewayRuntime = {
  apiBase: string;
  connectionStatus: ConnectionStatus;
  serverVersion: string | null;
  serverBuildDate: string | null;
  latestVersion?: string | null;
  health?: {
    status: 'ok' | 'degraded' | 'error';
    checkedAt: string;
    error?: string;
  };
};
```

### GatewayConfig

配置 aggregate。字段命名使用 camelCase；adapter 负责映射参考项目 raw key，例如 `proxy-url`、`request-retry`、`logs-max-total-size-mb`。

```ts
type RoutingStrategy = 'round-robin' | 'fill-first';

type GatewayConfig = {
  debug: boolean;
  proxyUrl: string | null;
  requestRetry: number;
  requestLog: boolean;
  loggingToFile: boolean;
  logsMaxTotalSizeMb: number;
  wsAuth: boolean;
  forceModelPrefix: boolean;
  routing: {
    strategy: RoutingStrategy;
    sessionAffinity?: boolean;
    sessionAffinityTtlSeconds?: number;
  };
  quotaExceededPolicy: {
    switchProject: boolean;
    switchPreviewModel: boolean;
    antigravityCredits: boolean;
  };
  streaming?: {
    keepaliveSeconds?: number;
    bootstrapRetries?: number;
    nonstreamKeepaliveInterval?: number;
  };
  payloadRules?: {
    defaults: PayloadRule[];
    overrides: PayloadRule[];
    filters: PayloadFilterRule[];
  };
};
```

### ManagementApiKey

管理 API Key projection。查询接口不得返回未遮罩明文。

```ts
type ManagementApiKey = {
  id: string;
  index: number;
  valueMasked: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usage?: ApiKeyUsageSummary;
};
```

创建、替换、更新命令可以短暂携带明文：

```ts
type SaveManagementApiKeysRequest = {
  keys: string[];
};
```

### ProviderCredentialSet

Provider 配置统一模型。参考项目的 Gemini / Codex / Claude / Vertex 单 key list 和 OpenAI-compatible 多 key entries 都映射为同一 aggregate。

```ts
type ProviderType = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openaiCompatible' | 'ampcode';

type ProviderCredentialSet = {
  providerType: ProviderType;
  displayName: string;
  enabled: boolean;
  priority?: number;
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
  credentials: ProviderCredential[];
  models: ModelAliasRule[];
  excludedModels: string[];
  cloakPolicy?: CloakPolicy;
  testModel?: string;
  authIndex?: string;
  rawSource?: 'config' | 'runtime' | 'adapter';
};

type ProviderCredential = {
  credentialId: string;
  apiKeyMasked?: string;
  secretRef?: string;
  authIndex?: string;
  proxyUrl?: string;
  headers?: Record<string, string>;
  status: 'enabled' | 'disabled' | 'unavailable' | 'unknown';
};

type ModelAliasRule = {
  sourceModel: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  fork?: boolean;
};

type CloakPolicy = {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords: string[];
};
```

### AuthCredentialFile

Auth file 是 CLI / OAuth 凭据文件的领域 projection。文件内容读取与保存单独走 content endpoint；列表 projection 不返回 raw file。

```ts
type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'iflow'
  | 'vertex'
  | 'unknown';

type AuthCredentialFile = {
  name: string;
  type: AuthFileType;
  provider?: string;
  size?: number;
  authIndex?: string;
  runtimeOnly: boolean;
  disabled: boolean;
  unavailable: boolean;
  status: 'enabled' | 'disabled' | 'unavailable' | 'unknown';
  statusMessage?: string;
  lastRefreshAt?: string;
  modifiedAt?: string;
  recentRequests: RecentRequestBucket[];
  editableFields?: {
    prefix?: string;
    proxyUrl?: string;
    headers?: Record<string, string>;
    priority?: number;
    note?: string;
  };
};
```

### OAuthPolicy

OAuth start/status/callback、excluded models 和 model alias 统一归入 OAuth policy 边界。

```ts
type OAuthProvider = 'codex' | 'anthropic' | 'antigravity' | 'gemini-cli' | 'kimi';

type OAuthPolicy = {
  provider: OAuthProvider;
  webUiSupported: boolean;
  authStatus?: 'idle' | 'pending' | 'authorized' | 'expired' | 'error';
  excludedModels: string[];
  modelAliases: OAuthModelAliasRule[];
};

type OAuthModelAliasRule = {
  channel: string;
  sourceModel: string;
  alias: string;
  fork: boolean;
};
```

### QuotaSnapshot

Quota 外层状态统一，内部 display shape 保留 provider 差异。adapter 从 Claude / Codex / Gemini CLI / Antigravity / Kimi payload 归一到这些 display rows。

```ts
type QuotaSnapshot = {
  providerType: ProviderType | 'kimi' | 'antigravity' | 'gemini-cli';
  subjectId: string;
  authIndex?: string;
  credentialName?: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  planType?: string;
  windows?: QuotaWindow[];
  buckets?: QuotaBucket[];
  rows?: QuotaRow[];
  groups?: QuotaGroup[];
  error?: {
    message: string;
    status?: number;
  };
  observedAt: string;
};

type QuotaWindow = {
  id: string;
  label: string;
  usedPercent: number | null;
  resetLabel?: string;
};

type QuotaBucket = {
  id: string;
  label: string;
  remainingFraction: number | null;
  remainingAmount?: number | null;
  resetTime?: string;
  tokenType?: string | null;
};

type QuotaRow = {
  id: string;
  label: string;
  used: number;
  limit: number;
  resetHint?: string;
};

type QuotaGroup = {
  id: string;
  label: string;
  models: string[];
  remainingFraction: number;
  resetTime?: string;
};
```

### RuntimeLogEntry

日志列表应支持增量读取，并允许按 request id 下载完整 request log。

```ts
type RuntimeLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: unknown;
  requestId?: string;
  provider?: string;
  model?: string;
  authIndex?: string;
};
```

### ApiProbe

参考项目的 `/api-call` 是受控 probe 能力，用于模型发现或诊断。它必须独立建模，不要伪装成普通浏览器 fetch。

```ts
type ApiProbeRequest = {
  authIndex?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  bodyText?: string;
};

type ApiProbeResult = {
  statusCode: number;
  headers: Record<string, string[]>;
  bodyText: string;
  body: unknown | null;
};
```

### Gateway Invocation Pipeline

中转网关不是简单代理转发。所有 chat / completions / model probe 这类会触发上游模型调用的请求都必须进入统一 pipeline，至少包含：

```text
Inbound Request
  -> Preprocess
  -> Routing
  -> Upstream Dispatch
  -> Stream / Response Handling
  -> Postprocess
  -> Accounting & Audit
```

核心 invocation record：

```ts
type GatewayInvocation = {
  requestId: string;
  tenantId?: string;
  userId?: string;
  managementKeyId?: string;
  receivedAt: string;
  protocol: 'openai-compatible' | 'anthropic' | 'gemini' | 'internal';
  model: string;
  normalizedModel: string;
  stream: boolean;
  input: GatewayInvocationInput;
  preprocess?: GatewayPreprocessResult;
  routingDecision?: GatewayRoutingDecision;
  postprocess?: GatewayPostprocessResult;
  usage?: GatewayUsageRecord;
  trace: GatewayPipelineTraceEvent[];
};
```

`GatewayInvocationInput` 是内部 normalized request，不能直接保存 raw provider SDK object：

```ts
type GatewayInvocationInput = {
  messages?: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{ type: string; text?: string; url?: string }>;
    toolCallId?: string;
  }>;
  inputText?: string;
  tools?: Array<{ name: string; description?: string; parameters?: unknown }>;
  responseFormat?: 'text' | 'json' | 'json_schema';
  maxOutputTokens?: number;
  temperature?: number;
  metadata?: Record<string, string | number | boolean>;
};
```

### Tokenization

Token 计算必须按 tokenizer family 建模，不允许所有模型共用一个粗略公式。

```ts
type TokenizerFamily = 'openai-bpe' | 'anthropic' | 'gemini' | 'codex' | 'sentencepiece' | 'fallback-heuristic';

type TokenCountRequest = {
  model: string;
  providerType?: ProviderType | 'gemini-cli' | 'kimi' | 'antigravity';
  tokenizerFamily: TokenizerFamily;
  input: GatewayInvocationInput;
};

type TokenCountResult = {
  model: string;
  tokenizerFamily: TokenizerFamily;
  inputTokens: number;
  toolTokens: number;
  attachmentTokens: number;
  totalTokens: number;
  estimated: boolean;
  warnings: string[];
};
```

前处理 token 计算默认输出估算值；如果 provider 后续返回 usage，后处理阶段必须做 reconcile。

### Preprocess

前处理负责把外部请求转为可路由、可审计、可限流的内部调用。

```ts
type GatewayPreprocessResult = {
  requestId: string;
  normalizedModel: string;
  tokenizerFamily: TokenizerFamily;
  tokenCount: TokenCountResult;
  contextWindow: {
    limit: number;
    requestedOutputTokens: number;
    availableOutputTokens: number;
    fits: boolean;
  };
  budgetPreflight: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    estimatedCost?: GatewayCostEstimate;
    allowed: boolean;
    reason?: string;
  };
  rateLimitPreflight: {
    allowed: boolean;
    policyIds: string[];
    blockedBy?: string;
    resetAt?: string;
  };
  candidateProviders: Array<{
    providerType: ProviderType;
    authIndex?: string;
    priority?: number;
    health: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  }>;
};
```

前处理必须覆盖：

- 请求规范化：OpenAI / Claude / Gemini / Codex 请求转为 `GatewayInvocationInput`。
- 模型解析：alias、prefix、fallback model、test model。
- 输入 token 计算：messages、system、tools、attachments、input text。
- 上下文窗口检查：`inputTokens + requestedOutputTokens <= contextWindow`。
- 预算预检：预计 token、预计成本、tenant/key/provider quota。
- 限流预检：RPM、TPM、并发、日限额。
- 安全策略：blocked model、disabled credential、header allowlist、probe allowlist。

### Routing

```ts
type GatewayRoutingDecision = {
  requestId: string;
  strategy: 'round-robin' | 'fill-first' | 'priority' | 'least-used' | 'quota-aware';
  selectedProvider: ProviderType;
  selectedAuthIndex?: string;
  selectedCredentialId?: string;
  selectedModel: string;
  candidates: Array<{
    providerType: ProviderType;
    authIndex?: string;
    score: number;
    skippedReason?: string;
  }>;
  fallbackChain: Array<{
    providerType: ProviderType;
    authIndex?: string;
    reason: 'quota_exceeded' | 'rate_limited' | 'timeout' | 'upstream_error' | 'model_unavailable';
  }>;
  decidedAt: string;
};
```

### Postprocess

后处理负责 output token 计算、provider usage reconcile、格式归一和敏感字段剔除。

```ts
type UsageSource = 'estimated' | 'provider' | 'reconciled';

type GatewayPostprocessResult = {
  requestId: string;
  outputTokenCount: {
    completionTokens: number;
    reasoningTokens?: number;
    toolCallTokens?: number;
    estimated: boolean;
  };
  usageReconciliation: {
    source: UsageSource;
    estimatedInputTokens: number;
    reportedInputTokens?: number;
    estimatedOutputTokens: number;
    reportedOutputTokens?: number;
    finalInputTokens: number;
    finalOutputTokens: number;
    finalTotalTokens: number;
  };
  responseShape: 'openai-compatible' | 'internal';
  sanitized: boolean;
};
```

### Accounting

每次中转请求必须形成账本记录。日志、quota、dashboard、recent requests 都应消费账本 projection，而不是重复解析 raw logs。

```ts
type GatewayCostEstimate = {
  currency: 'USD' | 'CNY' | 'credits' | 'unknown';
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pricingProfileId?: string;
};

type GatewayUsageRecord = {
  requestId: string;
  tenantId?: string;
  userId?: string;
  managementKeyId?: string;
  model: string;
  providerType: ProviderType;
  authIndex?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  usageSource: UsageSource;
  estimatedCost?: GatewayCostEstimate;
  latencyMs: number;
  status: 'success' | 'error' | 'cancelled';
  errorCode?: string;
  createdAt: string;
};
```

### Rate Limit and Model Capability

```ts
type RateLimitPolicy = {
  id: string;
  scope: 'management-key' | 'provider-credential' | 'tenant' | 'global';
  subjectId: string;
  rpm?: number;
  tpm?: number;
  dailyTokens?: number;
  concurrency?: number;
};

type ModelCapabilityProfile = {
  model: string;
  providerType: ProviderType;
  tokenizerFamily: TokenizerFamily;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
};
```

### Pipeline Trace

Preprocess 和 postprocess 都必须可观测。Trace event 只保存摘要和稳定字段，不保存 raw secret、完整 provider response 或未过滤 headers。

```ts
type GatewayPipelineTraceEvent = {
  requestId: string;
  type:
    | 'token.input.estimated'
    | 'budget.preflight.completed'
    | 'rate-limit.preflight.completed'
    | 'routing.selected'
    | 'upstream.started'
    | 'upstream.completed'
    | 'token.output.estimated'
    | 'token.output.reconciled'
    | 'accounting.committed';
  timestamp: string;
  summary: Record<string, string | number | boolean | null>;
};
```

## API 入口

当前已落地入口使用 `agent-server` 全局 `/api` 前缀。表中标记为 `planned` 的能力来自参考项目或后续生产化目标，不代表当前代码已经接线。

当前 `current` 入口的 request / response schema 对齐 `packages/core/src/contracts/agent-gateway`；登录、刷新、登出和当前用户查询对齐 `packages/core/src/contracts/auth-service` 的统一 Identity contract：

| 入口                                                                 | Request schema                                   | Response schema                                   |
| -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| `POST /api/identity/login`                                           | `AuthLoginRequestSchema`                         | `AuthLoginResponseSchema`                         |
| `POST /api/identity/refresh`                                         | `AuthRefreshRequestSchema`                       | `AuthRefreshResponseSchema`                       |
| `GET /api/identity/me`                                               | Bearer token                                     | `AuthMeResponseSchema`                            |
| `POST /api/agent-gateway/auth/login`                                 | `GatewayLoginRequestSchema`                      | `GatewayLoginResponseSchema`                      |
| `POST /api/agent-gateway/auth/refresh`                               | `GatewayRefreshRequestSchema`                    | `GatewayRefreshResponseSchema`                    |
| `GET /api/agent-gateway/snapshot`                                    | none                                             | `GatewaySnapshotSchema`                           |
| `GET /api/agent-gateway/providers`                                   | none                                             | `GatewayProviderCredentialSetSchema[]`            |
| `GET /api/agent-gateway/credential-files`                            | none                                             | `GatewayCredentialFileSchema[]`                   |
| `GET /api/agent-gateway/quotas`                                      | none                                             | `GatewayQuotaSchema[]`                            |
| `GET /api/agent-gateway/logs`                                        | `GatewayListQuerySchema`                         | `GatewayLogListResponseSchema`                    |
| `GET /api/agent-gateway/usage`                                       | `GatewayListQuerySchema`                         | `GatewayUsageListResponseSchema`                  |
| `POST /api/agent-gateway/probe`                                      | `GatewayProbeRequestSchema`                      | `GatewayProbeResponseSchema`                      |
| `POST /api/agent-gateway/token-count`                                | `GatewayTokenCountRequestSchema`                 | `GatewayTokenCountResponseSchema`                 |
| `POST /api/agent-gateway/preprocess`                                 | `GatewayPreprocessRequestSchema`                 | `GatewayPreprocessResponseSchema`                 |
| `POST /api/agent-gateway/accounting`                                 | `GatewayAccountingRequestSchema`                 | `GatewayAccountingResponseSchema`                 |
| `PATCH /api/agent-gateway/config`                                    | `GatewayUpdateConfigRequestSchema`               | `GatewayConfigSchema`                             |
| `PUT /api/agent-gateway/providers/:id`                               | `GatewayUpsertProviderRequestSchema`             | `GatewayProviderCredentialSetSchema`              |
| `DELETE /api/agent-gateway/providers/:id`                            | `GatewayDeleteProviderRequestSchema`             | none                                              |
| `PUT /api/agent-gateway/credential-files/:id`                        | `GatewayUpsertCredentialFileRequestSchema`       | `GatewayCredentialFileSchema`                     |
| `DELETE /api/agent-gateway/credential-files/:id`                     | `GatewayDeleteCredentialFileRequestSchema`       | none                                              |
| `PATCH /api/agent-gateway/quotas/:id`                                | `GatewayUpdateQuotaRequestSchema`                | `GatewayQuotaSchema`                              |
| `POST /api/agent-gateway/relay`                                      | `GatewayRelayRequestSchema`                      | `GatewayRelayResponseSchema`                      |
| `POST /api/agent-gateway/oauth/start`                                | `GatewayStartOAuthRequestSchema`                 | `GatewayStartOAuthResponseSchema`                 |
| `POST /api/agent-gateway/oauth/complete`                             | `GatewayCompleteOAuthRequestSchema`              | `GatewayCompleteOAuthResponseSchema`              |
| `POST /api/agent-gateway/oauth/:providerId/start`                    | `GatewayProviderOAuthStartRequestSchema`         | `GatewayProviderOAuthStartResponseSchema`         |
| `PUT /api/agent-gateway/connection/profile`                          | `GatewaySaveConnectionProfileRequestSchema`      | `GatewayConnectionProfileSchema`                  |
| `POST /api/agent-gateway/connection/check`                           | none                                             | `GatewayConnectionStatusResponseSchema`           |
| `GET /api/agent-gateway/config/raw`                                  | none                                             | `GatewayRawConfigResponseSchema`                  |
| `POST /api/agent-gateway/config/raw/diff`                            | `GatewaySaveRawConfigRequestSchema`              | `GatewayConfigDiffResponseSchema`                 |
| `PUT /api/agent-gateway/config/raw`                                  | `GatewaySaveRawConfigRequestSchema`              | `GatewayRawConfigResponseSchema`                  |
| `POST /api/agent-gateway/config/reload`                              | none                                             | `GatewayReloadConfigResponseSchema`               |
| `GET /api/agent-gateway/api-keys`                                    | none                                             | `GatewayApiKeyListResponseSchema`                 |
| `PUT /api/agent-gateway/api-keys`                                    | `GatewayReplaceApiKeysRequestSchema`             | `GatewayApiKeyListResponseSchema`                 |
| `PATCH /api/agent-gateway/api-keys/:index`                           | `GatewayUpdateApiKeyRequestSchema`               | `GatewayApiKeyListResponseSchema`                 |
| `DELETE /api/agent-gateway/api-keys/:index`                          | `GatewayDeleteApiKeyRequestSchema`               | `GatewayApiKeyListResponseSchema`                 |
| `GET /api/agent-gateway/quotas/details`                              | none                                             | `GatewayQuotaDetailListResponseSchema`            |
| `GET /api/agent-gateway/logs/tail`                                   | `GatewayLogSearchRequestSchema`                  | `GatewayRequestLogListResponseSchema`             |
| `POST /api/agent-gateway/logs/search`                                | `GatewayLogSearchRequestSchema`                  | `GatewayRequestLogListResponseSchema`             |
| `GET /api/agent-gateway/logs/request-error-files`                    | none                                             | `GatewayLogFileListResponseSchema`                |
| `DELETE /api/agent-gateway/logs`                                     | none                                             | `GatewayClearLogsResponseSchema`                  |
| `GET /api/agent-gateway/system/info`                                 | none                                             | `GatewaySystemVersionResponseSchema`              |
| `GET /api/agent-gateway/system/models`                               | none                                             | `GatewaySystemModelsResponseSchema`               |
| `GET /api/agent-gateway/dashboard`                                   | none                                             | `GatewayDashboardSummaryResponseSchema`           |
| `GET /api/agent-gateway/provider-configs`                            | none                                             | `GatewayProviderSpecificConfigListResponseSchema` |
| `PUT /api/agent-gateway/provider-configs/:id`                        | `GatewayProviderSpecificConfigRecordSchema`      | `GatewayProviderSpecificConfigRecordSchema`       |
| `GET /api/agent-gateway/auth-files`                                  | query                                            | `GatewayAuthFileListResponseSchema`               |
| `POST /api/agent-gateway/auth-files`                                 | `GatewayAuthFileBatchUploadRequestSchema`        | `GatewayAuthFileBatchUploadResponseSchema`        |
| `PATCH /api/agent-gateway/auth-files/fields`                         | `GatewayAuthFilePatchRequestSchema`              | `GatewayAuthFileSchema`                           |
| `DELETE /api/agent-gateway/auth-files`                               | `GatewayAuthFileDeleteRequestSchema`             | `GatewayAuthFileDeleteResponseSchema`             |
| `GET /api/agent-gateway/oauth/model-aliases/:providerId`             | none                                             | `GatewayOAuthModelAliasListResponseSchema`        |
| `PATCH /api/agent-gateway/oauth/model-aliases/:providerId`           | `GatewayUpdateOAuthModelAliasRulesRequestSchema` | `GatewayOAuthModelAliasListResponseSchema`        |
| `POST /api/agent-gateway/api-call`                                   | `GatewayManagementApiCallRequestSchema`          | `GatewayManagementApiCallResponseSchema`          |
| `POST /api/agent-gateway/quotas/details/:providerKind/refresh`       | provider kind path param                         | `GatewayQuotaDetailListResponseSchema`            |
| `GET /api/agent-gateway/logs/request/:id/download`                   | none                                             | text                                              |
| `GET /api/agent-gateway/logs/request-error-files/:fileName/download` | none                                             | text                                              |
| `GET /api/agent-gateway/system/latest-version`                       | none                                             | `GatewaySystemVersionResponseSchema`              |
| `PUT /api/agent-gateway/system/request-log`                          | `{ requestLog?: boolean; enabled?: boolean }`    | `GatewayRequestLogSettingResponseSchema`          |
| `POST /api/agent-gateway/system/clear-login-storage`                 | none                                             | `GatewayClearLoginStorageResponseSchema`          |

Planned endpoints must be added schema-first in `packages/core/src/contracts/agent-gateway` before being promoted to `current`.

CLI Proxy parity extension contracts are schema-first and the management parity surface below is HTTP-mounted through `AgentGatewayManagementController`:

- Dashboard: `GatewayDashboardSummaryResponseSchema`
- Provider-specific config: `GatewayProviderSpecificConfigRecordSchema`、`GatewayProviderSpecificConfigListResponseSchema`
- OAuth alias rules: `GatewayOAuthModelAliasRuleSchema`、`GatewayOAuthModelAliasListResponseSchema`、`GatewayUpdateOAuthModelAliasRulesRequestSchema`
- Vertex import: `GatewayVertexCredentialImportRequestSchema`、`GatewayVertexCredentialImportResponseSchema`
- Management api-call: `GatewayManagementApiCallRequestSchema`、`GatewayManagementApiCallResponseSchema`
- Ampcode: `GatewayAmpcodeConfigResponseSchema`、`GatewayAmpcodeUpstreamApiKeyMappingSchema`、`GatewayAmpcodeModelMappingSchema`、`GatewayUpdateAmpcode*RequestSchema`

### Runtime

| Method | Path                          | Status  | Response          |
| ------ | ----------------------------- | ------- | ----------------- |
| `GET`  | `/api/agent-gateway/snapshot` | current | `GatewaySnapshot` |

### Config

| Method  | Path                                          | Status  | Request / Response                                                       |
| ------- | --------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `GET`   | `/api/agent-gateway/snapshot`                 | current | snapshot 内含 `GatewayConfig`                                            |
| `PATCH` | `/api/agent-gateway/config`                   | current | `GatewayUpdateConfigRequest` -> `GatewayConfig`                          |
| `GET`   | `/api/agent-gateway/config`                   | planned | `GatewayConfig`                                                          |
| `GET`   | `/api/agent-gateway/config/raw`               | current | `GatewayRawConfigResponseSchema`                                         |
| `PUT`   | `/api/agent-gateway/config/raw`               | current | `GatewaySaveRawConfigRequestSchema` -> `GatewayRawConfigResponseSchema`  |
| `POST`  | `/api/agent-gateway/config/raw/diff`          | current | `GatewaySaveRawConfigRequestSchema` -> `GatewayConfigDiffResponseSchema` |
| `POST`  | `/api/agent-gateway/config/reload`            | current | `GatewayReloadConfigResponseSchema`                                      |
| `PATCH` | `/api/agent-gateway/config/sections/:section` | planned | section-specific `{ value }` command                                     |

`section` 允许值必须枚举化，不允许任意路径写入。初始枚举可覆盖：

```text
debug
proxyUrl
requestRetry
requestLog
loggingToFile
logsMaxTotalSizeMb
wsAuth
forceModelPrefix
routing.strategy
quotaExceeded.switchProject
quotaExceeded.switchPreviewModel
quotaExceeded.antigravityCredits
```

### Management Keys

| Method   | Path                                       | Status  | Request / Response                   |
| -------- | ------------------------------------------ | ------- | ------------------------------------ |
| `GET`    | `/api/agent-gateway/api-keys`              | current | `GatewayApiKeyListResponseSchema`    |
| `PUT`    | `/api/agent-gateway/api-keys`              | current | `GatewayReplaceApiKeysRequestSchema` |
| `PATCH`  | `/api/agent-gateway/api-keys/:index`       | current | `GatewayUpdateApiKeyRequestSchema`   |
| `DELETE` | `/api/agent-gateway/api-keys/:index`       | current | `GatewayDeleteApiKeyRequestSchema`   |
| `GET`    | `/api/agent-gateway/management-keys/usage` | planned | API key usage projection             |

### Providers

| Method   | Path                                                         | Status  | Request / Response                                               |
| -------- | ------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `GET`    | `/api/agent-gateway/providers`                               | current | `ProviderCredentialSet[]`                                        |
| `PUT`    | `/api/agent-gateway/providers/:providerId`                   | current | `GatewayUpsertProviderRequest` -> `GatewayProviderCredentialSet` |
| `DELETE` | `/api/agent-gateway/providers/:providerId`                   | current | no body                                                          |
| `GET`    | `/api/agent-gateway/provider-configs`                        | current | `GatewayProviderSpecificConfigListResponseSchema`                |
| `PUT`    | `/api/agent-gateway/provider-configs/:providerId`            | current | `GatewayProviderSpecificConfigRecordSchema`                      |
| `GET`    | `/api/agent-gateway/provider-configs/:providerId/models`     | current | `GatewaySystemModelsResponseSchema`                              |
| `POST`   | `/api/agent-gateway/provider-configs/:providerId/test-model` | current | `GatewayProbeResponseSchema`                                     |
| `PUT`    | `/api/agent-gateway/providers/:providerType`                 | planned | replace provider set                                             |
| `PATCH`  | `/api/agent-gateway/providers/:providerType/:index`          | planned | partial provider update                                          |
| `PATCH`  | `/api/agent-gateway/providers/:providerType/:index/status`   | planned | `{ enabled: boolean }`                                           |
| `DELETE` | `/api/agent-gateway/providers/:providerType/:index`          | planned | no body                                                          |
| `POST`   | `/api/agent-gateway/providers/:providerType/model-discovery` | planned | probe models through adapter                                     |

### Auth Files

| Method   | Path                                                    | Status  | Request / Response                                              |
| -------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| `GET`    | `/api/agent-gateway/credential-files`                   | current | `GatewayCredentialFile[]`                                       |
| `PUT`    | `/api/agent-gateway/credential-files/:credentialFileId` | current | `GatewayUpsertCredentialFileRequest` -> `GatewayCredentialFile` |
| `DELETE` | `/api/agent-gateway/credential-files/:credentialFileId` | current | no body                                                         |
| `GET`    | `/api/agent-gateway/auth-files`                         | current | `GatewayAuthFileListResponseSchema`                             |
| `POST`   | `/api/agent-gateway/auth-files`                         | current | `GatewayAuthFileBatchUploadResponseSchema`                      |
| `PATCH`  | `/api/agent-gateway/auth-files/:name/status`            | planned | `{ disabled: boolean }`                                         |
| `PATCH`  | `/api/agent-gateway/auth-files/fields`                  | current | `GatewayAuthFilePatchRequestSchema` -> `GatewayAuthFileSchema`  |
| `DELETE` | `/api/agent-gateway/auth-files`                         | current | `GatewayAuthFileDeleteRequestSchema` -> response                |
| `GET`    | `/api/agent-gateway/auth-files/:name/download`          | current | text/blob                                                       |
| `PUT`    | `/api/agent-gateway/auth-files/:name/content`           | planned | text/json content                                               |
| `GET`    | `/api/agent-gateway/auth-files/:name/models`            | current | `GatewayAuthFileModelListResponseSchema`                        |
| `GET`    | `/api/agent-gateway/model-definitions/:channel`         | planned | normalized model definitions                                    |

Batch upload/delete response:

```ts
type BatchFileMutationResult = {
  status: 'ok' | 'partial' | 'error';
  succeeded: number;
  files: string[];
  failed: Array<{ name: string; error: string }>;
};
```

### OAuth

| Method   | Path                                                 | Status  | Request / Response                                                                                               |
| -------- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/agent-gateway/oauth/start`                     | current | deterministic credential lifecycle: `GatewayStartOAuthRequest` -> `GatewayStartOAuthResponse`                    |
| `POST`   | `/api/agent-gateway/oauth/complete`                  | current | `GatewayCompleteOAuthRequest` -> `GatewayCompleteOAuthResponse`                                                  |
| `GET`    | `/api/agent-gateway/oauth/policies`                  | planned | `OAuthPolicy[]`                                                                                                  |
| `POST`   | `/api/agent-gateway/oauth/:providerId/start`         | current | CLI Proxy auth-url parity: `GatewayProviderOAuthStartRequestSchema` -> `GatewayProviderOAuthStartResponseSchema` |
| `POST`   | `/api/agent-gateway/oauth/gemini-cli/start`          | current | `GatewayGeminiCliOAuthStartRequestSchema` -> url projection                                                      |
| `GET`    | `/api/agent-gateway/oauth/status/:state`             | current | `GatewayOAuthStatusResponseSchema`                                                                               |
| `GET`    | `/api/agent-gateway/oauth/callback`                  | current | browser redirect callback, no Gateway access token required                                                      |
| `POST`   | `/api/agent-gateway/oauth/callback`                  | current | `GatewayOAuthCallbackRequestSchema` -> response                                                                  |
| `PATCH`  | `/api/agent-gateway/oauth/:provider/excluded-models` | planned | `{ models: string[] }`                                                                                           |
| `DELETE` | `/api/agent-gateway/oauth/:provider/excluded-models` | planned | no body                                                                                                          |
| `GET`    | `/api/agent-gateway/oauth/model-aliases/:providerId` | current | `GatewayOAuthModelAliasListResponseSchema`                                                                       |
| `PATCH`  | `/api/agent-gateway/oauth/model-aliases/:providerId` | current | `GatewayUpdateOAuthModelAliasRulesRequestSchema`                                                                 |
| `DELETE` | `/api/agent-gateway/oauth/:channel/model-aliases`    | planned | no body                                                                                                          |

Provider auth-url start 保留 CLI Proxy 返回的原始授权 URL，不改写 `redirect_uri`。Codex、Claude、Antigravity 依赖 CLI Proxy WebUI flow 启动的本地 callback forwarder，因此授权链接中的 callback 仍分别指向 CLI Proxy 预期的本地端口；Kimi 使用 device authorization URL 和 `user_code`。`GET /api/agent-gateway/oauth/callback` 仅作为部署自定义 callback 或手动 fallback 入口；manual fallback 仍使用受保护的 `POST /api/agent-gateway/oauth/callback`。

真实 CLI Proxy adapter 继续保持项目稳定 camelCase contract，但上游调用必须使用 CLIProxyAPI 原生协议：

- management key 同时发送 `Authorization: Bearer <key>` 和 `X-Management-Key: <key>`。
- connection check 调用 `GET /v0/management/config`，版本来自 `X-CPA-VERSION`，构建时间来自 `X-CPA-BUILD-DATE`。
- API keys：`GET /api-keys` 读取 `{ "api-keys": [...] }`；`PUT /api-keys` body 是字符串数组；`PATCH /api-keys` body 是 `{ index, value }`；`DELETE /api-keys?index=<n>` 删除。
- Auth files：上传是 `POST /auth-files?name=<file.json>` + 原始 JSON 内容，删除支持 `DELETE /auth-files?name=<file>`、`DELETE /auth-files?all=true` 或字符串数组 body。
- OAuth status：CLI Proxy 的 `status: "wait"` 映射为 `pending`，`status: "ok"` 映射为 `completed`；callback body 使用 `redirect_url`；provider auth-url 响应中的 `user_code` 会映射为前端 `userCode`。

### Quota

| Method  | Path                                 | Status  | Response                                      |
| ------- | ------------------------------------ | ------- | --------------------------------------------- |
| `GET`   | `/api/agent-gateway/quotas`          | current | `GatewayQuota[]`                              |
| `PATCH` | `/api/agent-gateway/quotas/:quotaId` | current | `GatewayUpdateQuotaRequest` -> `GatewayQuota` |
| `GET`   | `/api/agent-gateway/quotas/details`  | current | `GatewayQuotaDetailListResponseSchema`        |
| `POST`  | `/api/agent-gateway/api-call`        | current | `GatewayManagementApiCallResponseSchema`      |
| `GET`   | `/api/agent-gateway/quota`           | planned | `QuotaSnapshot[]`                             |

Quota endpoint 可由后端并发聚合 provider-specific quota API；前端不直接调用 vendor quota API。

### Logs

| Method   | Path                                                         | Status  | Request / Response                |
| -------- | ------------------------------------------------------------ | ------- | --------------------------------- |
| `GET`    | `/api/agent-gateway/logs`                                    | current | `{ items: GatewayLogEntry[] }`    |
| `GET`    | `/api/agent-gateway/usage`                                   | current | `{ items: GatewayUsageRecord[] }` |
| `DELETE` | `/api/agent-gateway/logs`                                    | current | `GatewayClearLogsResponseSchema`  |
| `GET`    | `/api/agent-gateway/logs/request-error-files`                | current | error log file list               |
| `GET`    | `/api/agent-gateway/logs/request-error-files/:name/download` | current | blob/text                         |
| `GET`    | `/api/agent-gateway/logs/request/:requestId/download`        | current | blob/text                         |

### Probe

| Method | Path                       | Status  | Request / Response                |
| ------ | -------------------------- | ------- | --------------------------------- |
| `POST` | `/api/agent-gateway/probe` | current | `GatewayProbeRequest` -> response |

Probe 必须经过服务端 allowlist / policy 校验；不得成为任意 SSRF 通道。

### Invocation Pipeline

| Method | Path                                       | Status  | Request / Response                              |
| ------ | ------------------------------------------ | ------- | ----------------------------------------------- |
| `POST` | `/api/agent-gateway/token-count`           | current | `GatewayTokenCountRequest` -> response          |
| `POST` | `/api/agent-gateway/preprocess`            | current | `GatewayPreprocessRequest` -> response          |
| `POST` | `/api/agent-gateway/accounting`            | current | `GatewayAccountingRequest` -> response          |
| `POST` | `/api/agent-gateway/relay`                 | current | `GatewayRelayRequest` -> `GatewayRelayResponse` |
| `POST` | `/api/agent-gateway/invocations/:id/route` | planned | `GatewayRoutingDecision`                        |
| `GET`  | `/api/agent-gateway/invocations/:id`       | planned | `GatewayInvocation`                             |
| `GET`  | `/api/agent-gateway/usage-records`         | planned | paginated `GatewayUsageRecord[]`                |

当前 `relay` 是 deterministic mock provider 闭环，用于验证项目自定义 router、provider adapter、usage 和 log contract。生产 chat/completions vendor SDK 转发仍是后续 adapter 工作。当前生命周期是：

```text
preprocess -> route -> provider adapter -> accounting -> log
```

其中 `preprocess` 做 prompt 标准化、input token 估算、上下文窗口与预算预检；`route` 只消费 normalized provider projection；`provider adapter` 负责屏蔽 vendor SDK / raw response；`accounting` 归一 provider usage 与 fallback token 估算；`log` 只保存 requestId、providerId、model、usage、latency、status 和摘要字段，不保存 raw request body、raw provider response、明文 secret 或未过滤 headers。

## Adapter 映射

| Agent Gateway model     | 参考项目 raw source                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GatewayConfig`         | `GET /config`、`GET /config.yaml`                                                                              |
| `ManagementApiKey[]`    | `GET /api-keys`                                                                                                |
| `ProviderCredentialSet` | `/gemini-api-key`、`/codex-api-key`、`/claude-api-key`、`/vertex-api-key`、`/openai-compatibility`、`/ampcode` |
| `AuthCredentialFile[]`  | `GET /auth-files`                                                                                              |
| `OAuthPolicy`           | `/oauth-excluded-models`、`/oauth-model-alias`、`/:provider-auth-url`、`/get-auth-status`、`/oauth-callback`   |
| `QuotaSnapshot`         | provider/auth-file quota payloads                                                                              |
| `RuntimeLogEntry`       | `/logs`、`/request-error-logs`、`/request-log-by-id`                                                           |
| `ApiProbeResult`        | `/api-call`                                                                                                    |
| `GatewayUsageRecord`    | request log、provider usage、stream aggregation、postprocess token reconcile                                   |
| `TokenCountResult`      | tokenizer provider 或 fallback heuristic                                                                       |

## 错误语义

统一错误结构：

```ts
type GatewayApiError = {
  code:
    | 'GATEWAY_UNAUTHENTICATED'
    | 'GATEWAY_FORBIDDEN'
    | 'GATEWAY_NOT_FOUND'
    | 'GATEWAY_VALIDATION_FAILED'
    | 'GATEWAY_PROVIDER_UNAVAILABLE'
    | 'GATEWAY_CONTEXT_WINDOW_EXCEEDED'
    | 'GATEWAY_RATE_LIMITED'
    | 'GATEWAY_BUDGET_EXCEEDED'
    | 'GATEWAY_SECRET_REQUIRED'
    | 'GATEWAY_PROBE_BLOCKED'
    | 'GATEWAY_UPSTREAM_FAILED'
    | 'GATEWAY_INTERNAL_ERROR';
  message: string;
  details?: unknown;
  requestId?: string;
};
```

兼容策略：

- adapter 可读取 raw `error`、`message`、HTTP status 和 vendor body，但对外只返回 `GatewayApiError`。
- `GATEWAY_SECRET_REQUIRED` 用于需要明文 secret 才能保存或测试的命令。
- `GATEWAY_PROBE_BLOCKED` 用于 SSRF / policy / allowlist 拒绝。
- `GATEWAY_CONTEXT_WINDOW_EXCEEDED`、`GATEWAY_RATE_LIMITED`、`GATEWAY_BUDGET_EXCEEDED` 必须由 preprocess 阶段返回，不能等上游调用失败后再补记。
- vendor 原始错误只允许放入服务端日志，不直接出现在公共 response。

## 实现边界

独立中转前端职责：

- 只消费本文定义的 normalized projection。
- 不保存未遮罩 secret 到长期 store。
- Provider、Auth File、Quota、Logs 之间通过 `authIndex`、`providerType`、`requestId` 关联展示。
- 不自行解析参考项目 raw payload。
- 不承载 Runtime Center、Approvals Center、Learning Center、Skill Lab、Evidence Center、Connector & Policy Center；这些仍属于 `agent-admin`。
- 不承载 Chat thread、审批卡片、Think panel 或 ThoughtChain；这些仍属于 `agent-chat`。

后端 / adapter 职责：

- 负责 raw endpoint 兼容、hyphen-case 到 camelCase 映射、dedupe、排序、mask secret。
- 负责 provider-specific model discovery、quota payload normalization、OAuth callback provider name mapping。
- 负责 tokenizer family 选择、输入 token 估算、上下文窗口检查、预算和限流预检。
- 负责输出 token 估算、provider usage reconcile、账本提交和 pipeline trace 摘要。
- 负责 probe allowlist、timeout、headers 过滤和错误归一。
- 负责 schema parse；不允许 `JSON.parse` + 手写 if 作为长期稳定 contract。

公共 contract 职责：

- 稳定 DTO 默认落到 `packages/core/src/contracts/agent-gateway/*`；宿主内部-only runtime aggregate 可放在真实宿主 `schemas/`。
- TypeScript 类型必须由 zod schema 推导。
- 查询 projection 与命令 payload 要分离，避免 secret 字段误出现在 response contract。

## 当前落地顺序

1. 已有第一阶段：`GatewaySnapshotSchema`、provider / credential-file / quota projection、logs / usage、probe、token-count、preprocess、accounting 与 auth session schema。
2. Task 1：补写操作、relay、OAuth/Auth File lifecycle 的 command schema 与 parse 回归。
3. Task 2：把 backend 静态 demo 状态收敛到 repository 边界，并补 config/provider/credential/quota 写入回归。
4. Task 3：补 provider adapter、router 与 relay runtime；relay endpoint 落地后才可把真实 relay 从 `planned` 调整为 `current`。
5. Task 4：前端从占位导航升级为总览、上游方、认证文件、配额、调用管线、日志与探测等真实页面。
6. Task 5：补 secret vault / provider credential / quota / runtime config 写链路，查询 projection 继续只返回 masked value 或 `secretRef`。
7. Task 6：补 deterministic OAuth/Auth File 生命周期；vendor-specific OAuth 细节仍不得进入公共 contract。
8. Task 7：在代码与验证落地后再次更新本文，把已验证 endpoint、schema、错误语义和验证命令提升为 `current`。
