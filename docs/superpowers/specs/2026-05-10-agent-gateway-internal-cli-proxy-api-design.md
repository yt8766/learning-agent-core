# Agent Gateway Internal CLI Proxy API Design

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`
最后核对：2026-05-10

## 1. 背景

`agent-gateway` 当前已经具备独立前端、统一 Identity 登录、provider 配置、auth files、OAuth policy、quota projection、logs、system info 和一条 deterministic relay smoke 链路。它同时保留了 `CliProxyManagementClient`，可以在 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 时连接外部 CLIProxyAPI 管理端。

这不是本轮目标。用户明确要求：不是让 `agent-server` 去连接外部 CLIProxyAPI，而是在 `agent-server` 内实现一个简易版 CLIProxyAPI，让 `apps/frontend/agent-gateway` 成为真正的中转站管理中心。

当前缺口是：前端没有中转调用方用户管理，也不能给每个调用方设置额度；后端缺少以 proxy API key 鉴权的 OpenAI-compatible 推理入口、调用方 quota 校验、用量扣减和请求日志。因此现状更像 provider 管理台，不是完整中转站。

## 2. 目标

1. 在 `apps/backend/agent-server` 的 `agent-gateway` 域内实现简易内建 CLIProxyAPI。
2. 管理端登录继续复用 Identity；中转调用方使用 Agent Gateway 自有的 client/customer 模型，不与后台管理员账号混表。
3. 为每个 Gateway client 支持 API key、额度、状态、用量汇总和请求日志。
4. 提供最小 OpenAI-compatible runtime：
   - `GET /v1/models`
   - `POST /v1/chat/completions`
5. Runtime 请求使用 `Authorization: Bearer <proxy-api-key>` 鉴权，不使用 Identity access token。
6. Runtime 请求必须经过 key 状态、client 状态、quota、provider routing 和 usage accounting。
7. `apps/frontend/agent-gateway` 新增“调用方/用户管理”能力，可创建客户、发 key、设置额度、启停客户或 key、查看用量和日志。
8. 将外部 CLIProxyAPI connection 能力降级为兼容/参考路径，不再作为默认主线。

完成后，`agent-gateway` 的核心链路应是：

```text
Identity 管理员登录
  -> 创建 Gateway client
  -> 生成 proxy API key
  -> 调用方请求 /v1/chat/completions
  -> 校验 key/client/quota
  -> 选择 provider
  -> 调用 provider adapter
  -> 记录 usage/log
  -> 返回 OpenAI-compatible response
```

## 3. 非目标

- 不完整复刻 `https://github.com/router-for-me/CLIProxyAPI` 的全部管理接口、OAuth 细节、provider-specific quota payload 和高级配置。
- 不实现真实支付、账单、套餐购买、发票、代理商或多级组织。
- 不在首期做完整数据库迁移；可以先使用 memory repository，但 contract 和 service 边界必须支持后续替换为 PostgreSQL。
- 不把 Identity 用户直接当作中转调用方；Identity 只负责后台登录和全局身份。
- 不让第三方 provider 原始 response、错误对象或 secret 明文穿透到公共 contract 或前端 projection。
- 不触碰浏览器 profile、Cookie、Local Storage、Session Storage、IndexedDB 或 Chrome 缓存目录。

## 4. 方案选择

采用“Agent Gateway 内建中转客户体系”。

备选方案中，直接复用 Identity 用户实现更快，但会混淆后台管理账号与 API 消费客户；只给 API key 加额度最快，但无法回答“某个用户用了多少、还剩多少”。内建 Gateway client 模型边界更清楚，也更接近真实中转站。

Identity 管理用户与 Gateway 中转客户的关系：

- Identity account：登录 `apps/frontend/agent-gateway` 的后台管理者。
- Gateway client：被管理的 API 消费客户，可以是内部应用、外部客户、团队或自动化脚本。
- Gateway client API key：调用 `/v1/*` 的凭证，可独立启停和轮换。
- Gateway quota：绑定 client，首期支持 token 月额度和请求数月额度。

## 5. Stable Contract

所有新增稳定 JSON contract 必须 schema-first 落在 `packages/core/src/contracts/agent-gateway/`。类型从 zod schema 推导，不新增长期裸 interface。

### 5.1 GatewayClient

```ts
type GatewayClientStatus = 'active' | 'disabled' | 'suspended';

type GatewayClient = {
  id: string;
  name: string;
  description?: string;
  ownerEmail?: string;
  status: GatewayClientStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 GatewayClientApiKey

查询 projection 不返回明文 key。明文 key 只允许在创建或轮换响应中出现一次。

```ts
type GatewayClientApiKey = {
  id: string;
  clientId: string;
  name: string;
  prefix: string;
  status: 'active' | 'disabled' | 'revoked';
  scopes: Array<'chat.completions' | 'models.read'>;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

type GatewayCreateClientApiKeyResponse = {
  apiKey: GatewayClientApiKey;
  secret: string;
};
```

### 5.3 GatewayClientQuota

首期 quota 以 client 为单位，避免一开始把 provider、model、key、用户层级全部展开。后续可以兼容增加 key-level 或 model-level quota。

```ts
type GatewayClientQuota = {
  clientId: string;
  period: 'monthly';
  tokenLimit: number;
  requestLimit: number;
  usedTokens: number;
  usedRequests: number;
  resetAt: string;
  status: 'normal' | 'warning' | 'exceeded';
};
```

### 5.4 GatewayClientUsageSummary

```ts
type GatewayClientUsageSummary = {
  clientId: string;
  window: 'current-period';
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  lastRequestAt: string | null;
};
```

### 5.5 GatewayClientRequestLog

```ts
type GatewayClientRequestLog = {
  id: string;
  clientId: string;
  apiKeyId: string;
  occurredAt: string;
  endpoint: '/v1/models' | '/v1/chat/completions';
  model: string | null;
  providerId: string | null;
  statusCode: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  errorCode?: string;
};
```

## 6. HTTP Contract

### 6.1 管理 API

管理 API 挂在 `agent-server` 全局 `/api` 前缀下，继续受 Identity access token 保护。

```text
GET    /api/agent-gateway/clients
POST   /api/agent-gateway/clients
GET    /api/agent-gateway/clients/:clientId
PATCH  /api/agent-gateway/clients/:clientId
PATCH  /api/agent-gateway/clients/:clientId/enable
PATCH  /api/agent-gateway/clients/:clientId/disable

GET    /api/agent-gateway/clients/:clientId/api-keys
POST   /api/agent-gateway/clients/:clientId/api-keys
PATCH  /api/agent-gateway/clients/:clientId/api-keys/:apiKeyId
POST   /api/agent-gateway/clients/:clientId/api-keys/:apiKeyId/rotate
DELETE /api/agent-gateway/clients/:clientId/api-keys/:apiKeyId

GET    /api/agent-gateway/clients/:clientId/quota
PUT    /api/agent-gateway/clients/:clientId/quota
GET    /api/agent-gateway/clients/:clientId/usage
GET    /api/agent-gateway/clients/:clientId/logs
```

### 6.2 Runtime API

Runtime API 不放在 `/api` 下，保持 OpenAI-compatible client 习惯。

```text
GET  /v1/models
POST /v1/chat/completions
```

鉴权：

```text
Authorization: Bearer <gateway_proxy_api_key>
```

错误语义：

- `401 invalid_api_key`：key 不存在、格式错误或已吊销。
- `403 client_disabled`：client 被禁用或 suspended。
- `403 api_key_disabled`：key 被禁用。
- `429 quota_exceeded`：token 或 request quota 超限。
- `400 invalid_request`：请求体不符合 OpenAI-compatible 最小 schema。
- `400 stream_not_supported`：首期收到 `stream: true`。
- `502 provider_unavailable`：没有可用 provider 或 provider adapter 失败。

Runtime 错误响应采用 OpenAI-compatible 外壳，内部 `code` 使用上述项目自定义错误码：

```ts
type OpenAICompatibleErrorResponse = {
  error: {
    message: string;
    type: 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'rate_limit_error' | 'api_error';
    code: string;
  };
};
```

### 6.3 Chat Completions 最小兼容

首期支持非 streaming。`stream: true` 固定返回 `400 stream_not_supported`；streaming 作为后续独立设计，不进入本轮实现计划。

请求最小字段：

```ts
type OpenAIChatCompletionRequest = {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};
```

响应最小字段：

```ts
type OpenAIChatCompletionResponse = {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | 'error';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};
```

## 7. 后端结构

新增或收敛到 `apps/backend/agent-server/src/domains/agent-gateway/`：

```text
clients/
  agent-gateway-client.service.ts
  agent-gateway-client-api-key.service.ts
  agent-gateway-client-quota.service.ts
runtime/
  agent-gateway-openai-compatible.controller-support.ts
  agent-gateway-runtime-auth.service.ts
  agent-gateway-runtime-accounting.service.ts
repositories/
  agent-gateway-client.repository.ts
  memory-agent-gateway-client.repository.ts
```

Controller 只做 HTTP wiring、schema parse、guard 和错误映射。client 创建、key 生成、key hash、quota 判定、usage 写入、provider routing 全部在 domain service/repository 层。

Secret 规则：

- API key 明文只在创建/轮换响应中返回。
- repository 只保存 key hash、prefix 和 metadata。
- 前端列表只展示 prefix/status/lastUsedAt。

Runtime 顺序必须稳定：

1. parse OpenAI-compatible request。
2. 从 Authorization header 解析 proxy API key。
3. hash 查找 key，得到 client。
4. 检查 key 和 client 状态。
5. 预估 input token 和 request quota。
6. quota 不足则拒绝。
7. 选择 provider。
8. 调用 provider adapter。
9. 根据 provider usage 或 fallback token counter 计算实际 usage。
10. 记录 usage、request log、key lastUsedAt。
11. 返回 OpenAI-compatible response。

## 8. 前端结构

`apps/frontend/agent-gateway` 保持独立控制台定位，新增一个一级页面：

```text
GatewayWorkspace
  -> Dashboard
  -> Clients / 调用方管理
  -> Config
  -> AI Providers
  -> Auth Files
  -> OAuth
  -> Quota
  -> System
```

Clients 页面首期能力：

- client 列表：名称、状态、owner、tags、quota 使用率、最近请求时间。
- client 详情：API keys、quota、usage summary、recent logs。
- 创建 client。
- 启用/禁用 client。
- 创建/轮换/禁用/删除 API key；创建/轮换后一次性展示 secret。
- 设置 monthly token/request quota。

交互约束：

- 创建或轮换 key 的 secret 必须明确标注“只显示一次”。
- destructive 操作复用现有 `ConfirmDialog`。
- 成功写入后 invalidates `['agent-gateway']` 查询前缀。
- 页面只消费 schema-first camelCase contract，不消费 CLIProxyAPI raw hyphen-case payload。

## 9. 迁移与兼容

- `CliProxyManagementClient` 可以保留为 compat adapter，但不再是默认实现和文档主线。
- `AgentGatewayModule` 默认应装配内建 repository/service，而不是要求 `AGENT_GATEWAY_MANAGEMENT_API_BASE`。
- `ConnectionPage` 从主导航移出，收敛为 System/Advanced 下的“外部 CLIProxyAPI 兼容连接 / 调试参考”能力。
- 旧 `management api keys` 概念需要和新 `client api keys` 分清：
  - management key：管理外部 CLIProxyAPI 的兼容凭证。
  - client API key：调用本内建中转 `/v1/*` 的凭证。

## 10. 测试策略

必须按 TDD 推进。Red 阶段优先补以下测试：

- `packages/core/test/agent-gateway`：新增 client、api key、quota、usage、runtime request/response schema parse。
- `apps/backend/agent-server/test/agent-gateway`：
  - 创建 client 后可设置 quota。
  - 创建 API key 只在响应中返回一次 secret，列表只返回 prefix。
  - disabled client / disabled key 不能调用 `/v1/chat/completions`。
  - quota exceeded 返回 `429 quota_exceeded`。
  - successful chat completion 会写 usage、request log、lastUsedAt。
  - `/v1/models` 通过 client API key 返回模型列表。
- `apps/frontend/agent-gateway/test`：
  - API client 覆盖 clients/key/quota/logs。
  - Clients 页面渲染列表、quota 使用率和 API key 状态。
  - 创建/轮换 key 显示一次性 secret。
  - 禁用 client 使用确认弹窗。

## 11. 验证

实现完成前至少执行：

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/frontend/agent-gateway typecheck
pnpm check:docs
```

如果实现触达共享包 exports、backend build 或 package graph，还必须执行：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## 12. 文档影响

必须更新：

- `docs/contracts/api/agent-gateway.md`
- `docs/apps/backend/agent-server/agent-gateway.md`
- `docs/apps/frontend/agent-gateway/README.md`
- `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`

必须清理或改写：

- 任何把当前主线描述为“连接外部 CLIProxyAPI”的段落。
- 任何混淆 management API key 与 client API key 的描述。
- 任何暗示 provider quota 等同于调用方用户额度的说明。

后续 AI 优先阅读顺序：

1. 本 spec。
2. `docs/contracts/api/agent-gateway.md`。
3. `docs/apps/backend/agent-server/agent-gateway.md`。
4. `docs/apps/frontend/agent-gateway/README.md`。

## 13. 完成条件

本计划只有在以下条件全部满足时才算完成：

- `agent-server` 默认提供内建简易 CLIProxyAPI。
- `agent-gateway` 前端可以管理 Gateway client、API key、quota、usage 和 logs。
- `/v1/models` 和 `/v1/chat/completions` 可用，并通过 client API key 鉴权。
- Runtime 调用会执行 quota 校验、usage 记录和 request log 记录。
- 明文 client API key 不会出现在列表、日志或持久化 projection 中。
- 外部 CLIProxyAPI connection 不再作为默认主线出现在产品文案和 contract 文档中。
- 受影响测试、类型检查和文档检查通过，或明确记录与本轮无关的 blocker。
