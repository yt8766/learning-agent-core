# agent-server Knowledge Auth Stub

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/knowledge`
对应接口规范：`docs/contracts/api/knowledge.md`
最后核对：2026-05-01

## 目标

`KnowledgeModule` 当前提供 Knowledge 前端横向 MVP 所需的认证 stub。它用于打通 `/api/knowledge/v1/auth/*` 的登录、刷新、当前用户和退出流程，不是最终生产级 JWT / session / refresh token rotation 实现。

## 当前入口

源码入口：

```text
apps/backend/agent-server/src/knowledge/
  knowledge.module.ts
  knowledge.controller.ts
  knowledge.service.ts
  knowledge-jwt.ts
```

模块装配：

- `apps/backend/agent-server/src/app/app.module.ts` 引入 `KnowledgeModule`。
- controller 路由前缀是 `knowledge/v1/auth`；全局 API prefix 由后端宿主统一处理。
- 该模块遵守后端结构检查的标准布局：`knowledge.module.ts`、`knowledge.controller.ts`、`knowledge.service.ts` 与服务测试位于模块根或 `test/knowledge/`。

## 当前行为

- `POST /knowledge/v1/auth/login`
  - 接受 `email` 和 `password`。
  - 空邮箱或空密码返回 `auth_invalid_credentials`。
  - 成功返回固定 `user_1` 用户摘要、Knowledge 权限集合和双 token。
- `POST /knowledge/v1/auth/refresh`
  - 接受 `knowledge-refresh:<userId>:<version>` 形式的 refresh token。
  - 成功返回 version + 1 的 access / refresh token。
  - 无法解析时返回 `auth_refresh_token_invalid`。
- `GET /knowledge/v1/auth/me`
  - 当前返回固定 owner 用户摘要。
  - 这一版还没有 access token guard。
- `POST /knowledge/v1/auth/logout`
  - 返回 `{ ok: true }`。
  - 前端退出登录仍以删除本地 token 为准。

## 后续替换边界

后续进入纵向生产化时，保持 Knowledge API contract 不变，替换 service 内部实现：

- token 改为真实 JWT 或项目统一 token provider。
- refresh token 应只持久化 hash，并支持 rotation / replay detection。
- `me` 接入 guard，禁止无 token 读取当前用户。
- 用户、workspace、roles、permissions 来自真实账号 / workspace repository。
- controller 保持薄，不直接签 token、不直接查库。
