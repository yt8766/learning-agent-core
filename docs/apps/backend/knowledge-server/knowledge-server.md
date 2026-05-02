# Knowledge Server

状态：current
文档类型：reference
适用范围：`apps/backend/knowledge-server`
最后核对：2026-05-02

## 本主题主文档

本文只覆盖：`knowledge-server` 服务边界、知识库成员权限和 `auth-server` token 消费方式。

`knowledge-server` 是 knowledge 前端的 canonical 业务 API 宿主。它不处理账号密码登录，只校验 `auth-server` 签发的 Access Token，并通过 `knowledge_base_members` 判断 `owner | editor | viewer` 权限。

## Canonical Entry

默认本地端口：

```text
http://127.0.0.1:3020/api
```

第一阶段 API：

```text
GET  /api/knowledge/bases
POST /api/knowledge/bases
GET  /api/knowledge/bases/:baseId/members
POST /api/knowledge/bases/:baseId/members
```

前端环境变量：

```text
VITE_KNOWLEDGE_SERVICE_BASE_URL=http://127.0.0.1:3020/api
```

## Permission Model

Auth token 只投影用户身份：

```text
userId
username
roles
```

知识库权限只看 membership：

- `owner`：可查看成员、添加成员。
- `editor`：后续用于文档维护和内容编辑。
- `viewer`：只读访问知识库。

全局 auth 角色不等于知识库成员角色。即使用户有 `admin` 或 `knowledge_user` 全局角色，也必须通过 `knowledge_base_members` 获得具体知识库权限。

## PostgreSQL Tables

```sql
create table if not exists knowledge_bases (
  id text primary key,
  name text not null,
  description text not null default '',
  created_by_user_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_base_members (
  knowledge_base_id text not null references knowledge_bases(id),
  user_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (knowledge_base_id, user_id)
);
```

## Verification

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```
