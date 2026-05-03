# Auth Server

状态：current
文档类型：reference
适用范围：`apps/backend/auth-server`
最后核对：2026-05-02

## 本主题主文档

本文只覆盖：`auth-server` 身份服务边界、PostgreSQL 表、启动环境和验证入口。

`auth-server` 负责统一登录、用户状态、全局角色、Session 与 Refresh Token 轮换。知识库成员权限、chat 项目权限和后端运行权限不写入 auth 服务，由各自业务服务独立治理。

## Runtime Config

`auth-server` 通过 `@nestjs/config` 加载服务目录下的 `.env`。启动时优先读取当前工作目录 `.env`，也兼容从仓库根启动时读取 `apps/backend/auth-server/.env`。

当前生效 key：

- `PORT` / `HOST`：HTTP 监听地址。
- `API_PREFIX`：全局 API 前缀，默认 `api`。
- `DATABASE_URL`：存在时使用 `PostgresAuthRepository`，缺失时使用 `InMemoryAuthRepository`。
- `AUTH_SERVER_JWT_SECRET`：JWT HS256 签名密钥。
- `AUTH_SERVER_JWT_ISSUER`：JWT issuer，默认 `auth-server`。
- `AUTH_SEED_ADMIN_USERNAME`：启动时自动补齐的开发管理员用户名，默认 `admin`。
- `AUTH_SEED_ADMIN_PASSWORD`：开发管理员初始密码；为空时跳过自动 seed。
- `AUTH_SEED_ADMIN_DISPLAY_NAME`：开发管理员展示名，默认 `Admin`。
- `AUTH_SERVER_CORS_ORIGIN` 或 `CORS_ORIGINS`：逗号分隔的 CORS origin。

开发环境会在显式 CORS 配置之外自动允许本地前端 origin：`5173`、`5174`、`5175` 的 `localhost` 与 `127.0.0.1`。生产环境只使用显式配置，不自动加入本地开发 origin。

当前登录链路使用 `passport-local` 校验用户名密码，Bearer token 使用 `passport-jwt` 校验，密码哈希使用 `bcrypt`。`bcrypt` 必须通过 `import { hash, compare } from 'bcrypt'` 命名导入，避免 CommonJS 启动链路访问不存在的 default export。

## PostgreSQL Tables

```sql
create table if not exists auth_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  global_roles text[] not null,
  status text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references auth_users(id),
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text
);

create table if not exists auth_refresh_tokens (
  id text primary key,
  session_id text not null references auth_sessions(id),
  token_hash text not null unique,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  replaced_by_token_id text
);
```

## Runtime Repository Selection

当前横向 MVP 支持按环境选择 repository：

- 未配置 `DATABASE_URL` 时，`AuthModule` 使用 `InMemoryAuthRepository`，用于本地开发和单元测试闭环。
- 配置 `DATABASE_URL` 时，`AuthModule` 使用 `PostgresAuthRepository`。
- `DATABASE_URL` 指向的 PostgreSQL database 必须已经存在；服务启动期只负责在该 database 内执行 auth schema 初始化，不负责 `CREATE DATABASE`。本地 Docker 默认只创建根级 `docker-compose.yml` 里的 `${DB_NAME:-agent_db}`，如果 `apps/backend/auth-server/.env` 指向 `agent_auth`，需要先在本地 Postgres 中创建该 database。
- `AUTH_SERVER_JWT_SECRET` 必须与 `knowledge-server` 的 verifier secret 一致，否则 knowledge API 会拒绝 auth-server token。
- 配置 `AUTH_SEED_ADMIN_PASSWORD` 后，`AuthSeedService` 会在服务启动时检查 `AUTH_SEED_ADMIN_USERNAME` 是否存在；不存在才创建 `admin` 角色账号，已存在时不会覆盖密码、展示名或状态。

PostgreSQL 边界由 `PostgresAuthRepository` 收敛，接收项目自定义的 `PostgresAuthClient`，避免让 `pg` 的第三方类型穿透到 auth 业务层。`createAuthRepositoryProvider()` 在暴露 `PostgresAuthRepository` 前会先执行 `src/auth/runtime/auth-schema.sql.ts` 中的 `AUTH_SCHEMA_SQL`，确保 `auth_users`、`auth_sessions` 与 `auth_refresh_tokens` 表存在。`pg.Pool` 只在 `src/auth/runtime/auth-database.provider.ts` 中创建，并通过 `import { Pool } from 'pg'` 命名导入；不要改回默认导入，否则 CommonJS 启动链路会在运行时得到 `undefined.Pool`。

## Build Boundary

`tsconfig.json` 在开发与测试阶段会把 `@agent/core` 映射到 `packages/core/src/index.ts`，便于类型检查直接消费源码。`tsconfig.build.json` 必须清空 `paths`，让生产构建按 workspace 包边界解析 `@agent/core`，否则 `tsc -p tsconfig.build.json` 会把 `packages/core/src` 拉进当前服务编译图，并触发 `TS6059: file is not under rootDir`。

该模式与 `apps/backend/agent-server` 保持一致；后续新增 backend Nest 服务如果同时设置 `rootDir: "./src"` 和源码期 workspace path mapping，也应在 build tsconfig 中显式覆盖 `baseUrl` 与 `paths`。

## HTTP Behavior

- `POST /api/auth/login` 签发 Access Token、Refresh Token 和 Session。
- `POST /api/auth/refresh` 执行 Refresh Token Rotation，并在旧 token 重放时撤销 session。
- `POST /api/auth/logout` 根据 refresh token 撤销对应 session；未知 token 保持幂等成功。
- `GET /api/auth/me` 通过 Access Token 中的 session id 校验当前 session 和账号状态后返回当前用户。
- `GET/POST /api/auth/users/*` 需要 `admin` 或 `super_admin` 角色。

## Verification

受影响范围验证入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm --dir apps/backend/auth-server build
pnpm check:docs
```
