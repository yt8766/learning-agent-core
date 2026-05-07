# agent-admin 后台认证接口规范

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`、`apps/backend/agent-server`、`packages/core`
认证方式：JWT Access Token + Refresh Token
最后核对：2026-04-30

> Canonical backend host: `apps/backend/agent-server`. Legacy route aliases are migration compatibility only.

agent-admin 后台认证采用账号密码登录和 JWT 双 Token 机制：Access Token 用于短期业务鉴权，Refresh Token 用于会话刷新；前端在 Access Token 过期时自动刷新并重放原请求，刷新失败后返回登录页。

状态码语义必须保持清晰：`401` 表示认证错误，`403` 表示权限不足，`404` 表示资源或页面不存在，`500` / `503` 表示服务端错误或服务不可用。前端 `/401` 是显式错误展示页，不代表正常未登录入口；未登录进入受保护后台入口时应导向 `/login`。

## 1. 目标

为 `agent-admin` 提供独立后台认证能力，支持账号密码登录、JWT 双 Token 会话、Access Token 自动刷新、退出登录、当前用户恢复和基础角色识别。

## 2. 非目标

第一版不支持：

- 邮箱登录
- GitHub / Facebook 登录
- 注册入口
- 找回密码
- 验证码
- 账号管理页面
- 按钮级权限矩阵
- 审计日志查询页

## 3. 角色

第一版只支持两个角色：

| 角色值        | 中文名     | 说明                                          |
| ------------- | ---------- | --------------------------------------------- |
| `super_admin` | 超级管理员 | 可访问全部后台中心                            |
| `developer`   | 开发者     | 可访问 Runtime、Learning、Skill Lab、Evidence |

## 4. Token 机制

系统采用 JWT 双 Token：

- `Access Token`：短期有效，用于普通业务请求。
- `Refresh Token`：长期有效，只用于刷新接口。

默认生命周期：

| Token                         | 生命周期 |
| ----------------------------- | -------- |
| Access Token                  | 15 分钟  |
| Refresh Token，未勾选记住登录 | 1 天     |
| Refresh Token，勾选记住登录   | 30 天    |

Refresh Token 必须每次刷新都轮换。旧 Refresh Token 刷新成功后标记为 `used`。如果 `used` Token 再次出现，视为疑似泄露，撤销整个 Session。

## 5. 接口总览

| 方法 | 路径                      | 说明       |
| ---- | ------------------------- | ---------- |
| POST | `/api/admin/auth/login`   | 登录       |
| POST | `/api/admin/auth/refresh` | 刷新 Token |
| POST | `/api/admin/auth/logout`  | 退出登录   |
| GET  | `/api/admin/auth/me`      | 当前用户   |

## 6. 登录接口

`POST /api/admin/auth/login`

请求：

```json
{
  "username": "admin",
  "password": "******",
  "remember": true
}
```

成功响应：

```json
{
  "account": {
    "id": "admin_001",
    "username": "admin",
    "displayName": "平台管理员",
    "roles": ["super_admin"],
    "status": "enabled"
  },
  "session": {
    "id": "sess_001",
    "expiresAt": "2026-05-30T12:00:00.000Z"
  },
  "tokens": {
    "tokenType": "Bearer",
    "accessToken": "<jwt-access-token>",
    "accessTokenExpiresAt": "2026-04-30T12:15:00.000Z",
    "refreshToken": "<jwt-refresh-token>",
    "refreshTokenExpiresAt": "2026-05-30T12:00:00.000Z"
  }
}
```

规则：

- `username` 表示账号，不是邮箱。
- 账号不存在和密码错误统一返回 `invalid_credentials`。
- 登录成功后创建 Session，并返回 Token Pair。

## 7. 刷新接口

`POST /api/admin/auth/refresh`

请求：

```json
{
  "refreshToken": "<jwt-refresh-token>"
}
```

成功响应：

```json
{
  "tokens": {
    "tokenType": "Bearer",
    "accessToken": "<new-jwt-access-token>",
    "accessTokenExpiresAt": "2026-04-30T12:30:00.000Z",
    "refreshToken": "<new-jwt-refresh-token>",
    "refreshTokenExpiresAt": "2026-05-30T12:15:00.000Z"
  }
}
```

规则：

- 必须校验 Refresh Token 签名、过期时间、`tokenType` 和 Session 状态。
- 每次刷新返回新的 Access Token 和 Refresh Token。
- 数据库或存储层只保存 Refresh Token Hash，不保存明文 Token。
- 旧 Refresh Token 标记为 `used`。
- `used` Token 重放时撤销整个 Session。

## 8. 退出接口

`POST /api/admin/auth/logout`

请求：

```json
{
  "refreshToken": "<jwt-refresh-token>"
}
```

成功响应：

```json
{
  "success": true
}
```

规则：

- 退出接口幂等。
- 即使 Session 已失效，也允许前端清理本地登录态。
- 服务端应撤销当前 Session 和关联 Refresh Token。

## 9. 当前用户接口

`GET /api/admin/auth/me`

请求头：

```http
Authorization: Bearer <accessToken>
```

成功响应：

```json
{
  "account": {
    "id": "admin_001",
    "username": "admin",
    "displayName": "平台管理员",
    "roles": ["super_admin"],
    "status": "enabled"
  }
}
```

## 10. 错误结构

统一错误响应：

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "账号或密码错误",
    "requestId": "req_001"
  }
}
```

错误码：

```text
invalid_request
invalid_credentials
account_disabled
account_locked
access_token_missing
access_token_expired
access_token_invalid
refresh_token_missing
refresh_token_expired
refresh_token_invalid
session_revoked
insufficient_role
internal_error
```

## 11. 前端自动刷新规则

业务请求统一携带：

```http
Authorization: Bearer <accessToken>
```

当接口返回 `401` 且错误码为 `access_token_expired` 时：

1. 前端调用 `/api/admin/auth/refresh`。
2. 刷新成功后更新 Token Pair。
3. 自动重放原请求。
4. 刷新失败后清空登录态并跳转 `/login`。

并发要求：

- 多个请求同时遇到 `access_token_expired` 时，只允许发起一次 refresh。
- 其他请求等待同一个 refresh promise。
- 原请求最多自动重放一次。
- refresh 接口自身失败时不得递归刷新。

## 12. 中文 UI 约束

登录页必须使用：

```text
登录管理后台
请输入账号和密码进入平台控制台
账号
请输入账号
密码
请输入密码
记住登录
登录
登录中...
退出登录
超级管理员
开发者
```

登录页禁止出现：

```text
Email
Sign in
Sign up
GitHub
Facebook
Or continue with
```

## 13. 第一版验收标准

- 未登录访问后台跳转登录页。
- 使用账号密码可登录。
- 登录成功进入 Dashboard 或 redirect 目标页。
- 业务请求携带 Access Token。
- Access Token 过期后自动刷新。
- Refresh 成功后原请求恢复。
- Refresh 失败后回登录页。
- 退出登录后无法继续访问后台。
- `/me` 可恢复当前用户。
- 支持 `super_admin` 和 `developer` 两个角色。
- 页面和错误提示全部中文。
