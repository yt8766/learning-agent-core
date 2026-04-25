# LLM Gateway Provider Runtime

状态：current
文档类型：guide
适用范围：`apps/llm-gateway` provider adapter、rate limiter、bootstrap runtime
最后核对：2026-04-25

## 1. 当前实现

`apps/llm-gateway` 当前已经提供 provider runtime 基础设施：

- `src/providers/provider-http-client.ts`：provider URL 拼接、timeout fetch、JSON response parse。
- `src/providers/provider-error-mapping.ts`：provider HTTP/fetch 错误摘要与 secret 脱敏。
- `src/providers/provider-stream-parser.ts`：基础 SSE `data:` frame parser，能区分 JSON payload 与 `[DONE]`。
- `src/providers/openai-provider-adapter.ts`：真实 OpenAI Chat Completions adapter，支持非流式和 SSE stream chunk 映射。
- `src/providers/minimax-provider-adapter.ts`：真实 MiniMax OpenAI-compatible Chat Completions adapter，支持非流式和 SSE stream chunk 映射；无配置时保持 fail-closed。
- `src/providers/mimo-provider-adapter.ts`：真实 MiMo OpenAI-compatible Chat Completions adapter，支持非流式和 SSE stream chunk 映射；无配置时保持 fail-closed。
- `src/rate-limit/redis-rate-limiter.ts`：Redis fixed-window limiter，使用 `eval` 执行原子窗口计数。
- `src/rate-limit/upstash-rate-limiter.ts`：Upstash REST fixed-window limiter，供 Vercel production 使用。
- `src/secrets/provider-secret-vault.ts`：Provider credential 加密工具，使用 AES-256-GCM 加密、HMAC-SHA256 fingerprint，密钥由调用方注入。
- `src/models/model-fallback.ts` 与 `src/gateway/fallback-policy.ts`：模型 fallback 链构建与 fallback eligible 错误判断。
- `src/providers/provider-adapter-registry.ts`：providerId 到 adapter factory 的 registry，避免主流程堆 provider-specific 分支。
- `src/usage/usage-accounting.ts`：统一 usage 来源选择、stream usage 估算与成本计算。
- `src/contracts/admin-provider.ts` 与 `src/contracts/admin-model.ts`：Provider、ProviderCredential、GatewayModel 后台管理稳定 schema。

OpenAI、MiniMax、MiMo adapter 都通过 `baseUrl`、`apiKey`、`timeoutMs` 注入配置。无参调用仍返回 fail-closed adapter，用于兼容旧测试和未配置环境。

## 2. Rate Limit Runtime

`createRateLimitersForRuntime()` 的当前策略：

- 配置了 `UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN` 时，RPM/TPM 都使用 Upstash limiter。
- `NODE_ENV=production` 且缺少 Upstash 配置时，runtime 抛 `RATE_LIMITER_UNAVAILABLE`，不会回落到 memory limiter。
- 非生产环境缺少 Redis 配置时，使用 memory limiter，便于本地开发和单测。

Redis/Upstash 只负责短窗口 RPM/TPM 计数。每日 token 和成本预算仍应来自 PostgreSQL 的 usage rollup。

## 3. OpenAI-Compatible Adapters

OpenAI、MiniMax、MiMo adapter 当前都按 OpenAI-compatible Chat Completions 协议调用：

```text
POST <baseUrl>/chat/completions
```

请求映射：

- `GatewayChatRequest.providerModel` -> OpenAI `model`
- `GatewayChatRequest.messages` -> OpenAI `messages`
- `GatewayChatRequest.temperature` -> OpenAI `temperature`
- `GatewayChatRequest.maxTokens` -> OpenAI `max_tokens`
- `GatewayChatRequest.stream` -> OpenAI `stream`

响应映射：

- 对外 `response.model` 始终使用 gateway alias，即 `GatewayChatRequest.model`
- provider 真实模型名只应进入后续 request log 的 `provider_model`
- usage 从 provider 非流式 response 映射到 `GatewayUsage`
- SSE stream 解析 OpenAI-compatible chunk，并忽略 `[DONE]`；最终 `[DONE]` 由 gateway SSE encoder 统一输出
- malformed JSON、缺字段或非法 chunk 会映射为 `UPSTREAM_BAD_RESPONSE`
- 401/403 映射为 `UPSTREAM_AUTH_ERROR`，429 映射为 `UPSTREAM_RATE_LIMITED`，5xx 和网络不可达映射为 `UPSTREAM_UNAVAILABLE`，Abort/Timeout 映射为 `UPSTREAM_TIMEOUT`

当前 stream usage 已在 `GatewayService.stream(...)` 中统一结算，并写入 request log / usage record。内部 stream chunk contract 支持 provider 在最终 chunk 附带 `usage`；usage 来源优先级为：

1. provider final usage：最终 usage chunk（通常为 `choices: []` 或无增量内容且带 finish reason）携带的 `usage`。
2. stream accumulated usage：普通 stream chunk 携带的累计 `usage`。
3. gateway estimated usage：provider 未给 usage 时，按 prompt messages 与已输出文本做保守估算。

OpenAI、MiniMax、MiMo adapter 会透传 OpenAI-compatible SSE chunk 上的可选 `usage` 字段；`[DONE]` 仍由 gateway SSE encoder 统一输出。

MiniMax/MiMo 的真实 adapter 边界仅限 provider HTTP 调用和 response/chunk 映射。它们尚不负责从后台 ProviderCredential 解密、选择 credential 或把 admin 配置注入 runtime；这些仍由主控 runtime/provider registry 集成层负责。

## 3.1 Provider/Model Admin Contracts

后台 Provider/Model contract、route、repository 与可复用客户端表单实现已接线，当前稳定边界如下：

- Provider schema 位于 `src/contracts/admin-provider.ts`，record 包含 `id`、`name`、`kind`、`status`、`baseUrl`、`timeoutMs` 与时间戳。
- Provider credential response 只返回 `keyPrefix`、`fingerprint`、`keyVersion`、状态与时间戳；schema 使用 strict object，拒绝 `plaintextApiKey`、`encryptedApiKey`、ciphertext 或可解密 payload 泄漏。`src/admin/admin-console.tsx` 的 Provider 表格只展示 credential `status` 与 `keyPrefix`，不展示 fingerprint；当前 `/admin` 首屏挂载的是受保护 dashboard shell，不直接渲染这些表单。
- Model schema 位于 `src/contracts/admin-model.ts`，record 包含 `alias`、`providerId`、`providerModel`、`enabled`、`contextWindow`、价格、`fallbackAliases`、`capabilities` 与 `adminOnly`。
- Model alias 必须是 lowercase slug；`contextWindow` 必须为正整数；价格为非负数或 `null`。

route service 入口为 `src/admin/admin-provider-model-routes.ts`，Postgres store 为 `src/repositories/postgres-admin-provider-model-store.ts`。`DATABASE_URL` 存在时后台写入 `providers`、`provider_credentials` 与 `gateway_models`，否则使用内存 store 便于本地和单测。后续扩展后台 API 时必须继续复用这些 schema，不要在 route 或 UI 中临时定义第二套 DTO。

## 4. Fallback Runtime

`GatewayService.complete(...)` 当前已接入非流式 fallback：

- 只校验请求模型的 API Key 权限。
- 从请求模型开始，按 `fallbackAliases` 深度优先构建候选链。
- 默认最大深度为 5。
- `UPSTREAM_TIMEOUT`、`UPSTREAM_RATE_LIMITED`、`UPSTREAM_UNAVAILABLE`、`UPSTREAM_BAD_RESPONSE` 可进入 fallback。
- API Key、网关限流、预算、provider auth 等错误不会 fallback。
- 对外 response 的 `model` 保持请求 alias；request log 里记录实际执行 alias 和 `fallbackAttemptCount`。

`GatewayService.stream(...)` 也使用同一 fallback 链，但遵守 streaming 的透明性边界：

- 建连或首个 chunk 前出现 fallback-eligible 错误时，尝试下一个 `fallbackAliases` 候选。
- fallback 成功后，request log / usage record 的 `model` 记录实际执行 alias，`requestedModel` 保持原请求 alias，`fallbackAttemptCount` 记录实际候选序号。
- 一旦任一 chunk 已经输出，后续 provider 错误不会再切 provider；gateway 会写入 `status: error` 的 request log，记录已输出内容对应的 usage 来源与错误码，然后向调用方抛出原错误。
- 非 fallback-eligible 错误仍直接抛出，不进入候选链。

## 5. Route-Level Tests

当前 route-level helper 位于 `apps/llm-gateway/test/helpers/`：

- `http-test-helpers.ts`：构造 JSON request、读取 JSON/SSE response。
- `create-route-test-runtime.ts`：为 route tests 注入 mock gateway service。

已覆盖：

- `GET /api/v1/models` missing auth 与 valid key。
- `GET /api/v1/key` missing auth 与 valid key。
- `POST /api/v1/chat/completions` missing auth、invalid key、非流式成功、流式 SSE 成功。

route-level tests 使用 mock gateway service，不访问真实 provider。真实 provider smoke 仍只应放手工或 preview 验证。

## 6. 尚未完成

当前剩余事项只保留仍未被自动化闭环证明的部分：

- 真实 OpenAI、MiniMax、MiMo provider smoke 仍待手工或 Preview 环境验证，不放入默认单测，避免访问真实上游网络。
- Provider fallback 已接入非流式 `complete()` 与流式 `stream()`；真实上游 fallback smoke 仍待手工或 Preview 环境验证。
- Usage accounting helper 已接入 stream 的 provider final usage、stream accumulated usage 与网关估算路径；公共 route contract 仍保持 OpenAI-compatible chunk 透传。

后续修改 provider runtime 时，默认补对应 adapter/helper 测试，不访问真实上游网络；真实 provider smoke 只放手工或 preview 验证。
