# Auth Server

状态：current
文档类型：reference
适用范围：`apps/backend/auth-server`
最后核对：2026-05-02

## 本主题主文档

本文只覆盖：`auth-server` 身份服务边界、PostgreSQL 表、启动环境和验证入口。

`auth-server` 负责统一登录、用户状态、全局角色、Session 与 Refresh Token 轮换。知识库成员权限、chat 项目权限和后端运行权限不写入 auth 服务，由各自业务服务独立治理。

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

## Runtime Boundary

当前横向 MVP 默认使用 `InMemoryAuthRepository`，用于本地开发和单元测试闭环。PostgreSQL 边界由 `PostgresAuthRepository` 收敛，接收项目自定义的 `PgClientLike`，避免让 `pg` 的第三方类型穿透到 auth 业务层。

后续切换真实持久化时，只替换 `AuthModule` 中的 repository provider，不改变 `AuthService`、controller 或前端 contract。

## Verification

受影响范围验证入口：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/auth-server/test/auth
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm check:docs
```
