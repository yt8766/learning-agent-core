# agent-server 后台认证实现说明

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`
对应接口规范：`docs/contracts/api/admin-auth.md`
最后核对：2026-04-30

## 1. 目标

`agent-server` 提供 `agent-admin` 后台认证能力，支持账号密码登录、JWT 双 Token、Refresh Token Rotation、退出登录、当前用户恢复和基础角色识别。

## 2. 模块边界

认证模块位于：

```text
apps/backend/agent-server/src/admin-auth/
```

职责：

- `controller`：HTTP 路由、入参出参。
- `service`：编排 login、refresh、logout、getMe 主流程。
- `guard`：校验 Access Token 并注入 AdminPrincipal。
- `providers`：JWT 签发校验、密码 hash/verify。
- `repositories`：账号、凭证、Session、Refresh Token 状态读写。
- `runtime`：认证策略和 fixture。
- `types`：后端内部类型。

## 3. 分层规则

禁止：

- controller 直接查库。
- controller 直接签 JWT。
- controller 直接校验密码。
- repository 解析 JWT。
- jwt provider 访问数据库。
- password hasher 读取账号状态。

要求：

- controller 保持薄。
- service 负责业务流程编排。
- provider 负责技术能力。
- repository 负责状态持久化。
- 错误码和中文文案集中在 `admin-auth.errors.ts`。

## 4. 登录流程

`AdminAuthService.login()`：

1. 校验 username/password/remember 请求格式。
2. 根据 username 查找账号。
3. 账号不存在时返回 `invalid_credentials`。
4. 账号停用时返回 `account_disabled`。
5. 查找密码凭证。
6. 如果账号处于锁定期，返回 `account_locked`。
7. 校验密码。
8. 密码错误时增加失败次数，必要时锁定账号。
9. 密码正确时清空失败次数。
10. 创建 Session。
11. 签发 Access Token。
12. 签发 Refresh Token。
13. 保存 Refresh Token Hash。
14. 记录登录审计。
15. 返回 account、session、token pair。

## 5. 刷新流程

`AdminAuthService.refresh()`：

1. 校验 refreshToken 存在。
2. 校验 JWT 签名和 `tokenType = refresh`。
3. 校验 Refresh Token 未过期。
4. 查找 Session。
5. Session 不存在或非 active 时返回 `session_revoked`。
6. 查找账号。
7. 账号停用时撤销 Session。
8. 计算 refreshToken hash。
9. 查找 Refresh Token Record。
10. Record 不存在时返回 `refresh_token_invalid`。
11. Record 为 `used` 时判定重放，撤销整个 Session。
12. Record 为 `revoked` 或 `expired` 时返回对应错误。
13. Record 为 `active` 时生成新 Token Pair。
14. 新建 Refresh Token Record。
15. 旧 Record 标记为 `used`。
16. 更新 Session lastSeenAt。
17. 返回新 Token Pair。

## 6. 退出与当前用户

`logout` 必须幂等。Session 已过期、已撤销或 refreshToken 找不到时，也应返回 `{ success: true }`，方便前端清理状态。

`getMe` 由 guard 注入 AdminPrincipal 后执行二次校验：

- 账号不存在：`access_token_invalid`
- 账号停用：`account_disabled`
- Session 非 active：`session_revoked`

## 7. MVP 过渡说明

第一版允许：

- Memory Repository。
- Refresh Token 通过请求体传递。
- 开发环境通过 Identity seed 选项显式创建初始管理员账号。

当前代码不内置默认账号或默认密码。需要本地种子管理员时，在启动 `agent-server` 前配置：

```text
IDENTITY_ADMIN_USERNAME=<username>
IDENTITY_ADMIN_PASSWORD=<password>
IDENTITY_ADMIN_DISPLAY_NAME=<display-name>
```

`AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD` / `AUTH_ADMIN_DISPLAY_NAME` 仍作为迁移期别名读取；新增配置优先使用 `IDENTITY_*`。

后续增强：

- 数据库 Repository。
- 保持前端双 Token 语义，后端只保存 Refresh Token Hash，不把 Token 明文落库。
- 审计事件持久化和查询。
- 多会话管理。
- 强制下线。
