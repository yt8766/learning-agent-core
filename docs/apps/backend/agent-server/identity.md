# agent-server Identity 域

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/domains/identity`
最后核对：2026-05-12

`agent-server` 已承接统一后端目标下的 Identity 域主入口。新增或迁移身份逻辑时，优先落在 `src/domains/identity`，HTTP 入口只保留在 `src/api/identity`，不要重新引入独立 auth backend 或让应用层直连历史 auth package。

## 1. 路由入口

当前同时提供 canonical identity 路由和迁移期 legacy auth alias：

```text
POST /api/identity/login
POST /api/identity/refresh
POST /api/identity/logout
GET  /api/identity/me

GET   /api/identity/users
POST  /api/identity/users
PATCH /api/identity/users/:userId/disable
PATCH /api/identity/users/:userId/enable
```

`/api/identity/*` 是统一后端唯一身份入口；`/api/auth/*` 已 hard cut 删除。新增前端或后端调用只能接 `/api/identity/*`。

Identity 业务错误会以稳定 `AuthErrorCode` 返回，并映射为客户端可处理的 HTTP 状态码。例如错误账号或密码返回 `invalid_credentials` + `401`，禁用账号返回 `account_disabled` + `403`，token 缺失、无效、过期或 refresh token 复用返回 `401`；不要让这些业务错误穿透为 `500`。

## 2. 模块职责

- `src/api/identity/*`：Nest controller 与路由 alias，只负责 HTTP 参数、状态码和调用 identity service。
- `src/domains/identity/schemas/*`：复用 `@agent/core` 的 auth request schema，保持请求 contract 与公共契约一致。
- `src/domains/identity/services/*`：登录、JWT 签发、密码校验、refresh token 轮换、session revoke、种子用户与用户管理。
- `src/domains/identity/repositories/*`：Identity 持久化端口和实现。默认实现仍是内存 repository；显式设置 `IDENTITY_REPOSITORY=postgres` 时，`src/domains/identity/runtime/identity-repository.provider.ts` 会使用 Postgres repository。
- `src/domains/identity/runtime/*`：Identity repository provider 与数据库 schema bootstrap。Postgres 模式必须提供 `IDENTITY_DATABASE_URL` 或 `DATABASE_URL`，启动时会执行 `IDENTITY_SCHEMA_SQL`，确保 `identity_users`、`identity_password_credentials`、`identity_refresh_sessions` 与 `identity_refresh_tokens` 存在。

## 3. Token 与 Session 语义

`IdentityAuthService` 负责完整登录链路：

- 登录成功后签发 HMAC JWT access token 与 refresh token。
- access token `aud` 覆盖 `agent-admin`、`agent-gateway` 与 `knowledge`，新增受保护应用应优先复用 Identity token，而不是新增独立登录口令。
- refresh token 采用轮换机制；`/api/identity/refresh` 成功响应会返回新的 access token 和 refresh token，调用方必须保存新的 refresh token。旧 refresh token 被再次使用时，会撤销对应 session 并返回 `refresh_token_reused`。
- logout 会撤销当前 session。
- `/api/identity/me` 支持从 Bearer token 或已解析 principal 查询当前用户。

JWT 由 `IdentityJwtProvider` 封装，业务层不要直接拼第三方 JWT payload。Refresh token、session 与用户状态由 repository 端口承载；切换 Postgres 只能通过 `IDENTITY_REPOSITORY=postgres` 的 provider 完成，不要让 service 直接依赖 `pg` 或表结构。

## 4. 密码兼容边界

当前 `agent-server` Identity 域使用 `IdentityPasswordService` 内置的 `identity-scrypt$1$...` 哈希格式，不直接复用历史 standalone auth backend 的 bcrypt 运行时依赖。

不要把 legacy bcrypt 用户行直接指向当前默认 provider。需要迁移历史账号时，必须先补齐明确的兼容 password provider 或一次性迁移脚本，并同步更新 schema、测试和本文档。

## 5. 验证入口

涉及 Identity 域时，至少执行：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/identity
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
```

如果同步修改文档，还需要执行：

```bash
pnpm check:docs
```
