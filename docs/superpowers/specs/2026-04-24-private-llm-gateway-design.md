# Private LLM Gateway Design

状态：snapshot
文档类型：note
适用范围：`apps/llm-gateway`
最后核对：2026-04-24

## 1. 背景

当前使用者同时持有 MiniMax、小米 MiMo-V2.5-Pro、GPT 等模型入口，日常切换成本高，也缺少统一的 API Key、用量记录和成本保护。

本设计定义一个私用版 LLM 中转站，默认落在当前 monorepo 的 `apps/llm-gateway`。它不是公开售卖平台，也不并入现有开发自治主链。第一版目标是让个人或极小范围可信使用者通过一个 OpenAI-compatible API 访问多个上游模型，同时由私有后台管理登录、API Key、模型权限、用量和限额。

## 2. 产品定位

`apps/llm-gateway` 是私有 LLM Gateway 应用。

核心价值：

- 一个统一 `base_url` 调 GPT、MiniMax、MiMo。
- 登录后台后创建虚拟 API Key，外部客户端必须带 key 才能调用。
- 用模型别名屏蔽不同厂商模型名和参数差异。
- 记录每次请求的 token、耗时、状态和估算成本。
- 通过 RPM、TPM、每日预算和一键吊销避免 key 泄露或脚本失控。

第一版默认只服务个人私用，不提供开放注册、充值、订单、公开模型市场或多租户商业账单。

## 3. 参考产品取舍

参考对象：

- OpenRouter：统一模型入口、OpenAI-compatible API、Key 查询、BYOK 思路。
- LiteLLM Proxy：虚拟 Key、预算、限流、费用跟踪、模型路由。
- Portkey：企业级 Virtual Key、预算、限流、策略与观测。

本项目第一版只吸收以下能力：

- OpenAI-compatible API。
- Virtual API Key。
- 模型权限白名单。
- 用量与成本记录。
- Key 级预算和限流。
- Provider adapter 与 fallback。

暂不吸收：

- 公开注册和付费充值。
- 团队、组织、成员角色矩阵。
- 企业 SSO。
- 复杂 policy engine。
- 多租户账单、发票、订单。

## 3.1 Codex Plus / Pro 边界

Codex Plus / Pro 会员额度不能作为本中转站的上游 provider。

原因：

- ChatGPT / Codex 订阅与 OpenAI API 是不同计费系统。
- ChatGPT Plus / Pro 不是可转发的 API credit。
- 通过 Cookie、浏览器自动化、Codex CLI 包装或私有接口把会员额度转成 `/v1/chat/completions` 上游，存在账号安全、稳定性和合规风险。
- 本项目的虚拟 API Key 只能代理官方 API Key 能力，不能代理个人 ChatGPT 登录态。

允许的集成方式：

- 后台提供 Codex 额度页面链接：`https://chatgpt.com/codex/settings/usage`。
- 管理员自己在 Codex App / CLI / IDE 中登录 Plus 或 Pro 账号使用 Codex。
- 如需让中转站调用 OpenAI 模型，必须配置 OpenAI Platform API Key。

## 4. 目标与非目标

### 4.1 目标

- 提供私有管理后台，只有管理员可登录。
- 支持管理员创建、禁用、吊销虚拟 API Key。
- 对外暴露 OpenAI-compatible 接口，方便 Cursor、Chatbox、Open WebUI、LangChain、Agent 框架接入。
- 接入 GPT、MiniMax、小米 MiMo-V2.5-Pro 三类 provider。
- 支持非流式和流式 chat completions。
- 支持模型别名与 provider 模型映射。
- 记录请求日志、token、耗时、错误和估算成本。
- 支持 API Key 级 RPM、TPM、每日 token 或金额预算。
- 支持 provider 失败时按配置 fallback。

### 4.2 非目标

- 第一版不做开放注册。
- 第一版不做支付、充值、余额或订单。
- 第一版不做团队和组织。
- 第一版不做复杂 prompt 管理。
- 第一版不做模型输出内容审核平台。
- 第一版不接入 `learning-agent-core` 的 runtime / agent 主链。
- 第一版不追求覆盖所有 OpenAI API，只先覆盖 chat completions 与 models。
- 第一版不支持把 Codex Plus / Pro、ChatGPT Plus / Pro 或网页登录态作为 provider。

## 5. 用户与权限

第一版只有两类身份：

- `admin`：唯一后台管理员，可管理 provider、模型、API Key、日志和限额。
- `api_key`：外部客户端调用身份，只能访问被授权模型和只读 key 信息。

默认策略：

- 关闭公开注册。
- 管理员账号通过初始化命令或环境变量创建。
- 后台登录使用 session 或 JWT cookie。
- 外部 API 使用 `Authorization: Bearer <virtual-api-key>`。
- 虚拟 API Key 明文只在创建时展示一次，数据库只存 hash。

## 6. 对外 API

第一版暴露以下 OpenAI-compatible API：

```text
GET  /v1/models
GET  /v1/key
POST /v1/chat/completions
```

### 6.1 `GET /v1/models`

返回当前 API Key 可访问的模型别名列表。

响应示例：

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-main",
      "object": "model",
      "owned_by": "llm-gateway"
    },
    {
      "id": "mimo-main",
      "object": "model",
      "owned_by": "llm-gateway"
    }
  ]
}
```

### 6.2 `GET /v1/key`

返回当前 key 的状态、限额和已用量。

响应字段：

- `id`
- `name`
- `status`
- `models`
- `rpm_limit`
- `tpm_limit`
- `daily_token_limit`
- `daily_cost_limit`
- `used_tokens_today`
- `used_cost_today`
- `expires_at`

### 6.3 `POST /v1/chat/completions`

请求尽量兼容 OpenAI chat completions：

```json
{
  "model": "gpt-main",
  "messages": [
    {
      "role": "user",
      "content": "hello"
    }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048
}
```

网关职责：

1. 校验虚拟 API Key。
2. 校验模型权限。
3. 检查 RPM、TPM、每日预算和最大 token。
4. 解析模型别名到 provider 模型。
5. 调用对应 provider adapter。
6. 将 provider 响应归一化为 OpenAI-compatible 响应或 SSE chunk。
7. 写入请求日志和用量记录。

## 7. 管理后台

第一版后台页面：

- 登录页。
- Dashboard：今日请求数、今日 token、今日估算成本、失败率、平均延迟。
- API Keys：创建、禁用、吊销、查看限额和最近使用时间。
- Models：配置模型别名、provider、真实模型名、是否启用、默认 fallback。
- Providers：配置 OpenAI、MiniMax、MiMo 的 base URL、密钥状态和健康状态。
- Logs：查看请求日志、按 key/model/status 过滤。

后台不需要做营销页。登录后直接进入 dashboard。

## 8. Provider Adapter 契约

所有 provider adapter 实现同一项目内接口：

```ts
interface ProviderAdapter {
  id: string;
  complete(request: GatewayChatRequest): Promise<GatewayChatResponse>;
  stream(request: GatewayChatRequest): AsyncIterable<GatewayChatStreamChunk>;
  healthCheck(): Promise<ProviderHealth>;
}
```

adapter 负责：

- 将统一 request 转成上游厂商请求。
- 将上游响应转成统一 response。
- 将上游流式事件转成 OpenAI-compatible SSE chunk。
- 归一化 token usage。
- 归一化错误。

adapter 不负责：

- 用户登录。
- 虚拟 API Key 鉴权。
- 预算和限流。
- 后台页面。
- 请求日志持久化。

## 9. 模型与路由

第一版采用显式模型别名：

```text
gpt-main      -> openai/gpt-4.1 或 gpt-5
cheap-fast    -> openai/gpt-4o-mini
minimax-main  -> minimax/<actual-model>
mimo-main     -> xiaomi/MiMo-V2.5-Pro
```

每个模型配置包含：

- `alias`
- `provider`
- `provider_model`
- `enabled`
- `context_window`
- `input_price_per_1m_tokens`
- `output_price_per_1m_tokens`
- `fallback_aliases`
- `admin_only`

路由顺序：

1. 按请求 `model` 查模型别名。
2. 校验 key 是否允许使用该模型。
3. 调用目标 provider。
4. 如果 provider 返回可 fallback 错误，并且模型配置了 fallback，则按顺序尝试 fallback。
5. 日志中保留原始目标模型和实际执行模型。

## 10. 数据模型

第一版建议使用 PostgreSQL。

核心表：

- `admin_users`
- `provider_credentials`
- `models`
- `api_keys`
- `api_key_model_permissions`
- `request_logs`
- `usage_daily_rollups`

### 10.1 `api_keys`

关键字段：

- `id`
- `name`
- `key_prefix`
- `key_hash`
- `status`
- `rpm_limit`
- `tpm_limit`
- `daily_token_limit`
- `daily_cost_limit`
- `expires_at`
- `last_used_at`
- `created_at`
- `revoked_at`

### 10.2 `request_logs`

关键字段：

- `id`
- `api_key_id`
- `requested_model`
- `resolved_provider`
- `resolved_model`
- `fallback_from_model`
- `status`
- `error_code`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost`
- `latency_ms`
- `stream`
- `created_at`

默认不长期保存完整 prompt 和 completion。若需要调试，可增加短期 debug 开关，并设置自动过期，避免隐私和磁盘风险。

## 11. 限流与预算

第一版限制范围：

- API Key 级 RPM。
- API Key 级 TPM。
- API Key 级每日 token 限额。
- API Key 级每日金额限额。
- 全局单请求最大 `max_tokens`。
- 全局单请求最大输入长度。

建议使用 Redis 做滑动窗口或固定窗口计数，PostgreSQL 做每日用量事实源。

拦截顺序：

1. Key 状态、过期时间。
2. 模型权限。
3. 请求体大小和 `max_tokens`。
4. RPM。
5. 预估 TPM 和每日预算。
6. provider 执行。
7. 执行后用真实 usage 修正统计。

预算预估不足时允许保守拒绝，不允许超额后再补救。

## 12. 错误语义

内部错误统一为：

- `AUTH_ERROR`
- `KEY_DISABLED`
- `KEY_EXPIRED`
- `MODEL_NOT_ALLOWED`
- `MODEL_NOT_FOUND`
- `RATE_LIMITED`
- `BUDGET_EXCEEDED`
- `CONTEXT_TOO_LONG`
- `UPSTREAM_AUTH_ERROR`
- `UPSTREAM_RATE_LIMITED`
- `UPSTREAM_TIMEOUT`
- `UPSTREAM_UNAVAILABLE`
- `UPSTREAM_BAD_RESPONSE`

对外响应兼容 OpenAI error 结构：

```json
{
  "error": {
    "message": "API key daily budget exceeded",
    "type": "budget_exceeded",
    "code": "BUDGET_EXCEEDED"
  }
}
```

## 13. 技术选型建议

推荐默认栈：

- App：Next.js，TypeScript，部署目标为 Vercel。
- API：Next.js Route Handlers，提供 `/v1/*` OpenAI-compatible API。
- Frontend：Next.js App Router 管理后台。
- DB：托管 PostgreSQL，例如 Neon、Supabase 或 Vercel 可连接的 Postgres 服务。
- Rate Limit：托管 Redis，例如 Upstash Redis 或 Vercel 可连接的 Redis 服务。
- ORM：Drizzle 或 Prisma。
- Auth：服务端 session 或 JWT cookie。
- 部署：Vercel Project，Root Directory 指向 `apps/llm-gateway`。

不推荐第一版使用常驻 NestJS 服务作为主部署形态，因为 Vercel 更适合无服务器函数和 Next.js 全栈应用。若后续需要长连接 worker、队列消费者或自托管常驻进程，可再把执行层拆成独立 service。

## 14. 部署形态

第一版按 Vercel monorepo 应用部署：

```text
apps/llm-gateway
  app/
    admin/
    api/v1/models/route.ts
    api/v1/key/route.ts
    api/v1/chat/completions/route.ts
  src/
    auth/
    providers/
    gateway/
    db/
    rate-limit/
  vercel.json
```

Vercel 项目设置：

- Import 当前 Git repository。
- Root Directory 选择 `apps/llm-gateway`。
- Framework 选择 Next.js 或让 Vercel 自动识别。
- 环境变量配置 provider key、数据库连接、Redis 连接、session secret、加密密钥。
- 自定义域名可直接绑定到该 Vercel Project。

对外路径：

- `/admin`：管理后台。
- `/api/v1/*`：Next.js 原生 API 路径。
- `/v1/*`：通过 rewrite 映射到 `/api/v1/*`，保持 OpenAI-compatible 客户端接入体验。

`vercel.json` 需要提供 rewrite：

```json
{
  "rewrites": [
    {
      "source": "/v1/:path*",
      "destination": "/api/v1/:path*"
    }
  ]
}
```

流式响应使用 Web Streams / SSE。`POST /v1/chat/completions` 在 `stream: true` 时必须持续输出 OpenAI-compatible `data: ...` chunk，并以 `data: [DONE]` 结束。

本地开发可以使用 Docker Compose 启动 Postgres 和 Redis，但应用本身仍通过 Next.js dev server 启动：

```text
next dev
postgres
redis
```

生产环境必须配置：

- HTTPS。
- 强管理员密码。
- Provider 密钥加密密钥。
- 数据库备份。
- 禁止开放注册。
- 防止后台暴露到不可信公网，或至少加额外访问控制。
- Vercel function 超时、响应体大小、流式输出限制必须在实现前按当前套餐确认。

## 15. MVP 验收标准

MVP 完成时应满足：

- 管理员可以登录后台。
- 管理员可以配置 OpenAI、MiniMax、MiMo provider。
- 管理员可以配置模型别名。
- 管理员可以创建并吊销虚拟 API Key。
- 使用虚拟 API Key 可以调用 `/v1/models`。
- 使用虚拟 API Key 可以调用 `/v1/chat/completions`。
- `stream: true` 可以返回 OpenAI-compatible SSE。
- 未授权 key、禁用 key、超限 key 会被拒绝。
- 请求日志能看到模型、provider、token、耗时、状态和错误。
- Dashboard 能看到今日请求量、token、估算成本、失败率。

## 16. 验证计划

第一版至少补以下验证：

- Type：后端、前端、共享 contract TypeScript 检查。
- Spec：API request、API response、provider result、error response 使用 schema parse 回归。
- Unit：API Key hash/verify、模型权限、限流预算、provider error mapping。
- Demo：Next.js 本地启动后，用一个虚拟 key 调通 mock provider 或真实 provider；Postgres 和 Redis 可由本地 Docker Compose 提供。
- Integration：`/v1/chat/completions` 从鉴权、限流、路由、provider adapter、日志写入到响应返回的闭环测试。
- Deployment：在 Vercel preview 环境验证 `/admin`、`/v1/models`、`/v1/chat/completions` 和 `stream: true`。

## 17. 后续扩展

当私用版稳定后，再考虑：

- BYOK：允许不同 key 绑定不同上游 provider key。
- 多管理员或小团队。
- 邀请码注册。
- 余额、充值、订单。
- 模型质量对比。
- Prompt/请求模板。
- 更细粒度策略，例如按时间段、IP、客户端、模型组限流。
- 与 `learning-agent-core` 对接，作为统一外部 LLM Provider。
