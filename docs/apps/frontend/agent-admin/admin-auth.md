# agent-admin 前端认证实现说明

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`
对应接口规范：`docs/contracts/api/auth.md`
最后核对：2026-05-02

## 1. 目标

`agent-admin` 前端认证层负责中文登录页、登录态保存、业务请求鉴权、Access Token 自动刷新、路由守卫、基础角色入口控制和 auth-server 用户管理入口。

当前 canonical 登录入口是 `apps/backend/auth-server`：

```text
VITE_AUTH_SERVICE_BASE_URL=http://127.0.0.1:3010/api
```

## 2. 模块边界

认证模块位于：

```text
apps/frontend/agent-admin/src/pages/auth/
```

当前职责：

- `api/`：封装 login、refresh、logout、me 请求。
- `runtime/`：封装 token manager、refresh coordinator、auth request runtime。
- `store/`：通过 Zustand 保存当前 account、token pair 和认证状态。
- `pages/`：中文登录页。
- `components/`：账号密码登录表单。
- `features/identity/`：封装 auth-server 用户列表和用户管理页面。

## 3. 登录态模型

前端登录态只保存展示和请求所需信息。勾选“记住登录”后，前端会把当前账号摘要和双 Token 写入浏览器本地存储：

```text
localStorage["agent-admin:auth"]
```

存储内容：

```text
account
accessToken
refreshToken
accessTokenExpiresAt
refreshTokenExpiresAt
```

禁止保存：

- 明文密码
- passwordHash
- failedCount
- lockedUntil
- 后端 Refresh Token Record

运行时入口：

- `useAdminAuthStore` 是 Zustand store，供 React 组件按 selector 订阅认证状态。
- `adminAuthStore` 是兼容 facade，保留 `getSnapshot / subscribe / setAuthenticated / setTokenPair / clear` 等方法，供 API runtime、token manager 和旧调用点使用。
- `useAdminAuthSnapshot` 用 `useSyncExternalStore` 包装 Zustand store，确保服务端渲染测试和 React Router guard 都能读取当前快照。

## 4. 请求自动刷新

`admin-api-core` 不使用 Cookie 鉴权，也不启用 `withCredentials`。普通业务请求会自动附加：

```http
Authorization: Bearer <accessToken>
```

当后端返回 `401 + access_token_expired` 时：

1. 前端调用 `auth-server /api/auth/refresh`，并通过 JSON 请求体传递当前 Refresh Token。
2. 刷新成功后更新 token pair。
3. 如果当前登录态开启了本地持久化，同步更新 `localStorage["agent-admin:auth"]`。
4. 自动重放原请求。
5. 刷新失败后清空登录态。

第一版要求原请求最多重放一次，且 refresh 接口自身不递归刷新。

非过期类 `401`、`403`、`500`、`503` 必须保留原始状态语义，不在请求层统一改写成登录页。`/401` 是显式认证错误展示页；未登录访问受保护入口时走 `/login`，不把正常登录入口渲染成 401 错误页。`403` 表示权限不足，`500` / `503` 表示服务端错误或服务不可用。

登录路径不得承载 dashboard hash，dashboard 也不再使用 hash route。路由声明集中在 `src/app/admin-routes.tsx`，由 React Router 的 route object 与 `<Navigate>` 承载登录保护。匿名访问 `/login#/learning` 时会清理为 `/login`；已认证访问 `/login#/learning` 时会规范化为 `/learning`，避免后台中心运行在 `/login` pathname 下。

## 5. 登录页

登录页由 `AdminLoginPage` 与 `AdminLoginForm` 组成。视觉结构参考 `satnaing/shadcn-admin` 的认证页：顶部居中品牌标识与标题，主体是单张居中的登录卡片，卡片内包含标题、说明、表单和条款文案。

项目侧只保留账号密码登录语义，不使用邮箱登录、注册入口、GitHub 登录或 Facebook 登录。

顶部品牌必须使用项目自有语义，不沿用 shadcn 默认标题或 command 图形。当前标题为 `Agent 管理台`，标识为治理中枢节点徽标。

必须出现：

```text
Agent 管理台
Agent 管理台标识
登入
请在下方输入您的账号和密码登录后台。
账号
请输入账号
密码
请输入密码
显示密码
记住登录
登入
登录中...
服务条款
隐私政策
```

禁止出现：

```text
登录管理后台
Shadcn 管理员
电子邮件
Email
Sign in
Sign up
GitHub
Facebook
Or continue with
立即注册
```

## 6. 角色入口控制

第一版支持：

```text
super_admin -> 超级管理员
developer -> 开发者
```

`super_admin` 默认可访问全部中心。`developer` 第一版只显示：

```text
运行中枢
学习中枢
技能工坊
证据中心
```

高风险入口如审批中枢、连接器与策略在 developer 角色下隐藏。按钮级权限矩阵后置。

## 7. MVP 过渡说明

第一版允许：

- Refresh Token 通过请求体传递。
- Token 由前端内存状态管理，并在用户勾选“记住登录”时写入浏览器本地存储。
- 角色只控制导航入口。

后续增强：

- auth-server 接入数据库账号与会话管理后继续保持双 Token 语义，后端只保存 Refresh Token Hash。
- 增加按钮级权限。
- 增加账号管理与密码修改。
