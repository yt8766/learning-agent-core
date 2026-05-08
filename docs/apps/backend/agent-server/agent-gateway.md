# Agent Gateway Backend

状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/domains/agent-gateway`、`apps/backend/agent-server/src/api/agent-gateway`
最后核对：2026-05-08

`agent-server` 已提供 Agent Gateway 第一阶段中转入口，契约以 [Agent Gateway API](/docs/contracts/api/agent-gateway.md) 和 `@agent/core` 的 `contracts/agent-gateway` schema 为准。

本主题主文档是 [Agent Gateway API](/docs/contracts/api/agent-gateway.md)。本文只覆盖 `agent-server` 内已落地的后端模块、边界和验证入口。

当前入口：

- `AgentGatewayModule`：`apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- `AgentGatewayAuthService`：负责本地双 token 登录、access token 校验与 refresh token 换发。
- `AgentGatewayService`：负责 runtime/config/provider/auth-file/quota projection、logs、usage、probe、token count、preprocess 与 usage accounting 的领域编排。
- `AgentGatewayAuthController`：挂载 `POST /api/agent-gateway/auth/login` 与 `POST /api/agent-gateway/auth/refresh`。
- `AgentGatewayController`：挂载 `GET /api/agent-gateway/snapshot`、`GET /api/agent-gateway/providers`、`GET /api/agent-gateway/credential-files`、`GET /api/agent-gateway/quotas`、`GET /api/agent-gateway/logs`、`GET /api/agent-gateway/usage`、`POST /api/agent-gateway/probe`、`POST /api/agent-gateway/token-count`、`POST /api/agent-gateway/preprocess`、`POST /api/agent-gateway/accounting`。

认证配置：

- 后端不内置默认账号或默认密码；未配置时登录会返回稳定认证错误。
- 启用本地登录必须显式配置 `AGENT_GATEWAY_AUTH_SECRET`、`AGENT_GATEWAY_ADMIN_USERNAME` 与 `AGENT_GATEWAY_ADMIN_PASSWORD`。
- 可选配置 `AGENT_GATEWAY_ADMIN_DISPLAY_NAME`；未配置时展示名使用用户名。

边界约束：

- Controller 只接收/返回稳定 contract，不直接处理 CLI Proxy raw payload。
- token 计算当前是 deterministic fallback，不引入第三方 tokenizer；接入真实 tokenizer 时必须先通过 provider/adapter 边界转换为 `TokenCountResult`。
- preprocess 阶段负责输入标准化与 input token 估算；postprocess/accounting 只返回 usage summary，不保存 raw provider response、secret、headers 或完整请求体。
- Provider、Auth File 与 Quota 当前是只读 projection；写操作、OAuth 与真实 relay 转发仍是后续扩展，实现前必须先补 core schema 和后端回归测试。

验证入口：

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway apps/backend/agent-server/test/agent-gateway apps/frontend/agent-gateway/test
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```
