# LLM Gateway Vercel Preview 验收

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`、Vercel Preview、PostgreSQL、Upstash、Admin 后台
最后核对：2026-04-25

## 1. 目标

本清单用于阶段 7 部署验收收口。Preview 环境必须证明 DB-backed `/api/v1` runtime、Admin auth、Provider/Model 后台录入和 provider credential 注入都走同一套部署配置，而不是依赖本地内存 bootstrap 假象。

## 2. Preview 环境变量

Vercel Project 的 Root Directory 必须是 `apps/llm-gateway`。Preview 环境至少配置：

- `DATABASE_URL`：托管 PostgreSQL 连接串。Preview 不使用本地 `POSTGRES_*`。
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `LLM_GATEWAY_ADMIN_JWT_SECRET`
- `LLM_GATEWAY_PROVIDER_SECRET_KEY`
- `LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION`：默认可用 `env-v1`，轮换时必须与后台写入的 credential key version 对齐。
- `LLM_GATEWAY_KEY_HASH_SECRET`
- `LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD`：仅用于首次 owner bootstrap。
- `LLM_GATEWAY_BOOTSTRAP_API_KEY`：只作为迁移期 `/api/v1` 私有 bootstrap key，创建 DB 虚拟 key 后不再作为验收主路径。

Preview 可保留 `OPENAI_API_KEY`、`MINIMAX_API_KEY`、`MIMO_API_KEY` 作为 bootstrap seed，但真实验收必须覆盖 provider 后台录入/注入：在 Admin 后台录入 provider credential，通过 `ProviderSecretVault` 加密入库，再由 DB runtime 解密并注入 adapter。

## 3. Vercel Preview Smoke

阶段 7 Preview 验收现在提供半自动入口：

```bash
PREVIEW_BASE_URL=https://<preview-domain> \
LLM_GATEWAY_PREVIEW_API_KEY=<virtual-api-key> \
LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD=<preview-admin-password> \
pnpm --dir apps/llm-gateway preview:smoke
```

脚本读取的环境变量：

- `PREVIEW_BASE_URL`：Preview 根域名，例如 `https://xxx.vercel.app`，不要带 `/v1`。
- `LLM_GATEWAY_PREVIEW_API_KEY`：后台创建的虚拟 API key，用于 `/api/v1/models`、`/api/v1/key`、`/api/v1/chat/completions`。
- `LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD`：Preview admin 密码。脚本会用 `POST /api/admin/auth/login` 换取 access token，默认用户名为 `admin`。
- `LLM_GATEWAY_PREVIEW_ADMIN_TOKEN`：可选。如果已手工取得 admin access token，可替代 admin password。
- `LLM_GATEWAY_PREVIEW_ADMIN_USERNAME`：可选，默认 `admin`。
- `LLM_GATEWAY_PREVIEW_MODEL`：可选。未提供时脚本使用 `/api/v1/models` 返回的第一个 model id。
- `LLM_GATEWAY_PREVIEW_STREAM=1`：可选，额外执行 stream smoke 并检查 SSE `[DONE]`。
- `LLM_GATEWAY_PREVIEW_TIMEOUT_MS`：可选，默认 `20000`。

缺少 `PREVIEW_BASE_URL`、`LLM_GATEWAY_PREVIEW_API_KEY`，或同时缺少 `LLM_GATEWAY_PREVIEW_ADMIN_TOKEN` 与 `LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD` 时，脚本必须失败并输出缺失项；它不会把 API key、admin token 或 admin password 打印到日志。

半自动脚本覆盖：

1. `POST /api/admin/auth/login`：使用 admin password 登录，或直接使用 `LLM_GATEWAY_PREVIEW_ADMIN_TOKEN`。
2. admin auth smoke：用 `Authorization: Bearer <accessToken>` 访问 `GET /api/admin/providers`。
3. `GET /api/v1/models`：确认虚拟 key 可列出至少一个 model。
4. `GET /api/v1/key`：确认虚拟 key metadata 可读。
5. `POST /api/v1/chat/completions`：用已启用 model alias 发起非 stream 最小 completion。
6. 可选 `POST /api/v1/chat/completions` stream：设置 `LLM_GATEWAY_PREVIEW_STREAM=1` 后检查 SSE content-type 与 `[DONE]` sentinel。

仍需人工完成的前置步骤：

1. 打开 `/admin/login`，使用 `admin` 和 Preview 的 `LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD` 完成首次登录。
2. 在后台创建 provider，并通过 `POST /api/admin/providers/:id/credentials` 录入真实 provider key。响应只能展示 redacted credential，不能返回 plaintext、ciphertext 或可解密 payload。
3. 在后台创建 model alias，将 `providerId`、`providerModel`、`credentialId` 与价格/上下文窗口写入 PostgreSQL。
4. 在后台创建虚拟 API key，保存创建响应里唯一一次出现的 plaintext。
5. 运行 `preview:smoke` 执行 admin auth smoke 与 `/api/v1` smoke。
6. 人工确认 request log / usage rollup 写入 PostgreSQL，RPM/TPM 走 Upstash limiter。

人工步骤完成后运行 `preview:smoke`。如果脚本在 `/api/v1/models` 报 no models、在 chat completions 报 provider 错误，通常表示 provider credential、model alias、credentialId 或上游 provider key 仍未正确录入；不要把这类红灯视为脚本失败。

## 4. Fallback 与 Fail-Closed 规则

本地 bootstrap fallback 与 production DB runtime fail-closed 必须分开理解：

- 本地 bootstrap fallback：非生产环境缺少 `DATABASE_URL`，或本地 DB-backed runtime 初始化失败时，可以回到 `LLM_GATEWAY_BOOTSTRAP_API_KEY` 和内存配置，方便开发、单测和手工调试。
- production DB runtime fail-closed：Preview/Production 配置了 `DATABASE_URL` 后，DB runtime 初始化失败、缺少 `LLM_GATEWAY_PROVIDER_SECRET_KEY`、provider credential 解密失败、缺少 Upstash 配置或 virtual key hash secret 无效，都必须阻断请求，不能静默回落到 bootstrap runtime 或 memory limiter。

## 5. 文档与 Env 漂移验证

修改 `.env.example`、本清单或其他 LLM Gateway 部署文档后，至少执行：

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
pnpm check:docs
```
