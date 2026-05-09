# Auth Service API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/domains/identity`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`
最后核对：2026-05-09

统一登录服务采用账号密码登录和 JWT Access Token + Refresh Token 轮换机制。第一版直接由前端调用，不实现 OIDC。

当前 canonical 身份入口：`apps/backend/agent-server` 的 `/api/identity/*`。standalone `apps/backend/auth-server` 已删除；不要新增 `/api/auth/*` 调用方。

## 1. Canonical Entry

Canonical 登录入口：

```text
POST /api/identity/login
POST /api/identity/refresh
POST /api/identity/logout
GET  /api/identity/me
```

用户管理入口：

```text
GET   /api/identity/users
POST  /api/identity/users
PATCH /api/identity/users/:userId/disable
PATCH /api/identity/users/:userId/enable
```

默认本地端口：

```text
http://127.0.0.1:3000/api
```

前端环境变量：

```text
VITE_AUTH_SERVICE_BASE_URL=http://127.0.0.1:3000/api
```

## 2. Permission Boundary

Identity domain 只负责身份、用户状态、Session、Refresh Token 和全局角色。Knowledge base membership、chat 工具权限和 admin 中心细粒度权限不写入登录服务。

业务权限由各自服务独立治理：

- `agent-server` Knowledge domain：知识库 owner / editor / viewer。
- `agent-server`：runtime、审批、工具、chat 与后端治理权限。
- `agent-admin`：展示入口和管理页权限矩阵。

## 3. Token Response

Token 响应使用 `packages/core/src/contracts/auth-service` 的 schema：

```ts
{
  account: {
    id: string;
    username: string;
    displayName: string;
    roles: Array<'super_admin' | 'admin' | 'developer' | 'knowledge_user'>;
    status: 'enabled' | 'disabled';
  }
  session: {
    id: string;
    expiresAt: string;
  }
  tokens: {
    tokenType: 'Bearer';
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  }
}
```

## 4. Compatibility

旧 standalone `auth-server`、`/api/auth/*` 和 knowledge auth 路径已 hard cut 删除。新登录与用户管理功能只能接 `/api/identity/*`，不要再把 knowledge 权限塞回登录服务。
