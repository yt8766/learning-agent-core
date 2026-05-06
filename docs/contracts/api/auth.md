# Auth Service API

状态：current
文档类型：reference
适用范围：`apps/backend/auth-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`
最后核对：2026-05-02

统一登录服务采用账号密码登录和 JWT Access Token + Refresh Token 轮换机制。第一版直接由前端调用，不实现 OIDC。

## 1. Canonical Entry

`auth-server` 是 `agent-admin` 和 `apps/frontend/knowledge` 的 canonical 登录入口。

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/users
POST /api/auth/users
POST /api/auth/users/:userId/disable
POST /api/auth/users/:userId/enable
```

默认本地端口：

```text
http://127.0.0.1:3010/api
```

前端环境变量：

```text
VITE_AUTH_SERVICE_BASE_URL=http://127.0.0.1:3010/api
```

## 2. Permission Boundary

`auth-server` 只负责身份、用户状态、Session、Refresh Token 和全局角色。Knowledge base membership、chat 工具权限和 admin 中心细粒度权限不写入登录服务。

业务权限由各自服务独立治理：

- `knowledge-server`：知识库 owner / editor / viewer。
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

旧 `agent-server` admin auth 和 knowledge auth 路径只作为迁移期间兼容入口。新登录与用户管理功能默认接 `auth-server`，不要再把 knowledge 权限塞回登录服务。
