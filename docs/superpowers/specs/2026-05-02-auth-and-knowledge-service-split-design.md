# Auth 与 Knowledge 服务拆分设计

> 历史说明：本文记录 standalone `auth-server` / `knowledge-server` 方案形成时的设计背景。当前实现已 hard cut 到 unified `apps/backend/agent-server`；正确入口见 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`。

状态：snapshot
文档类型：plan
适用范围：`apps/backend/auth-server`、`apps/backend/knowledge-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`packages/core`、`packages/knowledge`
最后核对：2026-05-02

## 1. 背景

当前仓库已经存在 `agent-admin` 后台认证契约，也有 knowledge 生产化计划中的 auth/session 设计。继续让 `agent-admin`、`agent-chat`、`knowledge` 各自实现登录，会导致身份模型、token 刷新、用户状态、审计和前端登录体验逐步分叉。

本设计确认第一阶段不做完整 OIDC、授权码、跨域 SSO 或独立登录 UI，而是先拆出两个独立可启动的 NestJS 后端服务：

- `apps/backend/auth-server`：统一身份与用户管理服务。
- `apps/backend/knowledge-server`：知识库业务服务。

第一阶段目标是横向跑通：`agent-admin` 与 `knowledge` 前端都能直接调用 `auth-server` 登录；`agent-admin` 能管理用户；`knowledge` 前端能调用独立 `knowledge-server` 获取知识库数据；知识库权限由 `knowledge-server` 自治。

## 2. 目标

- 新增独立 NestJS `auth-server`，负责登录、刷新、退出、当前用户恢复和用户管理。
- 新增独立 NestJS `knowledge-server`，负责 knowledge 业务 API 与知识库权限判断。
- 使用 PostgreSQL 持久化身份、session、审计、知识库、成员关系、文档元数据和 ingestion 状态。
- `agent-admin` 登录与用户管理调用 `auth-server`。
- `apps/frontend/knowledge` 登录调用 `auth-server`，知识库业务调用 `knowledge-server`。
- 登录服务只管身份，不承载 knowledge、chat 或 admin 的细粒度业务权限。
- `knowledge-server` 消费 `auth-server` 签发的 JWT，但自行维护 `owner / editor / viewer` 等知识库权限。

## 3. 非目标

第一阶段不实现：

- OIDC discovery、授权码登录、PKCE、JWKS rotation 或 consent 页面。
- 第三方登录、注册、找回密码、验证码。
- `auth-server` 独立管理前端；用户管理入口由 `agent-admin` 承载。
- `agent-chat` 立刻接入统一登录。
- 完整 RAG、向量检索、文档解析和生产级 embedding pipeline。
- 把 knowledge 权限、chat 工具权限或 admin 中心权限塞进 `auth-server`。
- 一次性删除 `agent-server` 既有 admin auth 或 knowledge 过渡代码。

## 4. 服务边界

### 4.1 `apps/backend/auth-server`

`auth-server` 是统一身份宿主，使用 NestJS 实现，默认暴露 HTTP JSON API。

职责：

- 账号密码登录。
- JWT Access Token 签发。
- Refresh Token 轮换与撤销。
- 退出登录。
- 当前用户恢复。
- 用户列表、创建用户、启用/禁用用户、重置密码、修改基础资料和全局角色。
- 登录审计与风险事件记录。

不负责：

- 知识库成员权限。
- admin 六大中心的按钮级权限。
- chat 任务执行、审批、工具或 skill 使用权限。
- knowledge 文档、chunk、RAG 或 eval 业务。

### 4.2 `apps/backend/knowledge-server`

`knowledge-server` 是知识库业务宿主，使用 NestJS 实现，默认暴露 HTTP JSON API。

职责：

- 校验 `auth-server` 签发的 Access Token。
- 维护知识库、成员、文档元数据、chunk 和 ingestion job。
- 判断用户是否能查看、编辑或管理某个知识库。
- 为 knowledge 前端提供独立 API。

不负责：

- 账号密码登录。
- 用户创建、禁用或密码重置。
- admin 后台中心权限。
- runtime/chat 主链执行。

### 4.3 `apps/backend/agent-server`

`agent-server` 暂时继续负责 runtime、chat 主链、admin 既有治理业务和兼容入口。本轮设计不强制重构 `agent-server`。

后续迁移原则：

- 不再向 `agent-server` 增加新的 knowledge 登录或知识库主业务。
- 已迁移到 `auth-server` / `knowledge-server` 的旧入口应标注过渡状态。
- 确认前端不再调用旧入口后，再清理旧代码和旧文档。

## 5. Auth API

认证 API：

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

用户管理 API：

```text
GET   /api/auth/users
POST  /api/auth/users
GET   /api/auth/users/:userId
PATCH /api/auth/users/:userId
POST  /api/auth/users/:userId/reset-password
POST  /api/auth/users/:userId/disable
POST  /api/auth/users/:userId/enable
```

第一阶段用户管理入口由 `agent-admin` 提供。调用用户管理 API 时必须要求管理员级全局角色，例如 `super_admin` 或 `admin`。

登录响应建议保持稳定结构：

```json
{
  "account": {
    "id": "user_123",
    "username": "alice",
    "displayName": "Alice",
    "roles": ["admin"],
    "status": "enabled"
  },
  "session": {
    "id": "sess_123",
    "expiresAt": "2026-05-30T12:00:00.000Z"
  },
  "tokens": {
    "tokenType": "Bearer",
    "accessToken": "<jwt-access-token>",
    "accessTokenExpiresAt": "2026-05-02T12:15:00.000Z",
    "refreshToken": "<refresh-token>",
    "refreshTokenExpiresAt": "2026-05-30T12:00:00.000Z"
  }
}
```

JWT claims 保持克制：

```json
{
  "sub": "user_123",
  "username": "alice",
  "roles": ["admin"],
  "status": "enabled",
  "iss": "auth-server",
  "aud": ["agent-admin", "knowledge"],
  "exp": 1777724100
}
```

Access Token 用于业务请求。Refresh Token 只用于刷新接口，每次刷新都必须轮换。旧 Refresh Token 成功刷新后标记为 `used`；如果 `used` token 再次出现，撤销整个 session。

## 6. Auth 数据模型

第一阶段 PostgreSQL 表：

```text
auth_users
auth_password_credentials
auth_sessions
auth_refresh_tokens
auth_login_audit_events
```

`auth_users` 字段建议：

```text
id
username
display_name
status: enabled | disabled
global_roles: super_admin | admin | developer | knowledge_user
created_at
updated_at
last_login_at
```

`auth_password_credentials` 字段建议：

```text
user_id
password_hash
password_updated_at
must_change_password
```

`auth_sessions` 字段建议：

```text
id
user_id
status: active | revoked | expired
created_at
expires_at
revoked_at
revocation_reason
user_agent
ip_address
```

`auth_refresh_tokens` 字段建议：

```text
id
session_id
token_hash
status: active | used | revoked | expired
created_at
expires_at
used_at
replaced_by_token_id
```

`auth_login_audit_events` 字段建议：

```text
id
user_id
username
event_type
result
reason
ip_address
user_agent
created_at
```

## 7. Knowledge API

第一阶段 API 以横向 MVP 为主：

```text
GET   /api/knowledge/me
GET   /api/knowledge/bases
POST  /api/knowledge/bases
GET   /api/knowledge/bases/:baseId
GET   /api/knowledge/bases/:baseId/members
POST  /api/knowledge/bases/:baseId/members
PATCH /api/knowledge/bases/:baseId/members/:userId
```

后续可继续扩展：

```text
POST /api/knowledge/bases/:baseId/documents
GET  /api/knowledge/bases/:baseId/documents
GET  /api/knowledge/ingestion-jobs/:jobId
POST /api/knowledge/bases/:baseId/search
POST /api/knowledge/bases/:baseId/chat
```

`knowledge-server` 的鉴权流程：

1. 从 `Authorization: Bearer <accessToken>` 读取 token。
2. 校验 JWT 签名、`iss`、`aud`、过期时间和 `status`。
3. 将 `sub` 映射为当前用户 id。
4. 对知识库资源访问，查询 `knowledge_base_members`。
5. 按 knowledge 本域权限返回数据或拒绝访问。

## 8. Knowledge 数据模型

第一阶段 PostgreSQL 表：

```text
knowledge_bases
knowledge_base_members
knowledge_documents
knowledge_document_chunks
knowledge_ingestion_jobs
```

`knowledge_bases` 字段建议：

```text
id
name
description
created_by_user_id
created_at
updated_at
status
```

`knowledge_base_members` 字段建议：

```text
knowledge_base_id
user_id
role: owner | editor | viewer
created_at
updated_at
```

`knowledge_documents` 字段建议：

```text
id
knowledge_base_id
title
source_type
source_uri
status
created_by_user_id
created_at
updated_at
```

`knowledge_document_chunks` 和 `knowledge_ingestion_jobs` 第一阶段可以先作为结构预留与最小状态记录，不要求完成生产级解析、embedding 或 pgvector 查询。

## 9. 前端接入

### 9.1 `apps/frontend/agent-admin`

- 登录页调用 `auth-server` 的 `/api/auth/login`。
- 登录态继续由 admin 前端本地 auth store 管理，但 token 来源切到统一 auth。
- 新增用户管理入口，建议挂在 Connector & Policy Center 下，或新增 Identity / Users 子页。
- 用户管理页调用 `/api/auth/users*`。
- admin 第一阶段继续使用全局角色做后台访问判断。

### 9.2 `apps/frontend/knowledge`

- 登录页调用 `auth-server` 的 `/api/auth/login`。
- knowledge API client 调用独立 `knowledge-server`。
- 请求统一携带 `Authorization: Bearer <accessToken>`。
- 页面权限不直接从全局角色推导，应消费 `knowledge-server` 返回的 membership / permissions。

## 10. 错误语义

两个服务统一错误结构：

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "账号或密码错误",
    "requestId": "req_123"
  }
}
```

`auth-server` 错误码：

```text
invalid_request
invalid_credentials
account_disabled
access_token_missing
access_token_expired
access_token_invalid
refresh_token_missing
refresh_token_expired
refresh_token_invalid
refresh_token_reused
session_revoked
insufficient_role
internal_error
```

`knowledge-server` 错误码：

```text
auth_required
knowledge_base_not_found
knowledge_permission_denied
member_not_found
invalid_member_role
internal_error
```

HTTP 状态语义：

- `400`：请求结构错误。
- `401`：未认证或 token 无效。
- `403`：已认证但权限不足。
- `404`：资源不存在，或出于权限隐藏返回不存在。
- `500`：服务端错误。
- `503`：数据库或外部依赖不可用。

## 11. 迁移策略

第一阶段按四步推进：

1. 新增 `auth-server` 和 `knowledge-server`，提供独立启动脚本、env 示例、PostgreSQL repository、最小测试和 API 文档。
2. 将 `agent-admin` 登录切到 `auth-server`，新增用户管理入口。
3. 将 `apps/frontend/knowledge` 登录切到 `auth-server`，知识库业务切到 `knowledge-server`。
4. 确认前端不再调用旧接口后，清理或标注 `agent-server` 中旧 admin auth / knowledge auth / knowledge stub 的过渡状态。

迁移期间允许旧入口短期存在，但文档必须说明哪个入口是 canonical，避免后续继续往旧链路加能力。

## 12. 测试与验证

第一阶段验证范围：

- Contract：auth 和 knowledge DTO schema parse 测试。
- Auth unit：登录成功、禁用用户无法登录、refresh token 轮换、refresh token 重放撤销 session、用户管理权限校验。
- Knowledge unit：`owner / editor / viewer` membership 权限判断。
- Backend integration：使用 `auth-server` 登录后，用 token 调用 `knowledge-server /api/knowledge/bases`。
- Frontend：admin 登录页调用 auth client，admin 用户管理页能列出/创建/禁用用户，knowledge 登录后能拉取知识库列表。
- Docs-only 阶段至少执行 `pnpm check:docs`；进入实现阶段后按验证体系选择受影响服务的 Type、Spec、Unit、Demo 和 Integration 命令。

涉及 `packages/*` contract 时，优先补：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

新增后端 app 后应补充对应最低检查入口，例如：

```bash
pnpm exec tsc -p apps/backend/auth-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

## 13. 文档落点

实现阶段需要同步新增或更新：

- `docs/contracts/api/auth.md`
- `docs/contracts/api/knowledge.md`
- `docs/apps/backend/auth-server/auth-server.md`
- `docs/apps/backend/knowledge-server/knowledge-server.md`
- `docs/apps/frontend/agent-admin/admin-auth.md`
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
- `docs/integration/frontend-backend-integration.md`

如果 `agent-server` 保留过渡入口，对应文档必须标注 canonical 入口已经迁移到 `auth-server` 或 `knowledge-server`。

## 14. 设计结论

本设计采用“统一身份、分域权限、独立服务、直接登录”的第一阶段方案：

- `auth-server` 统一登录和用户管理。
- `knowledge-server` 独立承载知识库业务和知识库权限。
- 后端继续使用 NestJS。
- PostgreSQL 是第一版持久化基础设施。
- `agent-admin` 承载用户管理 UI。
- `agent-admin` 和 `knowledge` 前端直接调用 `auth-server` 登录。
- `knowledge` 前端直接调用 `knowledge-server` 获取知识库数据。
- 第一阶段不引入 OIDC，以降低横向 MVP 复杂度。
