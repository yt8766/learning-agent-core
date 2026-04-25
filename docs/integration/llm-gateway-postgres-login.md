# LLM Gateway 登录 PostgreSQL 部署

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`、本地 Docker PostgreSQL、部署环境变量
最后核对：2026-04-25

## 1. 目标

`apps/llm-gateway` 登录第一版使用 PostgreSQL 作为管理员身份数据的持久化存储，并通过后台 auth route 签发本地浏览器保存的长短 JWT。登录域不使用服务端 session cookie，也不为登录态创建 session 表。

本地 PostgreSQL 固定使用 `postgres:16`，数据库名和用户名建议统一为 `llm_gateway`。

## 2. 本地 PostgreSQL

`apps/llm-gateway/docker-compose.yml` 提供 `llm-gateway-postgres` 服务。该 compose 文件属于 llm-gateway 应用，不作为仓库全局基础设施入口使用：

```bash
pnpm --dir apps/llm-gateway docker:up
```

本地数据目录默认绑定到应用目录内的运行时目录：

```text
apps/llm-gateway/.db/postgres:/var/lib/postgresql/data
```

`.db` 是本地数据目录，已由根级 `.gitignore` 忽略；不要提交其中任何数据库文件。

容器化 E2E 使用独立的 `apps/llm-gateway/docker-compose.e2e.yml`，不复用本地开发数据库、固定容器名或 `.db/postgres` 数据目录；E2E 细节见 `docs/integration/llm-gateway-e2e.md`。

默认连接串：

```text
DATABASE_URL=postgresql://llm_gateway:llm_gateway_password@localhost:5432/llm_gateway
```

## 3. 环境变量

`apps/llm-gateway/.env.example` 是本地和部署环境的变量清单。至少需要配置：

- `POSTGRES_DB=llm_gateway`
- `POSTGRES_USER=llm_gateway`
- `POSTGRES_PASSWORD=llm_gateway_password`
- `POSTGRES_PORT=5432`
- `POSTGRES_DATA_DIR=./.db/postgres`
- `DATABASE_URL=postgresql://llm_gateway:llm_gateway_password@localhost:5432/llm_gateway`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `MINIMAX_API_KEY`
- `MIMO_API_KEY`
- `LLM_GATEWAY_BOOTSTRAP_API_KEY`
- `LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD`
- `LLM_GATEWAY_ADMIN_JWT_SECRET`

`POSTGRES_*` 只用于本地 Docker PostgreSQL；`DATABASE_URL` 是 llm-gateway 应用运行时读取的连接串。本地开发时二者必须保持一致。部署到 Vercel 或其他环境时，`DATABASE_URL` 应替换为托管 PostgreSQL 的连接串；`REDIS_URL` 应指向对应环境的 Redis。所有生产 secret 必须使用生产随机值，不复用 `.env.example` 占位值。

`LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD` 与 `LLM_GATEWAY_ADMIN_JWT_SECRET` 必须在启动应用前替换为真实值。以 `replace-with-` 开头的示例值会被视为未配置，不会创建管理员，也不能作为登录密码。管理员密码只在没有 owner 主体时 bootstrap 一次；如果本地 PostgreSQL 已经保存过 owner，后续修改 bootstrap 环境变量不会覆盖既有密码。开发环境需要重设初始密码时，可以先用当前密码登录后调用改密接口，或停止服务后删除本地 `apps/llm-gateway/.db/postgres` 数据目录重新初始化。

## 4. 登录持久化边界

登录第一版不使用 session cookie，不创建 `admin_sessions` 表。服务端认证状态应通过管理员 JWT 语义表达，数据库只保存管理员主体、凭据、登录尝试和审计事件。

PostgreSQL 负责持久化以下管理员登录相关表：

- `admin_principals`
- `admin_credentials`
- `admin_login_attempts`
- `admin_audit_events`

后台登录接口为：

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/change-password`
- `POST /api/admin/auth/logout`

前端将 `AdminTokenPair` 保存到 `localStorage`。后台管理 API 使用 `Authorization: Bearer <accessToken>`；当 access token 过期时，后端返回 `403 + admin_access_token_expired`，前端调用 refresh 接口，保存新的 token pair 后重放原请求一次。

不要在业务层新增 session-cookie 存储路径，也不要为了登录态创建 `admin_sessions` 表。后续如需要令牌吊销、设备管理或会话观察，应先补稳定契约和迁移文档，再引入新的表结构。

## 5. 本地启动顺序

1. 确认 `.db/` 已被 `.gitignore` 忽略。
2. 复制 `apps/llm-gateway/.env.example` 中的变量到本地环境，并替换 secret。
3. 启动 PostgreSQL：`pnpm --dir apps/llm-gateway docker:up`。
4. 启动应用：`pnpm --dir apps/llm-gateway dev`。

## 6. 验证入口

配置和文档检查由 `apps/llm-gateway/test/env-docs.test.ts` 覆盖。修改 Docker、env example 或本文档后，至少执行：

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
pnpm check:docs
```
