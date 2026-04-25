# LLM Gateway Postgres Runtime

状态：current
文档类型：guide
适用范围：`apps/llm-gateway` 的 OpenAI-compatible gateway runtime、Postgres repository、用量日志与 bootstrap fallback。
最后核对：2026-04-25

## 真实入口

- route runtime 入口：`apps/llm-gateway/src/gateway/route-runtime.ts`
- Postgres repository：`apps/llm-gateway/src/repositories/postgres-gateway-repository.ts`
- Admin API Key store：`apps/llm-gateway/src/repositories/postgres-admin-api-key-store.ts`
- Admin Provider/Model store：`apps/llm-gateway/src/repositories/postgres-admin-provider-model-store.ts`
- API key 校验：repository 使用 `apps/llm-gateway/src/keys/api-key.ts` 的 `verifyVirtualApiKey`，按 plaintext 前 16 位 prefix 查询 `api_keys.key_prefix` 后再校验 hash。

`DATABASE_URL` 存在时，`createGatewayServiceForRuntime` 优先创建 Postgres-backed runtime。每次 gateway 调用会从 repository 加载当前模型快照，再复用现有 `createGatewayService` 完成鉴权、模型权限、限额、provider 调用和用量写入。

Admin routes 同样优先使用 Postgres store：`/api/admin/keys` 写入 `api_keys`，`/api/admin/providers` 与 `/api/admin/models` 写入 `providers`、`provider_credentials` 和 `gateway_models`。这保证后台创建 key/model/provider 后，`/api/v1/*` 可以读取同一组表。

## 表结构

repository 会在首次访问时执行 `create table if not exists`，覆盖以下表：

- `api_keys`：虚拟 API key 的 prefix/hash、状态、模型权限、RPM/TPM、每日 token/cost 限额、过期和吊销时间。
- `gateway_models`：模型 alias、provider id、上游模型名、启用状态、上下文窗口、价格、fallback aliases、admin-only 标记。
- `providers`：provider 基本配置，包括 id、kind、状态、base URL、timeout。
- `provider_credentials`：provider 凭据元数据与 `encrypted_api_key` 字段；Admin Provider routes 负责加密写入并在列表响应中只展示 redacted credential。Gateway runtime 读取该字段后必须先解密为明文 `apiKey`，adapter 不允许接收 JSON payload 或 ciphertext。
- `request_logs`：每次成功请求的 key、requested model、实际 model、provider、provider model、status、usage、cost、latency、stream、fallback attempt count 和错误字段。
- `daily_usage_rollups`：按 `key_id + usage_date` 聚合每日 token 与 cost。`recordUsage` 每次请求同步 upsert。

## Provider credential runtime

生产或任何启用 `DATABASE_URL` 的 DB-backed gateway runtime 必须同时配置：

- `LLM_GATEWAY_KEY_HASH_SECRET`：虚拟 API key hash 校验密钥。
- `LLM_GATEWAY_PROVIDER_SECRET_KEY`：provider credential vault 的主密钥，必须能归一化为 AES-256-GCM 使用的 32-byte 以上输入。
- `LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION`：provider credential key version；未配置时 runtime 使用 `env-v1`，必须与 Admin 写入 `provider_credentials.key_version` 和 encrypted payload 的 `keyVersion` 保持一致。

闭环语义：

1. Admin Provider store 使用 `ProviderSecretVault.encrypt()` 生成 JSON payload，并将 `JSON.stringify(payload)` 写入 `provider_credentials.encrypted_api_key`。
2. Postgres gateway repository 的 `listProviderRuntimeConfigs()` 是解密边界：它读取 active provider 与 active credential，解析 encrypted payload，校验 DB 行 `key_version` 与 payload `keyVersion` 一致，再通过 runtime 注入的 `ProviderSecretVault` 解密。
3. repository 返回给 provider registry 的 `apiKey` 必须是明文 provider secret；MiniMax、MiMo、OpenAI 或 openai-compatible adapter 只消费明文配置，不处理 encrypted payload。
4. 缺少 `LLM_GATEWAY_PROVIDER_SECRET_KEY`、vault 配置无效、encrypted payload 解析失败、DB `key_version` 与 payload `keyVersion` 不一致，或 vault 解密失败时，DB provider runtime 必须 fail closed，抛出 `GatewayError('UPSTREAM_UNAVAILABLE', ...)`。禁止把 ciphertext 当作 `apiKey` 打给上游。

## Fallback 语义

这一节的核心边界是：本地 bootstrap fallback 只服务开发和测试连续性；production DB runtime fail-closed 服务部署安全性，不能把两者混成同一条降级路径。

- `DATABASE_URL` 未配置：保持既有 private bootstrap runtime，继续读取 `LLM_GATEWAY_BOOTSTRAP_API_KEY`。
- `DATABASE_URL` 已配置但本地开发/测试创建 DB runtime 失败：回落 bootstrap，便于无本地 DB 时继续跑现有测试和手工调试。
- `DATABASE_URL` 已配置但缺少或无法初始化 `LLM_GATEWAY_PROVIDER_SECRET_KEY`：不回落 bootstrap，直接 fail closed。这个分支代表 DB provider credential runtime 配置错误，必须阻断，避免 encrypted payload 泄漏到 adapter 或上游 provider。
- `production` 下 DB runtime 创建失败：直接抛出错误，不静默降级。
- `production` 下没有 `DATABASE_URL`：仍沿用 bootstrap 的既有错误语义；如果未配置 `LLM_GATEWAY_BOOTSTRAP_API_KEY`，会返回依赖未配置错误。

## 验证命令

阶段 1 最小验证入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/postgres-gateway-repository.test.ts apps/llm-gateway/test/route-runtime.test.ts
pnpm --dir apps/llm-gateway typecheck
pnpm --dir apps/llm-gateway turbo:test:unit
```

若只改本文档，至少执行：

```bash
pnpm check:docs
```
