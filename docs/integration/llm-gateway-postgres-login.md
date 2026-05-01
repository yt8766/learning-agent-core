# LLM Gateway 登录 PostgreSQL 部署

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`、本地 Docker PostgreSQL、部署环境变量
最后核对：2026-04-30

## 1. 目标

`apps/llm-gateway` 登录第一版使用 PostgreSQL 作为管理员身份数据的持久化存储，并通过后台 auth route 签发本地浏览器保存的长短 JWT。登录域不使用服务端 session cookie，也不为登录态创建 session 表。

本地 PostgreSQL 固定使用仓库根级 `docker-compose.yml` 的 `postgres:16-alpine` 镜像。该 compose 只启动数据库，不容器化 `llm-gateway` 应用。

## 2. 本地 PostgreSQL

仓库根目录的 `docker-compose.yml` 提供全局 `postgres` 服务。`apps/llm-gateway` 不再维护自己的本地开发 compose 文件；应用仍通过 `pnpm --dir apps/llm-gateway dev` 在宿主机运行。

```bash
docker compose up -d postgres
```

本地数据目录统一绑定到仓库根目录的 `db/` 目录：

```text
./db/postgres:/var/lib/postgresql/data
```

`db/` 是本地数据目录，已由根级 `.gitignore` 忽略；不要提交其中任何数据库文件。旧的 `apps/llm-gateway/.db/postgres` 只属于迁移前的本地数据位置，不再作为当前入口。

默认连接串：

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_db
```

## 3. 环境变量

根级 `.env.example` 维护本地 PostgreSQL 容器使用的 `DB_*` 变量；`apps/llm-gateway/.env.example` 只维护应用运行时变量。至少需要配置：

- 根级 `DB_HOST=localhost`
- 根级 `DB_PORT=5432`
- 根级 `DB_USER=postgres`
- 根级 `DB_PASS=postgres`
- 根级 `DB_NAME=agent_db`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_db`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `MINIMAX_API_KEY`
- `MIMO_API_KEY`
- `LLM_GATEWAY_BOOTSTRAP_API_KEY`
- `LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD`
- `LLM_GATEWAY_ADMIN_JWT_SECRET`
- `LLM_GATEWAY_KEY_HASH_SECRET`
- `LLM_GATEWAY_PROVIDER_SECRET_KEY`
- `LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION`

根级 `DB_*` 只用于本地 Docker PostgreSQL；`DATABASE_URL` 是 llm-gateway 应用运行时读取的连接串。本地开发时二者必须保持一致。部署到 Vercel 或其他环境时，`DATABASE_URL` 应替换为托管 PostgreSQL 的连接串；`REDIS_URL` 应指向对应环境的 Redis。所有生产 secret 必须使用生产随机值，不复用 `.env.example` 占位值。

Vercel 生产部署优先配置 `UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN`。当前 bootstrap runtime 在 `NODE_ENV=production` 且没有 Upstash Redis 配置时会 fail closed，不会静默回落到 memory limiter；`REDIS_URL` 暂作为本地或后续非 Upstash runtime 的配置入口。

`OPENAI_API_KEY`、`MINIMAX_API_KEY`、`MIMO_API_KEY` 是 provider credential 后台完成前的 bootstrap seed 来源。真实 provider credential 入库后必须使用 `LLM_GATEWAY_PROVIDER_SECRET_KEY` 加密保存，不能明文持久化。

本地 `.env.example` 只提供初始管理员密码占位符，默认账号为 `admin`。`LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD` 与 `LLM_GATEWAY_ADMIN_JWT_SECRET` 都必须在启动应用前替换为本地私有值；以 `replace-with-` 开头的 secret 会被视为未配置。PostgreSQL 容器启动本身只创建数据库，不直接插入管理员行；第一次启动应用并用 `admin / <configured-password>` 登录时，后端会在没有 owner 主体的情况下自动创建管理员 principal 与 password credential。管理员密码只在没有 owner 主体时 bootstrap 一次；如果本地 PostgreSQL 已经保存过 owner，后续修改 bootstrap 环境变量不会覆盖既有密码。开发环境需要重设初始密码时，可以先用当前密码登录后调用改密接口，或停止服务后删除本地 `db/postgres` 数据目录重新初始化。

后台登录表单提交 `username + password`。当前登录仍保持单 owner 数据模型，不新增 PostgreSQL 用户名列；服务端用 owner `displayName` 作为用户名匹配值，bootstrap 默认用户名为 `admin`。旧的 `{ account, password }` 或 `{ password }` 登录 payload 会在 contract parse 阶段归一为 `username`，用于兼容已有脚本；前端必须始终展示并提交用户名字段。

如果登录返回 `admin_auth_bad_request`，优先检查本地 PostgreSQL 是否启动：`docker compose up -d postgres`。当 `DATABASE_URL` 指向本地 PostgreSQL 而容器未运行时，底层连接错误会进入 auth route 的兜底错误响应。容器启动并健康后，`admin / <configured-password>` 应返回 token pair；密码与 `LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD` 不一致会返回 `admin_login_invalid_password`。

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

前端将 `AdminTokenPair` 保存到 `localStorage`。后台管理 API 使用 `Authorization: Bearer <accessToken>`；前端会在 access token 距离过期不足 60 秒时主动调用 refresh，并在后端返回 `403 + admin_access_token_expired` 时被动 refresh。refresh 成功后保存新的 token pair，并且每个原请求最多重放一次；并发过期请求共享同一个 refresh promise。

不要在业务层新增 session-cookie 存储路径，也不要为了登录态创建 `admin_sessions` 表。后续如需要令牌吊销、设备管理或会话观察，应先补稳定契约和迁移文档，再引入新的表结构。

## 5. 本地启动顺序

1. 确认根目录 `db/` 已被 `.gitignore` 忽略。
2. 复制 `apps/llm-gateway/.env.example` 中的变量到本地环境，并替换 `LLM_GATEWAY_ADMIN_JWT_SECRET` 等 secret。
3. 从仓库根目录启动 PostgreSQL：`docker compose up -d postgres`。
4. 启动应用：`pnpm --dir apps/llm-gateway dev`。该脚本固定使用 `http://localhost:3100`。
5. 打开后台登录页 `http://localhost:3100/admin`，用 `admin / <configured-password>` 首次登录；后端会把该管理员持久化到 PostgreSQL。

## 6. 验证入口

配置和文档检查由 `apps/llm-gateway/test/env-docs.test.ts` 覆盖。修改 Docker、env example 或本文档后，至少执行：

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/env-docs.test.ts
pnpm check:docs
```
