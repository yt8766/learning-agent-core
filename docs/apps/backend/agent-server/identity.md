# agent-server Identity 域

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/domains/identity`
最后核对：2026-05-07

`agent-server` 已承接统一后端目标下的 Identity 域主入口。新增或迁移身份逻辑时，优先落在 `src/domains/identity`，HTTP 入口只保留在 `src/api/identity`，不要重新引入独立 auth backend 或让应用层直连历史 auth package。

## 1. 路由入口

当前同时提供 canonical identity 路由和迁移期 legacy auth alias：

```text
POST /api/identity/login
POST /api/identity/refresh
POST /api/identity/logout
GET  /api/identity/me

POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

`/api/identity/*` 是统一后端目标入口；`/api/auth/*` 只作为历史客户端迁移期兼容层。新增前端或后端调用默认接 `/api/identity/*`。

## 2. 模块职责

- `src/api/identity/*`：Nest controller 与路由 alias，只负责 HTTP 参数、状态码和调用 identity service。
- `src/domains/identity/schemas/*`：复用 `@agent/core` 的 auth request schema，保持请求 contract 与公共契约一致。
- `src/domains/identity/services/*`：登录、JWT 签发、密码校验、refresh token 轮换、session revoke、种子用户与用户管理。
- `src/domains/identity/repositories/*`：Identity 持久化端口和实现。当前默认实现是内存 repository；Postgres repository 已作为迁移候选实现保留，但还不是默认 provider。

## 3. Token 与 Session 语义

`IdentityAuthService` 负责完整登录链路：

- 登录成功后签发 HMAC JWT access token 与 refresh token。
- refresh token 采用轮换机制；旧 refresh token 被再次使用时，会撤销对应 session 并返回 `refresh_token_reused`。
- logout 会撤销当前 session。
- `/api/identity/me` 支持从 Bearer token 或已解析 principal 查询当前用户。

JWT 由 `IdentityJwtProvider` 封装，业务层不要直接拼第三方 JWT payload。Refresh token、session 与用户状态由 repository 端口承载，后续切换 Postgres 时必须通过该端口完成。

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
